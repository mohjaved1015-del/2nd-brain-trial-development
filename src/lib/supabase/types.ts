export interface Chunk {
  id: string;
  org_id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Document {
  id: string;
  org_id: string;
  source: string;
  title: string;
  raw_text: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface HybridSearchResult {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}
