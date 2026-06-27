import { Client as NotionClient } from '@notionhq/client';

/**
 * Cria a database de distribuição na workspace do usuário, com todas as
 * propriedades que o pipeline espera (ver criarLinhaAprovacao, registrarResultado,
 * publicarAprovados, ingerirPasta).
 *
 * Retorna o database_id pronto pra salvar em tenant_secrets.notionDbId.
 *
 * Se nenhuma página foi compartilhada com a integração ainda, lança erro
 * com mensagem orientando o usuário a compartilhar uma página.
 */
export async function criarDistribuicaoDb(
  accessToken: string,
  nomeEmpresa: string,
): Promise<{ databaseId: string; parentPageId: string; databaseUrl: string }> {
  const notion = new NotionClient({ auth: accessToken });

  // Acha a primeira página acessível pela integração (escolhida pelo user no OAuth).
  const busca = await notion.search({
    filter: { value: 'page', property: 'object' },
    page_size: 10,
  });
  const paginas = busca.results.filter(
    (r): r is typeof r & { object: 'page' } => r.object === 'page',
  );
  if (paginas.length === 0) {
    throw new Error(
      'Nenhuma página foi compartilhada com a integração. ' +
        'No popup do Notion, você precisa selecionar pelo menos uma página onde a database vai ser criada.',
    );
  }
  const parentPageId = paginas[0].id;

  const titulo = `Distribuição Social — ${nomeEmpresa}`;

  const created = await notion.databases.create({
    parent: { type: 'page_id', page_id: parentPageId },
    title: [{ type: 'text', text: { content: titulo } }],
    properties: {
      Nome: { title: {} },
      Cliente: { rich_text: {} },
      Tipo: {
        select: {
          options: [
            { name: 'aftermovie', color: 'blue' },
            { name: 'reel', color: 'pink' },
            { name: 'bastidor', color: 'orange' },
            { name: 'institucional', color: 'gray' },
            { name: 'minidoc', color: 'purple' },
            { name: 'ai', color: 'green' },
            { name: 'foto', color: 'yellow' },
            { name: 'carrossel', color: 'red' },
          ],
        },
      },
      Orientacao: {
        select: {
          options: [
            { name: 'h', color: 'blue' },
            { name: 'v', color: 'pink' },
          ],
        },
      },
      Status: {
        select: {
          options: [
            { name: 'Aguardando', color: 'yellow' },
            { name: 'Aprovado', color: 'green' },
            { name: 'Rejeitado', color: 'red' },
            { name: 'Agendado', color: 'blue' },
            { name: 'Publicado', color: 'green' },
            { name: 'Publicado parcial', color: 'orange' },
            { name: 'Pendente Zernio', color: 'yellow' },
            { name: 'Falhou', color: 'red' },
            { name: 'Cancelado', color: 'gray' },
          ],
        },
      },
      Redes: {
        multi_select: {
          options: [
            { name: 'instagram', color: 'pink' },
            { name: 'youtube', color: 'red' },
            { name: 'tiktok', color: 'gray' },
            { name: 'linkedin', color: 'blue' },
          ],
        },
      },
      ConteudoAI: { checkbox: {} },
      Video: { url: {} },
      ThumbnailUrl: { url: {} },
      Resumo: { rich_text: {} },
      Copy: { rich_text: {} },
      PlanoJSON: { rich_text: {} },
      DataPublicacao: { date: {} },
      PublicadoEm: { date: {} },
      LinkPublicado: { url: {} },
      LogPublicacao: { rich_text: {} },
      ZernioPostId: { rich_text: {} },
      DriveFileId: { rich_text: {} },
      PastaDrive: { rich_text: {} },
    },
  });

  const databaseUrl = 'url' in created && typeof created.url === 'string' ? created.url : '';
  return { databaseId: created.id, parentPageId, databaseUrl };
}
