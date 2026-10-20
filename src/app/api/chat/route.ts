import { NextRequest, NextResponse } from "next/server";
import { keywordSearch } from "@/lib/retrieval/search";
import { rerank } from "@/lib/retrieval/rerank";
import { generateAnswer } from "@/lib/generation/answer";
import { appendMessage, getOrCreateConversation, loadMessages, toHistoryTurns } from "@/lib/conversations/store";

/**
 * Chat endpoint. Resolves candidates via keyword search, reranks, then
 * generates a cited answer using the conversation's real persisted
 * history (loaded from Supabase, not sent by the client — see
 * decisions/log.md on why this replaced client-only memory).
 * orgId is a placeholder until Supabase Auth is wired in — it should
 * come from the authenticated session, not the request body, once that
 * exists.
 */

/** Loads a conversation's message history, for resuming it in the UI. */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const conversationId = request.nextUrl.searchParams.get("conversationId");

  if (!orgId || !conversationId) {
    return NextResponse.json({ error: "orgId and conversationId are required" }, { status: 400 });
  }

  try {
    const messages = await loadMessages(conversationId, orgId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("chat GET failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { orgId, question, conversationId: requestedConversationId } = (await request.json()) as {
    orgId?: string;
    question?: string;
    conversationId?: string;
  };

  if (!orgId || !question) {
    return NextResponse.json({ error: "orgId and question are required" }, { status: 400 });
  }

  try {
    const conversationId = await getOrCreateConversation(orgId, requestedConversationId);
    const priorMessages = await loadMessages(conversationId, orgId);
    const history = toHistoryTurns(priorMessages);

    const candidates = await keywordSearch(orgId, question);
    const topSources = await rerank(question, candidates);
    const answer = await generateAnswer(question, topSources, history);

    // Saved after generation succeeds, not before — a failed generation
    // call shouldn't leave a user message with no matching answer.
    await appendMessage(conversationId, orgId, "user", question, []);
    await appendMessage(conversationId, orgId, "assistant", answer.text, answer.citedSources);

    return NextResponse.json({ ...answer, conversationId });
  } catch (error) {
    console.error("chat route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
