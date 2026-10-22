"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, SearchResult } from "@/lib/supabase/types";

interface ChatTurn {
  question: string;
  answer: string;
  sources: SearchResult[];
}

const URL_PATTERN = /^https?:\/\/\S+$/i;

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
 * Chat UI: Q&A with persisted conversation memory (src/lib/conversations/
 * store.ts), plus this panel's second job per MJ's original framing —
 * the way documents get into the brain. Three upload paths, all feeding
 * the same ingestion pipeline:
 *  - drag-and-drop a file onto the panel
 *  - the attach (paperclip) button
 *  - pasting a direct file link as a "question" (detected by URL shape)
 *
 * Scoped to what Unstructured.io actually handles (text/PDF/Word/images)
 * per the explicit video-is-out-of-scope-for-now decision — see
 * decisions/log.md. A link to an ordinary web page (not a direct file
 * URL) may not produce useful text; that's a known limit, not handled
 * here.
 */
export function ChatPanel({ orgId }: { orgId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function addSystemTurn(label: string, result: string) {
    setTurns((prev) => [...prev, { question: label, answer: result, sources: [] }]);
  }

  /**
   * Reloads the page after a successful upload, same pattern the
   * renderer's own "Rebuild from disk" button already uses (see
   * .claude/skills/3d-brain/assets/template/src/app.js) — the graph
   * only fetches its data once on load, so this is how a new document
   * actually appears without deep surgery on that prebuilt Three.js
   * scene. The chat panel reopens automatically after reload (see
   * ChatToggle.tsx), and conversation history survives it (persisted in
   * Supabase), so this isn't as disruptive as a plain refresh would be.
   */
  function refreshGraphSoon() {
    setTimeout(() => window.location.reload(), 1200);
  }

  async function ask() {
    const trimmed = question.trim();
    if (!trimmed) return;

    if (URL_PATTERN.test(trimmed)) {
      await uploadUrl(trimmed);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, question: trimmed, conversationId }),
      });
      const data = await response.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem(storageKey(orgId), data.conversationId);
      }
      setTurns((prev) => [...prev, { question: trimmed, answer: data.text ?? data.error, sources: data.citedSources ?? [] }]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  async function uploadUrl(url: string) {
    setLoading(true);
    setQuestion("");
    try {
      const response = await fetch("/api/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, source: "link", url }),
      });
      const data = await response.json();
      if (response.ok) {
        addSystemTurn(`Add link: ${url}`, `Added to your second brain (${data.chunkCount} chunks). Refreshing the graph...`);
        refreshGraphSoon();
      } else {
        addSystemTurn(`Add link: ${url}`, `Couldn't add that link: ${data.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File) {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("orgId", orgId);
      formData.append("source", "upload");
      formData.append("file", file);

      const response = await fetch("/api/ingest", { method: "POST", body: formData });
      const data = await response.json();
      if (response.ok) {
        addSystemTurn(`Add file: ${file.name}`, `Added to your second brain (${data.chunkCount} chunks). Refreshing the graph...`);
        refreshGraphSoon();
      } else {
        addSystemTurn(`Add file: ${file.name}`, `Couldn't add that file: ${data.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  return (
    <>
      <div
        className={`turns${dragging ? " dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {turns.length === 0 && (
          <p className="empty-state">Ask a question, or drop a file/paste a link to add it to your brain.</p>
        )}
        {dragging && <p className="drop-hint">Drop to add to your second brain</p>}
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
          <input type="file" ref={fileInputRef} onChange={handleFilePicked} hidden />
          <button
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            title="Attach a file"
            aria-label="Attach a file"
          >
            +
          </button>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="Ask a question, drop a file, or paste a link..."
            disabled={loading}
          />
          <button onClick={ask} disabled={loading}>
            {loading ? "Working..." : "Ask"}
          </button>
        </div>
      </div>
    </>
  );
}
