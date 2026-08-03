-- Create chat_sessions table for multi-session AI chat management
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Percakapan Baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_competition_id_idx on chat_sessions(competition_id);
create index if not exists chat_sessions_user_id_idx on chat_sessions(user_id);

alter table chat_sessions enable row level security;

create policy "chat_sessions_owner_all" on chat_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add session_id column to chat_messages table
alter table chat_messages add column if not exists session_id uuid references chat_sessions(id) on delete cascade;
create index if not exists chat_messages_session_id_idx on chat_messages(session_id);
