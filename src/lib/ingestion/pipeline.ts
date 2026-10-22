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

export interface IngestResult {
  documentId: string;
  chunkCount: number;
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
 *
 * Also uploads the original file to Supabase Storage (the "documents"
 * bucket, migration 0006) so "Show file" can open the real PDF/Word/etc.
 * document, not just its extracted text. Documents ingested before this
 * existed have no stored original — storage_path stays null for them.
 */
export async function ingestDocument({ orgId, source, title, file, filename }: IngestOptions): Promise<IngestResult> {
  const rawText = await parseDocument(file, filename);
  return storeDocument(orgId, source, title, rawText, file, filename);
}

/**
 * Fetches a URL server-side and runs it through the same pipeline as a
 * direct upload. Scoped to direct file links (a PDF/Word/text/image URL
 * a server can fetch and parse) — not a general web-page scraper. A link
 * to an ordinary web page will still get "parsed" as whatever raw bytes
 * come back, which may not produce useful text; that's a known limit,
 * not a bug to chase here.
 */
export async function ingestFromUrl(orgId: string, source: string, url: string): Promise<IngestResult> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = new URL(url).pathname.split("/").pop() || "linked-document";
  const rawText = await parseDocument(buffer, filename);

  return storeDocument(orgId, source, filename, rawText, buffer, filename);
}

async function storeDocument(
  orgId: string,
  source: string,
  title: string,
  rawText: string,
  originalFile: Buffer,
  filename: string,
): Promise<IngestResult> {
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

  // Best-effort: a failed original-file upload shouldn't fail the whole
  // ingestion, since the document's text content (the part retrieval and
  // chat actually depend on) is already safely stored either way.
  const storagePath = `${orgId}/${document.id}-${filename}`;
  const { error: storageError } = await supabase.storage.from("documents").upload(storagePath, originalFile);
  if (!storageError) {
    await supabase.from("documents").update({ storage_path: storagePath }).eq("id", document.id);
  } else {
    console.error("Failed to store original file (text content was still saved):", storageError.message);
  }

  return { documentId: document.id, chunkCount: rows.length };
}
