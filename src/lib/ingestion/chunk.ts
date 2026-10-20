export interface TextChunk {
  index: number;
  content: string;
}

/**
 * Splits text into overlapping chunks by paragraph, falling back to a hard
 * character split for any single paragraph that's too long on its own.
 * Overlap preserves context across chunk boundaries so an answer's
 * supporting sentence doesn't get split away from the sentence before it.
 */
export function chunkText(
  text: string,
  { maxChars = 1200, overlapChars = 150 }: { maxChars?: number; overlapChars?: number } = {},
): TextChunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) chunks.push(current);

    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      // A single paragraph longer than maxChars: hard-split it with overlap.
      for (let start = 0; start < paragraph.length; start += maxChars - overlapChars) {
        chunks.push(paragraph.slice(start, start + maxChars));
      }
      current = "";
    }
  }

  if (current) chunks.push(current);

  return chunks.map((content, index) => ({ index, content }));
}
