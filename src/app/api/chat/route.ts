import { NextRequest, NextResponse } from "next/server";
import { keywordSearch } from "@/lib/retrieval/search";
import { rerank } from "@/lib/retrieval/rerank";
import { generateAnswer, type ChatHistoryTurn } from "@/lib/generation/answer";

/**
 * Chat endpoint. Resolves candidates via keyword search, reranks, then
 * generates a cited answer using the conversation's recent history.
 * orgId is a placeholder until Supabase Auth is wired in — it should
 * come from the authenticated session, not the request body, once that
 * exists.
 */
export async function POST(request: NextRequest) {
  const { orgId, question, history } = (await request.json()) as {
    orgId?: string;
    question?: string;
    history?: ChatHistoryTurn[];
  };

  if (!orgId || !question) {
    return NextResponse.json({ error: "orgId and question are required" }, { status: 400 });
  }

  try {
    const candidates = await keywordSearch(orgId, question);
    const topSources = await rerank(question, candidates);
    const answer = await generateAnswer(question, topSources, history ?? []);
    return NextResponse.json(answer);
  } catch (error) {
    console.error("chat route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
