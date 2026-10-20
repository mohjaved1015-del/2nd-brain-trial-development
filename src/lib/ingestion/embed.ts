/**
 * OpenAI text-embedding-3-small, 1536 dims — matches the `chunks.embedding`
 * column in the schema. If the embeddings model ever changes, the column
 * dimension and this function need to change together.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings failed (${response.status}): ${await response.text()}`);
  }

  const body: { data: Array<{ embedding: number[] }> } = await response.json();
  return body.data.map((item) => item.embedding);
}
