import { createReadStream, statSync } from 'node:fs';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
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
 * Cap server-side de 5 GB no upload. O cliente precisa enviar `tamanhoBytes`
 * pra gente assinar com ContentLength exato — qualquer corpo diferente
 * disso o R2 rejeita por causa da assinatura. Sem isso, presigned PUT
 * aceitava arquivos de qualquer tamanho.
 */
export const LIMITE_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/**
 * Gera uma URL assinada PUT pra o browser subir direto no R2.
 *
 * `tamanhoBytes` precisa vir do cliente — a assinatura inclui `Content-Length`
 * exato, então o browser não consegue subir nada maior (nem menor) sem
 * invalidar a assinatura. Cap configurado em LIMITE_UPLOAD_BYTES.
 */
export async function gerarUrlAssinadaUpload(
  tenant: TenantConfig,
  nomeArquivo: string,
  contentType: string,
  tamanhoBytes: number,
): Promise<{ url: string; chaveR2: string; urlPublica: string }> {
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
    throw new Error('tamanhoBytes precisa ser um número positivo.');
  }
  if (tamanhoBytes > LIMITE_UPLOAD_BYTES) {
    const gb = (tamanhoBytes / 1024 / 1024 / 1024).toFixed(2);
    throw new Error(
      `Arquivo de ${gb} GB passa do limite de ${LIMITE_UPLOAD_BYTES / 1024 / 1024 / 1024} GB.`,
    );
  }

  const sanitize = nomeArquivo.replace(/[^\w.\-]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const chaveR2 = `tenants/${tenant.empresaId}/publicar/${timestamp}__${sanitize}`;

  const command = new PutObjectCommand({
    Bucket: globalConfig.R2_BUCKET,
    Key: chaveR2,
    ContentType: contentType,
    ContentLength: tamanhoBytes,
  });

  // TTL 1h: vídeos grandes (até 5GB) em conexão residencial podem levar
  // 20-40min de upload. 10min do TTL antigo estourava no meio.
  const url = await getSignedUrl(s3, command, { expiresIn: 60 * 60 });
  const baseLimpa = globalConfig.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  const urlPublica = `${baseLimpa}/${chaveR2}`;
  return { url, chaveR2, urlPublica };
}

/**
 * Deleta um objeto do R2. Idempotente — se a chave não existir, R2 responde
 * OK igual. Ignora erros silenciosamente (best-effort) porque a UI já
 * confirmou a exclusão do post; queremos que o Notion+Zernio já estejam
 * limpos independente do R2.
 */
export async function deletarDoR2(chaveR2: string): Promise<void> {
  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: globalConfig.R2_BUCKET,
        Key: chaveR2,
      }),
    );
  } catch {
    // Silencia — post já está sendo excluído; se o R2 não deletar agora,
    // o arquivo fica órfão mas não bloqueia a exclusão do post pro usuário.
  }
}

/**
 * Deriva a chave R2 (`tenants/{id}/publicar/...`) a partir da URL pública
 * de mídia. Retorna null se a URL não bater com o base URL configurado.
 */
export function chaveR2DeUrl(urlPublica: string | null | undefined): string | null {
  if (!urlPublica) return null;
  const base = globalConfig.R2_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (!urlPublica.startsWith(base + '/')) return null;
  return urlPublica.slice(base.length + 1);
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
