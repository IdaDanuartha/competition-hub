-- Create chat_messages table to store AI Guidebook chat history in Supabase
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model_used text,
  has_pdf boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_competition_id_idx on chat_messages(competition_id);
create index if not exists chat_messages_user_id_idx on chat_messages(user_id);

alter table chat_messages enable row level security;

create policy "chat_messages_owner_all" on chat_messages
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
