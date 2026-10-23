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

/** Keeps only characters safe in a Supabase Storage path / public URL. */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Supabase Storage defaults an upload's content-type to `text/plain` when
 * none is given — fine for the extracted text, but the original PDF/Word/
 * image upload was going through with no contentType option at all, so
 * every original file was stored as `text/plain` regardless of its real
 * type. The browser then has no way to know it's a PDF or a .docx, so
 * "Show file" opened garbled raw bytes as text instead of rendering the
 * PDF inline or downloading the Word file properly. Fixed by deriving the
 * real MIME type from the extension and passing it on upload.
 */
function contentTypeFor(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain",
    md: "text/markdown",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return byExt[ext] ?? "application/octet-stream";
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

  // document + chunks insert happens atomically in one Postgres function
  // call (migration 0008) — a document with zero extractable chunks is
  // rejected outright, and a failure partway through can't leave an
  // orphaned document with no chunks, since the whole call is one
  // transaction.
  const { data: documentId, error: ingestError } = await supabase.rpc("ingest_document", {
    p_org_id: orgId,
    p_source: source,
    p_title: title,
    p_raw_text: rawText,
    p_chunks: chunks.map((chunk) => ({ chunk_index: chunk.index, content: chunk.content })),
  });

  if (ingestError || !documentId) {
    throw new Error(`Failed to ingest document: ${ingestError?.message ?? "no document id returned"}`);
  }

  // Best-effort: a failed original-file upload shouldn't fail the whole
  // ingestion, since the document's text content (the part retrieval and
  // chat actually depend on) is already safely stored either way.
  const storagePath = `${orgId}/${documentId}-${sanitizeFilename(filename)}`;
  const { error: storageError } = await supabase.storage
    .from("documents")
    .upload(storagePath, originalFile, { contentType: contentTypeFor(filename) });
  if (!storageError) {
    await supabase.from("documents").update({ storage_path: storagePath }).eq("id", documentId);
  } else {
    console.error("Failed to store original file (text content was still saved):", storageError.message);
  }

  return { documentId, chunkCount: chunks.length };
}
