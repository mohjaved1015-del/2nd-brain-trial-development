import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Serves one document's full text for the renderer's note-reading drawer.
 * `id` is the document's row id (see src/lib/graph/build.ts — node.path
 * is set to the document id for exactly this lookup).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const supabase = createServiceClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, raw_text")
    .eq("id", id)
    .single();

  if (error || !document) return NextResponse.json({ error: "Unknown document" }, { status: 404 });

  return NextResponse.json({ id: document.id, markdown: document.raw_text, path: document.id });
}
