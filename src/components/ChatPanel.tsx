"use client";

import { useEffect, useState } from "react";
import type { ChatMessage, SearchResult } from "@/lib/supabase/types";

interface ChatTurn {
  question: string;
  answer: string;
  sources: SearchResult[];
}

function storageKey(orgId: string): string {
  return `second-brain:conversation-id:${orgId}`;
}

function toTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let pendingQuestion: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      pendingQuestion = message.content;
    } else if (message.role === "assistant" && pendingQuestion !== null) {
      turns.push({ question: pendingQuestion, answer: message.content, sources: message.sources });
      pendingQuestion = null;
    }
  }

  return turns;
}

/**
 * Chat UI proving the retrieval + citation + persisted-conversation-memory
 * loop end to end. Not yet rendered on the homepage or styled — the 3D-
 * Brain view (src/app/page.tsx) is the real frontend; this is still
 * waiting on the visual integration (a button next to Cinema) and the
 * upload affordances (drag-drop/attach/link-paste), both separate,
 * not-yet-done parts. See decisions/log.md.
 *
 * Memory is now real and persisted (Supabase, see
 * src/lib/conversations/store.ts), not just in-browser state: the
 * conversation id is remembered in localStorage per org, and on mount
 * this resumes that conversation's history instead of starting blank.
 */
export function ChatPanel({ orgId }: { orgId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedId = localStorage.getItem(storageKey(orgId));
    if (!storedId) return;

    (async () => {
      const response = await fetch(`/api/chat?orgId=${encodeURIComponent(orgId)}&conversationId=${encodeURIComponent(storedId)}`);
      if (!response.ok) return;
      const data: { messages: ChatMessage[] } = await response.json();
      setTurns(toTurns(data.messages));
      setConversationId(storedId);
    })();
  }, [orgId]);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, question, conversationId }),
      });
      const data = await response.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(storageKey(orgId), data.conversationId);
      }
      setTurns((prev) => [...prev, { question, answer: data.text, sources: data.citedSources ?? [] }]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="turns">
        {turns.length === 0 && <p className="empty-state">Ask a question to get started.</p>}
        {turns.map((turn, i) => (
          <div className="turn" key={i}>
            <p className="bubble question">{turn.question}</p>
            <p className="bubble answer">{turn.answer}</p>
            {turn.sources.length > 0 && (
              <ol className="sources">
                {turn.sources.map((source) => (
                  <li key={source.id}>{source.content.slice(0, 120)}...</li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
      <div className="composer">
        <div className="composer-inner">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask your second brain..."
            disabled={loading}
          />
          <button onClick={ask} disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </button>
        </div>
      </div>
    </>
  );
}
