import type { HybridSearchResult } from "@/lib/supabase/types";

const SYSTEM_PROMPT = `You are a company's internal knowledge assistant. Answer only using the
numbered source excerpts provided below. Cite sources inline like [1], [2].
If the excerpts don't contain the answer, say you don't know — never guess
or use outside knowledge.`;

export interface AnswerResult {
  text: string;
  citedSources: HybridSearchResult[];
}

/**
 * Generation via Gemini.
 *
 * TEMPORARY TESTING SUBSTITUTION — see decisions/log.md: the original
 * plan uses Claude Sonnet, chosen specifically for its strength at
 * answering only from given context and saying "I don't know." Gemini's
 * free tier lets us validate the retrieval pipeline without a paid key
 * first. Swap back to src/lib/generation/answer.ts using @anthropic-ai/sdk
 * once there's budget — re-run the eval questions after switching, since
 * citation discipline can differ between models.
 */
export async function generateAnswer(question: string, sources: HybridSearchResult[]): Promise<AnswerResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const context = sources.map((source, i) => `[${i + 1}] ${source.content}`).join("\n\n");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Sources:\n\n${context}\n\nQuestion: ${question}` }],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini generation failed (${response.status}): ${await response.text()}`);
  }

  const body: { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> } = await response.json();
  const text = (body.candidates[0]?.content.parts ?? []).map((part) => part.text ?? "").join("");

  return { text, citedSources: sources };
}
