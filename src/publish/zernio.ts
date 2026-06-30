import { contaConfiguradaPara, zernioDo } from '../lib/clients';
import type { TenantConfig } from '../config';
import {
  categoriaDoTipo,
  type CopyPorRede,
  type MidiaHospedada,
  type PlanoPublicacao,
  type Rede,
  type ResultadoPublicacao,
} from '../types';

const POLL_INTERVALO_MS = 8_000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

function montarConteudo(copy: CopyPorRede): string {
  const tags = copy.hashtags.length ? `\n\n${copy.hashtags.join(' ')}` : '';
  return `${copy.descricao}${tags}`.trim();
}

function dadosEspecificosPorRede(
  rede: Rede,
  copy: CopyPorRede,
  plano: PlanoPublicacao,
): Record<string, unknown> {
  switch (rede) {
    case 'youtube':
      return {
        title: (copy.titulo ?? `${plano.meta.cliente} — ${plano.meta.tipo}`).slice(0, 100),
        visibility: 'public',
        ...(plano.conteudoAI ? { containsSyntheticMedia: true } : {}),
      };
    case 'instagram':
      return {};
    case 'tiktok':
      return {};
    case 'linkedin':
      return {};
  }
}

const STATUS_PUBLICADO = 'published';
const STATUS_FALHOU = 'failed';

interface DetalheRede {
  status: 'publicado' | 'falhou' | 'pendente';
  url?: string;
  platformPostId?: string;
  ultimoStatusZernio?: string;
  erro?: string;
}

async function aguardarPublicacaoFinal(
  tenant: TenantConfig,
  postId: string,
  redesEsperadas: Rede[],
  onTick?: (tentativa: number, parciais: Map<Rede, DetalheRede>) => void,
): Promise<Map<Rede, DetalheRede>> {
  const zernio = zernioDo(tenant);
  const inicio = Date.now();
  const parciais = new Map<Rede, DetalheRede>();
  const ultimoStatusVisto = new Map<Rede, string>();
  let tentativa = 0;

  while (Date.now() - inicio < POLL_TIMEOUT_MS) {
    tentativa++;
    const resposta = await zernio.posts.getPost({ path: { postId } });
    const data = (
      resposta as {
        data?: {
          post?: {
            platforms?: Array<{
              platform?: string;
              status?: string;
              platformPostUrl?: string;
              platformPostId?: string;
              errorMessage?: string;
            }>;
          };
        };
      }
    ).data;

    const platforms = data?.post?.platforms ?? [];
    let todosFinais = true;

    for (const rede of redesEsperadas) {
      const target = platforms.find((p) => p.platform === rede);
      if (!target) {
        todosFinais = false;
        continue;
      }
      const status = target.status ?? '';
      if (status) ultimoStatusVisto.set(rede, status);

      if (status === STATUS_PUBLICADO) {
        parciais.set(rede, {
          status: 'publicado',
          url: target.platformPostUrl,
          platformPostId: target.platformPostId,
          ultimoStatusZernio: status,
        });
      } else if (status === STATUS_FALHOU) {
        parciais.set(rede, {
          status: 'falhou',
          erro: target.errorMessage ?? 'falhou (sem mensagem)',
          ultimoStatusZernio: status,
        });
      } else {
        todosFinais = false;
      }
    }

    onTick?.(tentativa, new Map(parciais));

    if (todosFinais) return parciais;
    await new Promise((r) => setTimeout(r, POLL_INTERVALO_MS));
  }

  for (const rede of redesEsperadas) {
    if (!parciais.has(rede)) {
      const ultimo = ultimoStatusVisto.get(rede) ?? 'desconhecido';
      parciais.set(rede, {
        status: 'pendente',
        ultimoStatusZernio: ultimo,
        erro: `Ainda em "${ultimo}" no Zernio após ${POLL_TIMEOUT_MS / 1000}s. Rode --atualizar-pendentes mais tarde.`,
      });
    }
  }
  return parciais;
}

export interface ResumoPublicacao {
  resultados: ResultadoPublicacao[];
  redesIgnoradas: Rede[];
  zernioPostId?: string;
}

export interface OpcoesPublicar {
  /** Quando definido, agenda no Zernio em vez de publicar agora. ISO 8601. */
  scheduledFor?: string;
  /** Default: America/Bahia. Usado quando scheduledFor está definido. */
  timezone?: string;
  onTick?: (msg: string) => void;
}

