import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@/lib/ingestion/pipeline";

/**
 * Ingestion endpoint. orgId is a placeholder the same way it is in the
 * chat route — swap for the authenticated session's org once Supabase
 * Auth is wired in.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const orgId = formData.get("orgId");
    const source = formData.get("source");
    const file = formData.get("file");

    if (typeof orgId !== "string" || typeof source !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "orgId, source, and file are required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestDocument({
      orgId,
      source,
      title: file.name,
      file: buffer,
      filename: file.name,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("ingest route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
