import { NextRequest, NextResponse } from "next/server";
import { buildGraph } from "@/lib/graph/build";

// TODO: replace with the signed-in user's actual org_id once Supabase Auth is wired in.
const PLACEHOLDER_ORG_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Serves the 3D-Brain renderer's graph data. The renderer calls this on
 * load, and again with ?rebuild=1 when its "Rebuild" action runs — both
 * just rebuild from Supabase each time, since there's no local cache to
 * invalidate the way the original tool had.
 */
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") ?? PLACEHOLDER_ORG_ID;
  const graph = await buildGraph(orgId);
  return NextResponse.json(graph, { headers: { "cache-control": "no-store" } });
}
