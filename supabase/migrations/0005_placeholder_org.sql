-- Every table with an org_id foreign key (documents, chunks, conversations,
-- chat_messages) requires a matching row in organizations. Nothing had
-- created one yet for the placeholder org id the app currently uses
-- everywhere (see the TODOs about real Supabase Auth across the API
-- routes) — this would have failed on the first real insert to any of
-- those tables, not just conversations where it was first caught.
insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000000', 'Trial Org')
on conflict (id) do nothing;
