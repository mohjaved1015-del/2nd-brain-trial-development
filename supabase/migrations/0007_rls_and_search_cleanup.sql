-- Part 1 review findings (see decisions/log.md):
-- 1. Add missing UPDATE/DELETE RLS policies — only SELECT/INSERT existed
--    before. Harmless today (every write goes through the service-role
--    client, which bypasses RLS), but matters once a real RLS-respecting
--    user write path exists.
-- 3. Replace keyword_search's double to_tsvector computation (once to
--    match, once to rank) with a generated, stored tsvector column +
--    index — the standard Postgres pattern, computed once at write time
--    instead of twice per search.

alter table chunks add column if not exists content_tsv tsvector
  generated always as (to_tsvector('english', content)) stored;

drop index if exists chunks_content_fts_idx;
create index if not exists chunks_content_tsv_idx on chunks using gin (content_tsv);

create or replace function keyword_search(
  query_org_id uuid,
  query_text text,
  match_count int default 40
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  score float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    ts_rank(c.content_tsv, websearch_to_tsquery('english', query_text)) as score
  from chunks c
  where c.org_id = query_org_id
    and c.content_tsv @@ websearch_to_tsquery('english', query_text)
  order by score desc
  limit match_count;
$$;

create policy "members update their org's documents" on documents
  for update using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "members delete their org's documents" on documents
  for delete using (org_id = current_org_id());

create policy "members update their org's chunks" on chunks
  for update using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "members delete their org's chunks" on chunks
  for delete using (org_id = current_org_id());

create policy "members delete their org's conversations" on conversations
  for delete using (org_id = current_org_id());

create policy "members update their org's chat_messages" on chat_messages
  for update using (org_id = current_org_id()) with check (org_id = current_org_id());

create policy "members delete their org's chat_messages" on chat_messages
  for delete using (org_id = current_org_id());
