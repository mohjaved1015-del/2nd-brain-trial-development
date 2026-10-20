import type { SearchResult } from "@/lib/supabase/types";

const SYSTEM_PROMPT = `You are a company's internal knowledge assistant, used only by trusted
employees of this organization — not by the public or by customers.
Answer using the numbered source excerpts provided below, citing them
inline like [1], [2], and you may also use anything stated earlier in
this same conversation (e.g. a name or detail the user already gave you)
— but never cite a conversation turn as if it were a numbered source.
If neither the sources nor the earlier conversation contain the answer,
say you don't know — never guess or use outside knowledge beyond this
conversation.`;

export interface ChatHistoryTurn {
  question: string;
  answer: string;
}

export interface AnswerResult {
  text: string;
  citedSources: SearchResult[];
}

const MAX_HISTORY_TURNS = 6;

/**
 * Generation via Gemini.
 *
 * TEMPORARY TESTING SUBSTITUTION — see decisions/log.md: the original
 * plan uses Claude Sonnet, chosen specifically for its strength at
 * answering only from given context and saying "I don't know." Gemini's
 * free tier lets us validate the retrieval pipeline without a paid key
 * first. Swap back to Claude once there's budget.
 *
 * `history` is prior Q&A turns from the same conversation, capped to the
 * most recent few — this is real conversation memory (Gemini sees the
 * actual prior turns, not just a text summary), not a search-side
 * improvement. See retrieval/search.ts for the known limitation that
 * follow-up questions don't yet improve the search query itself.
 */
export async function generateAnswer(
  question: string,
  sources: SearchResult[],
  history: ChatHistoryTurn[] = [],
): Promise<AnswerResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const context = sources.map((source, i) => `[${i + 1}] ${source.content}`).join("\n\n");

  const historyContents = history.slice(-MAX_HISTORY_TURNS).flatMap((turn) => [
    { role: "user", parts: [{ text: turn.question }] },
    { role: "model", parts: [{ text: turn.answer }] },
  ]);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...historyContents,
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
