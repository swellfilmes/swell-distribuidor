const MAX_POR_BLOCO = 1900;

export function chunkRichText(
  texto: string,
): Array<{ text: { content: string } }> {
  if (!texto) return [{ text: { content: '' } }];
  const chunks: Array<{ text: { content: string } }> = [];
  for (let i = 0; i < texto.length; i += MAX_POR_BLOCO) {
    chunks.push({ text: { content: texto.slice(i, i + MAX_POR_BLOCO) } });
  }
  return chunks;
}
