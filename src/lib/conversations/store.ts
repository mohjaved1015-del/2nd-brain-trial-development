import { createServiceClient } from "@/lib/supabase/server";
import type { ChatMessage, SearchResult } from "@/lib/supabase/types";
import type { ChatHistoryTurn } from "@/lib/generation/answer";

/**
 * Persisted conversation memory, backing the chat endpoint's history.
 * This replaced client-only memory (the browser just held an in-memory
 * array, lost on refresh) — see decisions/log.md.
 */

/**
 * Resolves a conversation id to continue, or starts a new one. If
 * `conversationId` is supplied but doesn't belong to `orgId` (wrong org,
 * or doesn't exist), silently falls back to starting a new conversation
 * rather than erroring — a stale/invalid id shouldn't break the chat.
 */
export async function getOrCreateConversation(orgId: string, conversationId?: string | null): Promise<string> {
  const supabase = createServiceClient();

  if (conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("org_id", orgId)
      .single();
    if (!error && data) return data.id;
  }

  const { data, error } = await supabase.from("conversations").insert({ org_id: orgId }).select("id").single();
  if (error || !data) throw new Error(`Failed to create conversation: ${error?.message}`);
  return data.id;
}

export async function loadMessages(conversationId: string, orgId: string): Promise<ChatMessage[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, conversation_id, org_id, role, content, sources, created_at")
    .eq("conversation_id", conversationId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return data ?? [];
}

/**
 * Pairs up stored messages into the {question, answer} shape generation
 * expects. Any trailing unanswered user message (shouldn't normally
 * happen — a failed generation call would leave one) is dropped rather
 * than passed through malformed.
 */
export function toHistoryTurns(messages: ChatMessage[]): ChatHistoryTurn[] {
  const turns: ChatHistoryTurn[] = [];
  let pendingQuestion: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      pendingQuestion = message.content;
    } else if (message.role === "assistant" && pendingQuestion !== null) {
      turns.push({ question: pendingQuestion, answer: message.content });
      pendingQuestion = null;
    }
  }

  return turns;
}

export async function appendMessage(
  conversationId: string,
  orgId: string,
  role: "user" | "assistant",
  content: string,
  sources: SearchResult[] = [],
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    org_id: orgId,
    role,
    content,
    sources,
  });
  if (error) throw new Error(`Failed to save message: ${error.message}`);

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}
