import { createServiceClient } from "@/lib/supabase/server";
import { parseDocument } from "./parse";
import { chunkText } from "./chunk";

export interface IngestOptions {
  orgId: string;
  source: string;
  title: string;
  file: Buffer;
  filename: string;
}

/**
 * The one swappable seam the architecture doc calls for: trial data today,
 * real customer sources (Drive, CRM, email) later, all through this same
 * parse -> chunk -> store pipeline.
 *
 * No embedding step: retrieval is keyword-only for now (see
 * retrieval/search.ts and decisions/log.md), so chunks are stored without
 * an embedding. The `chunks.embedding` column stays nullable for when
 * vector search comes back.
 */
export async function ingestDocument({ orgId, source, title, file, filename }: IngestOptions) {
  const rawText = await parseDocument(file, filename);
  const chunks = chunkText(rawText);

  const supabase = createServiceClient();

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({ org_id: orgId, source, title, raw_text: rawText })
    .select("id")
    .single();

  if (documentError || !document) {
    throw new Error(`Failed to insert document: ${documentError?.message}`);
  }

  const rows = chunks.map((chunk) => ({
    org_id: orgId,
    document_id: document.id,
    chunk_index: chunk.index,
    content: chunk.content,
  }));

  const { error: chunksError } = await supabase.from("chunks").insert(rows);
  if (chunksError) throw new Error(`Failed to insert chunks: ${chunksError.message}`);

  return { documentId: document.id, chunkCount: rows.length };
}
