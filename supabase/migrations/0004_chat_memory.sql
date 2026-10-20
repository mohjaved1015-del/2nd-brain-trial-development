-- Persisted conversation memory: chat history survives a page refresh
-- and can be resumed, instead of living only in browser state (the
-- previous behavior — see decisions/log.md).
create table conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index conversations_org_id_idx on conversations (org_id);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  org_id uuid not null references organizations (id) on delete cascade, -- denormalized: lets RLS and direct queries scope by org without a join
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]', -- cited SearchResult[] for assistant messages, [] for user messages
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_id_idx on chat_messages (conversation_id);
create index chat_messages_org_id_idx on chat_messages (org_id);

alter table conversations enable row level security;
alter table chat_messages enable row level security;

-- Reuses current_org_id() from migration 0001.
create policy "members read their org's conversations" on conversations
  for select using (org_id = current_org_id());

create policy "members write their org's conversations" on conversations
  for insert with check (org_id = current_org_id());

create policy "members update their org's conversations" on conversations
  for update using (org_id = current_org_id());

create policy "members read their org's chat messages" on chat_messages
  for select using (org_id = current_org_id());

create policy "members write their org's chat messages" on chat_messages
  for insert with check (org_id = current_org_id());
