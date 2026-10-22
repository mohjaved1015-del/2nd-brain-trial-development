import { NextRequest, NextResponse } from "next/server";
import { buildGraph } from "@/lib/graph/build";
import { PLACEHOLDER_ORG_ID } from "@/lib/constants";

/**
 * Serves the 3D-Brain renderer's graph data. The renderer calls this on
 * load, and again with ?rebuild=1 when its "Rebuild" action runs — both
 * just rebuild from Supabase each time, since there's no local cache to
 * invalidate the way the original tool had.
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;
  try {
    const graph = await buildGraph(orgId);
    return NextResponse.json(graph, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("graph route failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
