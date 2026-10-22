import { NextRequest, NextResponse } from "next/server";
import { ingestFromUrl } from "@/lib/ingestion/pipeline";

/**
 * Link-based ingestion, used by the chat panel's "paste a link" upload
 * path. orgId is a placeholder the same way it is in the other routes —
 * swap for the authenticated session's org once Supabase Auth is wired
 * in.
 */
export async function POST(request: NextRequest) {
  const { orgId, source, url } = (await request.json()) as {
    orgId?: string;
    source?: string;
    url?: string;
  };

  if (!orgId || !url) {
    return NextResponse.json({ error: "orgId and url are required" }, { status: 400 });
  }

  try {
    const result = await ingestFromUrl(orgId, source ?? "link", url);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ingest-url route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
