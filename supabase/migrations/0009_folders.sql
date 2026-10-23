-- Manual folder organization (MJ's explicit direction over automatic
-- keyword/embedding-based linking, see decisions/log.md): documents get
-- placed into a nested folder path by hand, and two documents link to
-- each other only when they sit in the exact same folder. "" (empty
-- string) means the document hasn't been filed anywhere yet — kept as a
-- plain string column, not a separate folders table, since the only
-- operations needed are "read a document's path" and "set a document's
-- path"; no folder-level metadata (ids, ordering) exists yet to justify
-- a normalized table.
alter table documents add column if not exists folder_path text not null default '';

create index if not exists documents_folder_path_idx on documents (org_id, folder_path);
