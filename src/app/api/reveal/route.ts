import { NextResponse } from "next/server";

/**
 * The original local tool's "Show file" button opened the file in the
 * user's own Explorer/Finder — meaningful on a personal machine, but
 * there is no local filesystem to reveal on a hosted server, and
 * spawning OS processes from a server endpoint would be a real security
 * hole regardless. Disabled outright rather than ported.
 */
export async function GET() {
  return NextResponse.json({ error: "Not available in the hosted version." }, { status: 404 });
}
