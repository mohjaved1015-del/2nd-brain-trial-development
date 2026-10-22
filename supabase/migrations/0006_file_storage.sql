-- Supabase Storage bucket for the ORIGINAL uploaded files (PDF/Word/text),
-- so "Show file" can open the actual document rather than only its
-- extracted text. Until now, ingestion parsed and discarded the
-- original bytes — only documents uploaded after this migration will
-- have a real file to open; earlier ones won't. See decisions/log.md.
--
-- Public bucket: acceptable given no real auth exists yet (placeholder
-- org id everywhere) - revisit (private bucket + signed URLs) once real
-- Supabase Auth is wired in.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict (id) do nothing;

alter table documents add column if not exists storage_path text;
