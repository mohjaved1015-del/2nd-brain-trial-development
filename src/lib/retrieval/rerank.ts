import type { HybridSearchResult } from "@/lib/supabase/types";

/**
 * Reranking stage, deliberately separate from hybridSearch so the reranker
 * can be swapped without touching candidate generation.
 *
 * NOT YET IMPLEMENTED: per decisions/log.md (2026-10-20), the plan is a
 * local cross-encoder (not Cohere Rerank, to avoid a third paid vendor +
 * extra latency hop before there's real traffic to justify it). Until that
 * model is wired in, this just truncates to topK in the hybrid-search order
 * — i.e. reranking is a no-op. Replace the body, keep the signature.
 */
export async function rerank(
  query: string,
  candidates: HybridSearchResult[],
  topK = 8,
): Promise<HybridSearchResult[]> {
  return candidates.slice(0, topK);
}
