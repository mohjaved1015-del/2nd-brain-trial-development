import Anthropic from "@anthropic-ai/sdk";
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
 * Generation stage. Takes already-retrieved-and-reranked chunks (never
 * fetches them itself) so this stays swappable from the retrieval logic
 * and testable on its own with fixed inputs.
 */
export async function generateAnswer(question: string, sources: HybridSearchResult[]): Promise<AnswerResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
  const client = new Anthropic({ apiKey });

  const context = sources
    .map((source, i) => `[${i + 1}] ${source.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Sources:\n\n${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, citedSources: sources };
}
