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
  storage_path: string | null;
  folder_path: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SearchResult {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
}

export interface Conversation {
  id: string;
  org_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  org_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SearchResult[];
  created_at: string;
}
