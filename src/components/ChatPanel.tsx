"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/supabase/types";

interface ChatTurn {
  question: string;
  answer: string;
  sources: SearchResult[];
}

/**
 * Chat UI: proves the retrieval + citation + conversation-memory loop end
 * to end, with basic real styling (see globals.css) so it reads as a
 * product, not a bare form. The intended final frontend is still the
 * 3D-Brain shell rebuild, not this page — see decisions/log.md. This is
 * a quick, separate styling pass, not that rebuild.
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
