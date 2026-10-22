"use client";

import { useEffect } from "react";

interface NodeResponse {
  fileUrl: string | null;
  error?: string;
}

/**
 * Redirects the renderer's "Show file" button to actually open the
 * original uploaded file (PDF/Word/etc., from Supabase Storage — see
 * src/lib/ingestion/pipeline.ts and migration 0006) in a new tab,
 * instead of its original job: opening the file in the local OS file
 * explorer, which /api/reveal deliberately refuses (no local filesystem
 * to reveal on a hosted server; see the earlier 3D-Brain-rebuild
 * decision).
 *
 * app.js keeps the selected node's id internally with no DOM exposure
 * for most of selection — except one reliable spot: `selectNode()`
 * calls `history.replaceState(null, '', \`?node=${id}\`)` on every
 * selection, so the URL's own `node` query param is read here instead
 * of scraping app.js's closures.
 *
 * Implemented as a capturing-phase listener that stops the renderer's
 * own bubble-phase listener (app.js: always shows "Opened in File
 * Explorer" regardless of whether the request succeeded — see
 * decisions/log.md) rather than editing app.js itself, which stays
 * untouched per the 3D-Brain-rebuild decision.
 *
 * Documents ingested before migration 0006 have no stored original —
 * for those, this falls back to "Read note" (the text view) instead.
 */
export function RevealBridge({ orgId }: { orgId: string }) {
  useEffect(() => {
    const revealButton = document.getElementById("d-reveal");
    if (!revealButton) return;

    async function handleClick(event: MouseEvent) {
      event.stopImmediatePropagation();
      event.preventDefault();

      const nodeId = new URL(window.location.href).searchParams.get("node");
      if (!nodeId) return;

      try {
        const response = await fetch(`/api/node?id=${encodeURIComponent(nodeId)}&orgId=${encodeURIComponent(orgId)}`);
        const data: NodeResponse = await response.json();
        if (response.ok && data.fileUrl) {
          window.open(data.fileUrl, "_blank", "noopener,noreferrer");
          return;
        }
      } catch {
        // fall through to the text view below
      }

      // No stored original (ingested before migration 0006, or the
      // storage upload failed) — show the extracted text instead of
      // doing nothing.
      document.getElementById("d-read")?.click();
    }

    revealButton.addEventListener("click", handleClick, true);
    return () => revealButton.removeEventListener("click", handleClick, true);
  }, [orgId]);

  return null;
}
