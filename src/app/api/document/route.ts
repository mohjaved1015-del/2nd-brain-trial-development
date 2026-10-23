import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLACEHOLDER_ORG_ID } from "@/lib/constants";

/**
 * Lightweight listing for the "Manage files" panel — just enough to
 * render and file a flat list of documents into a folder tree, not the
 * full raw_text (that's what /api/node is for, per-document).
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, folder_path, created_at")
    .eq("org_id", orgId)
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] });
}

/**
 * Sets one document's folder_path (migration 0009) — the manual-folder
 * approach MJ chose over automatic keyword/embedding linking: two
 * documents connect in the graph only when they share the exact same
 * folder_path (see src/lib/graph/build.ts).
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, folderPath } = body as { id?: string; folderPath?: string };
    const orgId = typeof body.orgId === "string" ? body.orgId : PLACEHOLDER_ORG_ID;

    if (!id || typeof folderPath !== "string") {
      return NextResponse.json({ error: "id and folderPath are required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("documents")
      .update({ folder_path: normalizeFolderPath(folderPath) })
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("document patch failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Trims stray slashes/whitespace so "HR/", "/HR", " HR / Policies " all land as "HR/Policies". */
function normalizeFolderPath(path: string): string {
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

/**
 * Admin delete, added one-off to clean up duplicate documents left behind
 * when the 10 trial docs were re-ingested to pick up the storage
 * content-type fix (see src/lib/ingestion/pipeline.ts). No UI calls this
 * yet — it's a direct API action. chunks cascade on document delete
 * (migration 0001), so deleting the row is enough on the DB side; the
 * storage object (if any) is removed separately since storage isn't
 * covered by that cascade.
 */
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const supabase = createServiceClient();
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError || !document) return NextResponse.json({ error: "Unknown document" }, { status: 404 });

    if (document.storage_path) {
      await supabase.storage.from("documents").remove([document.storage_path]);
    }

    const { error: deleteError } = await supabase.from("documents").delete().eq("id", id).eq("org_id", orgId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("document delete failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
