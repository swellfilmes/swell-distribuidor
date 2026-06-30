import { createReadStream, statSync } from 'node:fs';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime-types';
import { globalConfig, type TenantConfig } from '../config';
import type { MidiaHospedada } from '../types';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${globalConfig.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: globalConfig.R2_ACCESS_KEY_ID,
    secretAccessKey: globalConfig.R2_SECRET_ACCESS_KEY,
  },
});

export async function subirParaR2(
  tenant: TenantConfig,
  caminhoLocal: string,
): Promise<MidiaHospedada> {
  const nome = path.basename(caminhoLocal);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const chaveR2 = `tenants/${tenant.empresaId}/publicar/${timestamp}__${nome}`;
  const contentType = mime.lookup(caminhoLocal) || 'application/octet-stream';
  const tamanho = statSync(caminhoLocal).size;

  await s3.send(
    new PutObjectCommand({
      Bucket: globalConfig.R2_BUCKET,
      Key: chaveR2,
      Body: createReadStream(caminhoLocal),
      ContentType: contentType,
      ContentLength: tamanho,
    }),
  );

  const baseLimpa = globalConfig.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  const urlPublica = `${baseLimpa}/${chaveR2}`;

  return { urlPublica, chaveR2 };
}

/**
 * Gera uma URL assinada PUT pra o browser subir direto no R2.
 * TTL curto (10 min) é suficiente porque o usuário inicia o upload imediato.
 */
export async function gerarUrlAssinadaUpload(
  tenant: TenantConfig,
  nomeArquivo: string,
  contentType: string,
): Promise<{ url: string; chaveR2: string; urlPublica: string }> {
  const sanitize = nomeArquivo.replace(/[^\w.\-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const chaveR2 = `tenants/${tenant.empresaId}/publicar/${timestamp}__${sanitize}`;

  const command = new PutObjectCommand({
    Bucket: globalConfig.R2_BUCKET,
    Key: chaveR2,
    ContentType: contentType,
  });

  // TTL 1h: vídeos grandes (até 5GB) em conexão residencial podem levar
  // 20-40min de upload. 10min do TTL antigo estourava no meio.
  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 60 });
  const baseLimpa = globalConfig.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  const urlPublica = `${baseLimpa}/${chaveR2}`;
  return { url, chaveR2, urlPublica };
}

/**
 * Baixa um objeto do R2 pra um arquivo temporário e retorna o caminho.
 * Use no worker, depois do upload do browser, pra rodar ffmpeg local.
 */
export async function baixarDoR2(
  chaveR2: string,
  nomePreferido?: string,
): Promise<{ caminho: string; limpar: () => Promise<void> }> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'swell-r2-'));
  const nome = nomePreferido ?? path.basename(chaveR2);
  const caminho = path.join(tmpDir, nome);

  const resp = await s3.send(
    new GetObjectCommand({
      Bucket: globalConfig.R2_BUCKET,
      Key: chaveR2,
    }),
  );
  if (!resp.Body) throw new Error(`Sem corpo na resposta R2 para ${chaveR2}`);
  const buf = Buffer.from(await resp.Body.transformToByteArray());
  await writeFile(caminho, buf);
  return {
    caminho,
    limpar: () => rm(tmpDir, { recursive: true, force: true }),
  };
}
