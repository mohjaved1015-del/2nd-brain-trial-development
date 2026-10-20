import { createServiceClient } from "@/lib/supabase/server";
import type { SearchResult } from "@/lib/supabase/types";

/**
 * Calls the `keyword_search` Postgres function (pure full-text ranking —
 * see supabase/migrations/0003_keyword_search.sql). No embeddings vendor
 * involved, no extra API key, scales as an org's document count grows.
 *
 * This replaced vector+hybrid search (see decisions/log.md): the
 * `hybrid_search` SQL function from migration 0002 is left in place,
 * unused, as the documented path back to it once there's a reason to pay
 * for an embeddings vendor again.
 *
 * Known limitation: a follow-up question like "what about electronics?"
 * won't retrieve well on its own, since this searches only the literal
 * words in `query` — it doesn't resolve pronouns/ellipsis against earlier
 * turns. Conversation history is passed to generation (see
 * generation/answer.ts) but not yet used to reformulate the search query.
 */
export async function keywordSearch(
  orgId: string,
  query: string,
  matchCount = 40,
): Promise<SearchResult[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("keyword_search", {
    query_org_id: orgId,
    query_text: query,
    match_count: matchCount,
  });

  if (error) throw new Error(`keyword_search failed: ${error.message}`);
  return data ?? [];
}
