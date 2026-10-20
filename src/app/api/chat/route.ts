import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "@/lib/retrieval/search";
import { rerank } from "@/lib/retrieval/rerank";
import { generateAnswer } from "@/lib/generation/answer";

/**
 * Chat endpoint. Resolves candidates via hybrid search, reranks, then
 * generates a cited answer. orgId is a placeholder until Supabase Auth is
 * wired in — it should come from the authenticated session, not the
 * request body, once that exists.
 */
export async function POST(request: NextRequest) {
  const { orgId, question } = await request.json();

  if (!orgId || !question) {
    return NextResponse.json({ error: "orgId and question are required" }, { status: 400 });
  }

  const candidates = await hybridSearch(orgId, question);
  const topSources = await rerank(question, candidates);
  const answer = await generateAnswer(question, topSources);

  return NextResponse.json(answer);
}
