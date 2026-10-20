"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/supabase/types";

interface ChatTurn {
  question: string;
  answer: string;
  sources: SearchResult[];
}

/**
 * Minimal chat UI: proves the retrieval + citation + conversation-memory
 * loop end to end. Deliberately no streaming/markdown/polish yet — that's
 * pitch-polish work for after retrieval quality is validated (see
 * STATUS.md build order). The actual intended frontend is the 3D-Brain
 * shell rebuild, not this page — see decisions/log.md.
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
    <div>
      {turns.map((turn, i) => (
        <div key={i}>
          <p><strong>Q:</strong> {turn.question}</p>
          <p><strong>A:</strong> {turn.answer}</p>
          <ol>
            {turn.sources.map((source) => (
              <li key={source.id}>{source.content.slice(0, 120)}...</li>
            ))}
          </ol>
        </div>
      ))}
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
  );
}
