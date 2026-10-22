"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";

/**
 * Bridges the renderer's own vanilla-JS "Chat" button (plain HTML in
 * page.tsx's BRAIN_MARKUP, styled to match Cinema/Play demo) to this
 * actual React-managed panel. The button lives outside React's tree
 * (it's part of the dangerouslySetInnerHTML markup), so this attaches a
 * plain DOM listener to it rather than rendering the button itself —
 * matching how the renderer's own buttons work, not fighting it.
 */
export function ChatToggle({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const button = document.getElementById("btn-chat");
    if (!button) return;

    function handleClick() {
      setOpen((current) => !current);
    }

    button.addEventListener("click", handleClick);
    return () => button.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const button = document.getElementById("btn-chat");
    if (!button) return;
    button.setAttribute("aria-pressed", String(open));
    button.textContent = open ? "Close chat" : "Chat";
  }, [open]);

  if (!open) return null;

  return (
    <div className="chat-overlay">
      <div className="chat-overlay-header">
        <span>Second Brain Chat</span>
        <button className="chat-overlay-close" onClick={() => setOpen(false)} aria-label="Close chat">
          ×
        </button>
      </div>
      <div className="chat-overlay-body">
        <ChatPanel orgId={orgId} />
      </div>
    </div>
  );
}
