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
 * Two real bugs fixed here, found by MJ testing this live:
 *
 * 1. app.js's own click listener (`$('d-reveal').addEventListener(
 *    'click', ...)`, always shows "Opened in File Explorer" regardless
 *    of success — see decisions/log.md) was still firing alongside this
 *    one. A capturing-phase listener does NOT reliably run before a
 *    bubble-phase listener on the *same* element — that ordering only
 *    applies across different elements in the propagation path (an
 *    ancestor vs. the target). Two listeners on one element fire in
 *    registration order regardless of capture, and app.js's listener
 *    was registered first (at page load, before this component's
 *    effect runs). Fixed by cloning the button (drops every listener
 *    previously attached to it, including app.js's — clones never carry
 *    `addEventListener` listeners) and attaching only this one to the
 *    clone. app.js still finds the clone fine via `getElementById`
 *    elsewhere (e.g. toggling it `.hidden` based on node kind), since it
 *    always re-queries by id rather than holding a stored reference.
 * 2. `window.open()` was called after `await fetch(...)` — by then it's
 *    no longer inside the synchronous call stack of the click, so
 *    browser popup blockers silently swallow it (no error, nothing
 *    happens). Fixed by opening a blank tab synchronously, immediately
 *    in the click handler, then navigating that already-open tab to the
 *    real URL once the fetch resolves.
 *
 * Documents ingested before migration 0006 have no stored original —
 * for those, this falls back to "Read note" (the text view) instead.
 */
export function RevealBridge({ orgId }: { orgId: string }) {
  useEffect(() => {
    const original = document.getElementById("d-reveal");
    if (!original) return;

    const clone = original.cloneNode(true) as HTMLElement;
    original.replaceWith(clone);

    async function handleClick() {
      const nodeId = new URL(window.location.href).searchParams.get("node");
      if (!nodeId) return;

      // Must happen synchronously, before any await, or popup blockers
      // silently drop it.
      const newTab = window.open("", "_blank", "noopener,noreferrer");

      try {
        const response = await fetch(`/api/node?id=${encodeURIComponent(nodeId)}&orgId=${encodeURIComponent(orgId)}`);
        const data: NodeResponse = await response.json();
        if (response.ok && data.fileUrl) {
          if (newTab) newTab.location.href = data.fileUrl;
          return;
        }
      } catch {
        // fall through to the text view below
      }

      // No stored original (ingested before migration 0006, or the
      // storage upload failed) — close the blank tab and show the
      // extracted text instead of leaving an empty tab open.
      newTab?.close();
      document.getElementById("d-read")?.click();
    }

    clone.addEventListener("click", handleClick);
    return () => clone.removeEventListener("click", handleClick);
  }, [orgId]);

  return null;
}
