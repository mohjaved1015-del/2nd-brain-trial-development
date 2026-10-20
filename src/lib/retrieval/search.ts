import { createServiceClient } from "@/lib/supabase/server";
import { embedTexts } from "@/lib/ingestion/embed";
import type { HybridSearchResult } from "@/lib/supabase/types";

/**
 * Calls the `hybrid_search` Postgres function (vector + full-text, RRF
 * merged — see supabase/migrations/0002_hybrid_search.sql). This is the
 * candidate-generation stage; results still need reranking (see
 * ./rerank.ts) before they're trustworthy enough to hand to the LLM.
 */
export async function hybridSearch(
  orgId: string,
  query: string,
  matchCount = 40,
): Promise<HybridSearchResult[]> {
  const [queryEmbedding] = await embedTexts([query]);
  if (!queryEmbedding) throw new Error("Failed to embed query text");

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("hybrid_search", {
    query_org_id: orgId,
    query_embedding: queryEmbedding,
    query_text: query,
    match_count: matchCount,
  });

  if (error) throw new Error(`hybrid_search failed: ${error.message}`);
  return data ?? [];
}