export async function publicarTudo(
  tenant: TenantConfig,
  plano: PlanoPublicacao,
  midia: MidiaHospedada,
  opts: OpcoesPublicar = {},
): Promise<ResumoPublicacao> {
  const zernio = zernioDo(tenant);
  const onTick = opts.onTick;
  const isAgendado = Boolean(opts.scheduledFor);
  const redesIgnoradas: Rede[] = [];
  const redesPublicaveis: Rede[] = [];
  const platforms: Array<{
    platform: string;
    accountId: string;
    customContent?: string;
    platformSpecificData?: Record<string, unknown>;
  }> = [];

  for (const rede of plano.redes) {
    const accountId = contaConfiguradaPara(tenant, rede);
    if (!accountId) {
      redesIgnoradas.push(rede);
      continue;
    }
    const copy = plano.copy.find((c) => c.rede === rede);
    if (!copy) {
      redesIgnoradas.push(rede);
      continue;
    }
    platforms.push({
      platform: rede,
      accountId,
      customContent: montarConteudo(copy),
      platformSpecificData: dadosEspecificosPorRede(rede, copy, plano),
    });
    redesPublicaveis.push(rede);
  }

  if (platforms.length === 0) {
    return {
      resultados: plano.redes.map((rede) => ({
        rede,
        status: 'falhou' as const,
        erro: 'Nenhuma conta conectada no Zernio para esta rede.',
      })),
      redesIgnoradas: [],
    };
  }

  const conteudoBase =
    plano.copy.find((c) => redesPublicaveis.includes(c.rede))?.descricao ?? '';

  try {
    // Categoria deriva do tipo do plano (foto/carrossel → imagem; resto → video).
    // Pra carrossel, monta N mediaItems (1 principal + plano.mediasExtras).
    const categoria = categoriaDoTipo(plano.meta.tipo);
    const ehImagem = categoria === 'imagem';
    const mimeFromUrl = (url: string): string => {
      const u = url.toLowerCase();
      if (u.endsWith('.png')) return 'image/png';
      if (u.endsWith('.webp')) return 'image/webp';
      if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
      return 'video/mp4';
    };
    function montarItem(url: string): Record<string, unknown> {
      const item: Record<string, unknown> = {
        type: ehImagem ? 'image' : 'video',
        url,
        mimeType: mimeFromUrl(url),
      };
      if (!ehImagem && plano.thumbnailUrl) {
        item.thumbnail = plano.thumbnailUrl;
        item.instagramThumbnail = plano.thumbnailUrl;
      }
      return item;
    }

    const mediaItems: Array<Record<string, unknown>> = [montarItem(midia.urlPublica)];
    for (const extra of plano.mediasExtras ?? []) {
      mediaItems.push(montarItem(extra.urlPublica));
    }

    const body: Record<string, unknown> = {
      content: conteudoBase,
      mediaItems,
      platforms,
    };

    if (isAgendado) {
      body.scheduledFor = opts.scheduledFor;
      body.timezone = opts.timezone ?? 'America/Bahia';
    } else {
      body.publishNow = true;
    }

    const resposta = await zernio.posts.createPost({
      body: body as never,
    });

    const dataCreate = (resposta as { data?: { post?: { _id?: string } } }).data;
    const erroCreate = (resposta as { error?: { message?: string } }).error;
    const postId = dataCreate?.post?._id;

    if (erroCreate || !postId) {
      const msg = erroCreate?.message ?? 'Resposta sem post._id.';
      const resultados: ResultadoPublicacao[] = redesPublicaveis.map((rede) => ({
        rede,
        status: 'falhou' as const,
        erro: msg,
      }));
      return { resultados, redesIgnoradas };
    }

    if (isAgendado) {
      onTick?.(`post agendado no Zernio (id=${postId}) para ${opts.scheduledFor}.`);
      const resultados: ResultadoPublicacao[] = redesPublicaveis.map((rede) => ({
        rede,
        idExterno: postId,
        status: 'agendado' as const,
      }));
      return { resultados, redesIgnoradas, zernioPostId: postId };
    }

    onTick?.(`post criado (id=${postId}), aguardando o Zernio finalizar em cada rede...`);

    const detalhes = await aguardarPublicacaoFinal(
      tenant,
      postId,
      redesPublicaveis,
      (tentativa, parciais) => {
        const concluidas = [...parciais.keys()].join(',') || '—';
        onTick?.(`tentativa ${tentativa}: já fechadas [${concluidas}]`);
      },
    );

    const resultados: ResultadoPublicacao[] = redesPublicaveis.map((rede) => {
      const det = detalhes.get(rede);
      if (!det) {
        return {
          rede,
          idExterno: postId,
          status: 'falhou' as const,
          erro: 'sem retorno do Zernio.',
        };
      }
      if (det.status === 'publicado') {
        return {
          rede,
          idExterno: det.platformPostId ?? postId,
          url: det.url,
          status: 'publicado' as const,
        };
      }
      if (det.status === 'pendente') {
        return {
          rede,
          idExterno: postId,
          status: 'pendente' as const,
          erro: det.erro,
        };
      }
      return {
        rede,
        idExterno: postId,
        status: 'falhou' as const,
        erro: det.erro,
      };
    });

    return { resultados, redesIgnoradas, zernioPostId: postId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resultados: ResultadoPublicacao[] = redesPublicaveis.map((rede) => ({
      rede,
      status: 'falhou' as const,
      erro: msg,
    }));
    return { resultados, redesIgnoradas };
  }
}

export async function listarContasConectadas(tenant: TenantConfig): Promise<void> {
  const zernio = zernioDo(tenant);
  const resposta = await zernio.accounts.listAccounts({});
  const data = (resposta as {
    data?: { accounts?: Array<{ platform: string; _id: string }> };
  }).data;
  const accounts = data?.accounts;
  if (!accounts || accounts.length === 0) {
    console.log(`Nenhuma conta conectada no Zernio da empresa "${tenant.slug}".`);
    console.log('Conecte em: https://zernio.com → Accounts → Connect.');
    return;
  }
  console.log(`\nContas conectadas no Zernio (empresa "${tenant.slug}"):`);
  for (const a of accounts) {
    console.log(`  ${a.platform.padEnd(12)} → ${a._id}`);
  }
  console.log(
    `\nGuarde esses IDs nas colunas zernio_*_account_id da tabela tenant_secrets ` +
      `(ou edite via admin no app quando F2.7 estiver pronta).\n`,
  );
}
