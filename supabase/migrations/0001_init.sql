-- Initial schema: multi-tenant from day one, even though only one test org
-- exists right now. Retrofitting tenant isolation after real customer data
-- lands is far more painful than building it in up front.

create extension if not exists vector;
create extension if not exists pg_trgm; -- supports fast ILIKE / fuzzy matching alongside full-text search

-- One row per customer organization.
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Supabase auth users, mapped to an organization and a role within it.
create table org_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

create index org_members_org_id_idx on org_members (org_id);

-- A source document before chunking (one row per uploaded/ingested file).
create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  source text not null, -- e.g. 'upload', 'drive', 'confluence' — ingestion origin, kept distinct from delivery channels
  title text not null,
  raw_text text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index documents_org_id_idx on documents (org_id);

-- Chunked + embedded segments of a document. This is what retrieval queries.
create table chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  document_id uuid not null references documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding vector(1536), -- matches OpenAI text-embedding-3-small; revisit if the embeddings model changes
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index chunks_org_id_idx on chunks (org_id);
create index chunks_document_id_idx on chunks (document_id);

-- Vector similarity index (cosine distance, matches text-embedding-3-small's normalized output).
create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

-- Full-text index for the keyword half of hybrid search.
create index chunks_content_fts_idx on chunks using gin (to_tsvector('english', content));

-- Row-Level Security: every table scoped to the caller's org from day one.
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table documents enable row level security;
alter table chunks enable row level security;

-- Helper: the calling user's org_id, read once per statement.
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from org_members where user_id = auth.uid()
$$;

create policy "members see their own org" on organizations
  for select using (id = current_org_id());

create policy "members see their own membership rows" on org_members
  for select using (org_id = current_org_id());

create policy "members read their org's documents" on documents
  for select using (org_id = current_org_id());

create policy "members write their org's documents" on documents
  for insert with check (org_id = current_org_id());

create policy "members read their org's chunks" on chunks
  for select using (org_id = current_org_id());

create policy "members write their org's chunks" on chunks
  for insert with check (org_id = current_org_id());
