/**
 * Embeddings via Gemini (gemini-embedding-001), requested at 1536
 * dimensions to match the `chunks.embedding` column without a schema
 * change.
 *
 * TEMPORARY TESTING SUBSTITUTION — see decisions/log.md: the original
 * plan uses OpenAI text-embedding-3-small. Gemini's free tier lets us
 * test the pipeline end to end with no paid key. Swap back (and re-embed
 * existing chunks) once there's budget, since embeddings from different
 * models aren't interchangeable.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        outputDimensionality: 1536,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini embeddings failed (${response.status}): ${await response.text()}`);
  }

  const body: { embeddings: Array<{ values: number[] }> } = await response.json();
  return body.embeddings.map((embedding) => embedding.values);
}
