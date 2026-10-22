-- Part 3 review findings (see decisions/log.md):
-- A. A document that parses to zero chunks (empty/unparseable text) was
--    silently created anyway — a permanently unsearchable "ghost" node
--    with no warning.
-- C. The document insert and its chunks insert were two separate JS
--    calls, not one transaction — if the chunks insert failed after the
--    document insert succeeded, the document was left orphaned with no
--    chunks (same symptom as A, different cause).
--
-- A single Postgres function call is implicitly one transaction: any
-- exception inside rolls back everything in it automatically. This
-- fixes both at once — the zero-chunks check and the two inserts all
-- happen atomically, in the database, not as sequential round-trips
-- from the app that could fail partway through.
create or replace function ingest_document(
  p_org_id uuid,
  p_source text,
  p_title text,
  p_raw_text text,
  p_chunks jsonb -- array of {chunk_index: int, content: text}
)
returns uuid
language plpgsql
as $$
declare
  v_document_id uuid;
begin
  if jsonb_array_length(p_chunks) = 0 then
    raise exception 'Cannot ingest a document with no extractable text (zero chunks)';
  end if;

  insert into documents (org_id, source, title, raw_text)
  values (p_org_id, p_source, p_title, p_raw_text)
  returning id into v_document_id;

  insert into chunks (org_id, document_id, chunk_index, content)
  select p_org_id, v_document_id, (c ->> 'chunk_index')::int, c ->> 'content'
  from jsonb_array_elements(p_chunks) as c;

  return v_document_id;
end;
$$;
