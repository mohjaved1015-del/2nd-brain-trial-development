"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";

function panelOpenKey(orgId: string): string {
  return `second-brain:chat-open:${orgId}`;
}

/**
 * Bridges the renderer's own vanilla-JS "Chat" button (plain HTML in
 * page.tsx's BRAIN_MARKUP, styled to match Cinema/Play demo) to this
 * actual React-managed panel. The button lives outside React's tree
 * (it's part of the dangerouslySetInnerHTML markup), so this attaches a
 * plain DOM listener to it rather than rendering the button itself —
 * matching how the renderer's own buttons work, not fighting it.
 *
 * Panel-open state is remembered in localStorage: a document upload
 * inside the chat panel reloads the page to refresh the 3D graph (see
 * ChatPanel.tsx and decisions/log.md — this follows the renderer's own
 * existing "Rebuild from disk" button, which does the same full reload
 * rather than a risky live in-place update of someone else's prebuilt
 * Three.js scene). Remembering that the panel was open means it reopens
 * automatically after that reload instead of silently vanishing.
 */
export function ChatToggle({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(panelOpenKey(orgId)) === "1") setOpen(true);
  }, [orgId]);

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
    if (button) {
      button.setAttribute("aria-pressed", String(open));
      button.textContent = open ? "Close chat" : "Chat";
    }
    localStorage.setItem(panelOpenKey(orgId), open ? "1" : "0");
  }, [open, orgId]);

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
