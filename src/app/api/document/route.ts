import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { PLACEHOLDER_ORG_ID } from "@/lib/constants";

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
