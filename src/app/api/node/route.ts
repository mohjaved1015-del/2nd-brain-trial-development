import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// TODO: replace with the signed-in user's actual org_id once Supabase Auth is wired in.
const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Serves one document's full text for the renderer's note-reading drawer,
 * plus a link to the original file (fileUrl) when one was stored —
 * see src/lib/ingestion/pipeline.ts and migration 0006. `id` is the
 * document's row id (see src/lib/graph/build.ts — node.path is set to
 * the document id for exactly this lookup).
 *
 * Scoped to orgId as well as id: this uses the service-role client, which
 * bypasses RLS, so without this check any guessed/known document id would
 * be readable regardless of which org's graph page requested it.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, raw_text, storage_path")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (error || !document) return NextResponse.json({ error: "Unknown document" }, { status: 404 });

  const fileUrl = document.storage_path
    ? supabase.storage.from("documents").getPublicUrl(document.storage_path).data.publicUrl
    : null;

  return NextResponse.json({ id: document.id, markdown: document.raw_text, path: document.id, fileUrl });
}
