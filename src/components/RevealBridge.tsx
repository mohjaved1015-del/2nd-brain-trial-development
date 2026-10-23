"use client";

import { useEffect } from "react";

/**
 * Redirects the renderer's "Show file" button to actually open the
 * original uploaded file (PDF/Word/etc., from Supabase Storage — see
 * src/lib/ingestion/pipeline.ts and migration 0006) in a new tab,
 * instead of its original job: opening the file in the local OS file
 * explorer, which /api/reveal deliberately refuses (no local filesystem
 * to reveal on a hosted server).
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
 *    of success) was still firing alongside this one. A capturing-phase
 *    listener does NOT reliably run before a bubble-phase listener on
 *    the *same* element — that ordering only applies across different
 *    elements in the propagation path (an ancestor vs. the target). Two
 *    listeners on one element fire in registration order regardless of
 *    capture, and app.js's listener was registered first (at page
 *    load). Fixed by cloning the button (drops every listener
 *    previously attached to it, including app.js's — clones never carry
 *    `addEventListener` listeners) and attaching only this one to the
 *    clone. app.js still finds the clone fine via `getElementById`
 *    elsewhere (e.g. toggling it `.hidden` based on node kind), since it
 *    always re-queries by id rather than holding a stored reference.
 * 2. The first fix attempt opened a blank tab synchronously, then async-
 *    fetched the file info and navigated that tab once it resolved —
 *    but real browsers specifically target "open blank, redirect later"
 *    with popup-blocking heuristics (it's the classic old pop-up-ad
 *    technique). The automation browser tool used to test this was more
 *    permissive about it, so that test passed while real browsers still
 *    silently blocked it. Fixed by opening directly to a real URL
 *    (`/api/reveal`) with no async step in between at all — exactly how
 *    a normal link click works, never flagged. The server resolves the
 *    file and redirects, or returns an explanatory message if no
 *    original was stored (documents ingested before migration 0006).
 * 3. Even called synchronously with a real URL and no async step,
 *    `window.open()` is still the popup API — browsers are free to
 *    treat any JS-initiated `window.open` as a popup and block it
 *    silently (no console error, nothing to debug), and some are
 *    stricter about this than others, which is exactly why this kept
 *    reproducing in MJ's real browser specifically. Confirmed directly:
 *    testing this build, the browser tool itself reported blocking the
 *    `window.open` call as a popup. A real `<a href target="_blank">`
 *    click is not a popup to any browser — it is the standard
 *    navigation path — so this now builds a real anchor element and
 *    clicks it instead of calling `window.open` at all.
 */
export function RevealBridge({ orgId }: { orgId: string }) {
  useEffect(() => {
    const original = document.getElementById("d-reveal");
    if (!original) return;

    const clone = original.cloneNode(true) as HTMLElement;
    original.replaceWith(clone);

    function handleClick() {
      const nodeId = new URL(window.location.href).searchParams.get("node");
      if (!nodeId) return;
      const link = document.createElement("a");
      link.href = `/api/reveal?id=${encodeURIComponent(nodeId)}&orgId=${encodeURIComponent(orgId)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    clone.addEventListener("click", handleClick);
    return () => clone.removeEventListener("click", handleClick);
  }, [orgId]);

  return null;
}
