-- Keyword-only search, replacing hybrid_search (0002) as the retrieval
-- method for now. No embeddings vendor, no extra API key, scales fine as
-- an org's document count grows — pure Postgres full-text ranking.
--
-- hybrid_search() from 0002 is left in place, unused, as the documented
-- path back to vector+keyword search once there's a reason to pay for an
-- embeddings vendor again (see decisions/log.md).
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
    ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', query_text)) as score
  from chunks c
  where c.org_id = query_org_id
    and to_tsvector('english', c.content) @@ websearch_to_tsquery('english', query_text)
  order by score desc
  limit match_count;
$$;
