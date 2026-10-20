"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/supabase/types";

interface ChatTurn {
  question: string;
  answer: string;
  sources: SearchResult[];
}

/**
 * Chat UI proving the retrieval + citation + conversation-memory loop end
 * to end. No longer rendered on the homepage — the 3D-Brain view
 * (src/app/page.tsx) is the real frontend now. This component's styling
 * (the dark theme / chat-bubble CSS that used to live in globals.css) was
 * removed along with that file; this is currently unstyled again until
 * it's wired into the 3D view as a feature (see decisions/log.md).
 */
export function ChatPanel({ orgId }: { orgId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      const history = turns.map((turn) => ({ question: turn.question, answer: turn.answer }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, question, history }),
      });
      const data = await response.json();
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
