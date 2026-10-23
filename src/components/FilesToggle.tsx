"use client";

import { useEffect, useState } from "react";
import { ManageFilesPanel } from "./ManageFilesPanel";

/**
 * Bridges the renderer's own vanilla-JS "Files" button (page.tsx's
 * BRAIN_MARKUP, styled to match Chat/Cinema/Play demo) to this
 * React-managed panel — same pattern as ChatToggle.tsx, see its comment
 * for why a plain DOM listener is used instead of rendering the button.
 */
export function FilesToggle({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const button = document.getElementById("btn-files");
    if (!button) return;

    function handleClick() {
      setOpen((current) => !current);
    }

    button.addEventListener("click", handleClick);
    return () => button.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const button = document.getElementById("btn-files");
    if (button) {
      button.setAttribute("aria-pressed", String(open));
      button.textContent = open ? "Close files" : "Files";
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="files-overlay">
      <div className="files-overlay-header">
        <span>Manage files</span>
        <button className="files-overlay-close" onClick={() => setOpen(false)} aria-label="Close files">
          ×
        </button>
      </div>
      <div className="files-overlay-body">
        <ManageFilesPanel orgId={orgId} />
      </div>
    </div>
  );
}
