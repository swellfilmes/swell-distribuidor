/**
 * Regras puras pra decidir entre `publishNow` e `scheduledFor` no Zernio.
 *
 * Mantemos isolado em função pura pra testar sem mockar Zernio/Notion.
 * Espelha a lógica usada inline em `src/maintenance/publicarAprovados.ts`:
 *  - data vazia / inválida → publica agora (não é agendamento futuro)
 *  - data <= agora           → publica agora (passada)
 *  - data >  agora           → agenda no futuro
 */

/**
 * Retorna `true` se `dataIso` representa um agendamento estritamente futuro
 * em relação a `agora`. Datas vazias, inválidas, ou no passado/empate
 * retornam `false` (= publicar agora).
 */
export function ehAgendamentoFuturo(
  dataIso: string | null | undefined,
  agora: Date = new Date(),
): boolean {
  if (!dataIso) return false;
  const t = new Date(dataIso).getTime();
  if (Number.isNaN(t)) return false;
  return t > agora.getTime();
}
