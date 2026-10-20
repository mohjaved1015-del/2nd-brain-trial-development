-- Hybrid retrieval: vector similarity + keyword full-text, merged with
-- Reciprocal Rank Fusion. Pure vector search misses exact-match terms
-- (product codes, names, specific phrases); pure keyword search misses
-- paraphrases. RRF merge avoids needing to tune a blend weight by hand.
create or replace function hybrid_search(
  query_org_id uuid,
  query_embedding vector(1536),
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
  with vector_matches as (
    select
      c.id,
      row_number() over (order by c.embedding <=> query_embedding) as rank
    from chunks c
    where c.org_id = query_org_id
    order by c.embedding <=> query_embedding
    limit match_count
  ),
  keyword_matches as (
    select
      c.id,
      row_number() over (
        order by ts_rank(to_tsvector('english', c.content), websearch_to_tsquery('english', query_text)) desc
      ) as rank
    from chunks c
    where c.org_id = query_org_id
      and to_tsvector('english', c.content) @@ websearch_to_tsquery('english', query_text)
    limit match_count
  ),
  fused as (
    select
      coalesce(v.id, k.id) as id,
      -- RRF: 1 / (k + rank), k=60 is the standard constant from the original RRF paper
      coalesce(1.0 / (60 + v.rank), 0) + coalesce(1.0 / (60 + k.rank), 0) as score
    from vector_matches v
    full outer join keyword_matches k on v.id = k.id
  )
  select
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    f.score
  from fused f
  join chunks c on c.id = f.id
  order by f.score desc
  limit match_count;
$$;
