import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLACEHOLDER_ORG_ID } from "@/lib/constants";

/**
 * The original local tool's "Show file" button opened the file in the
 * user's own Explorer/Finder — meaningful on a personal machine, but
 * there is no local filesystem to reveal on a hosted server. Repurposed
 * into a real server-side redirect to the document's original file in
 * Supabase Storage (see src/lib/ingestion/pipeline.ts and migration
 * 0006), instead of just refusing outright.
 *
 * Deliberately a GET that redirects, not a fetch-then-window.open from
 * the client (see RevealBridge.tsx and decisions/log.md): opening a
 * blank tab and navigating it after an async step is a known pattern
 * real browsers specifically target with popup-blocking heuristics
 * (it's the classic old pop-up-ad technique) — a test with the
 * automation browser tool missed this because it's more permissive
 * about it than a real browser. Opening directly to this URL, with no
 * async step in between, works exactly like clicking a normal link and
 * isn't flagged.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const supabase = createServiceClient();
    const { data: document, error } = await supabase
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (error || !document?.storage_path) {
      return new NextResponse(
        "No original file was stored for this document — it was likely uploaded before file storage was added. Use \"Read note\" in the drawer to view its text content instead.",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }

    const fileUrl = supabase.storage.from("documents").getPublicUrl(document.storage_path).data.publicUrl;
    return NextResponse.redirect(fileUrl);
  } catch (error) {
    console.error("reveal route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
