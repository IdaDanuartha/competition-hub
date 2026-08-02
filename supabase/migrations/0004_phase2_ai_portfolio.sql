-- supabase/migrations/0004_phase2_ai_portfolio.sql

create table ai_summaries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  summary text not null,
  key_requirements text[] not null default '{}',
  important_dates text[] not null default '{}',
  judging_criteria text[] not null default '{}',
  theme_and_subtheme text,
  project_idea_suggestions jsonb not null default '[]'::jsonb,
  model_used text not null default 'gemini-2.5-flash',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competition_id)
);

create index ai_summaries_competition_id_idx on ai_summaries(competition_id);

create table portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  tags text[] not null default '{}',
  tech_stack text[] not null default '{}',
  used_in_competitions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portfolio_entries_user_id_idx on portfolio_entries(user_id);

create trigger ai_summaries_set_updated_at
  before update on ai_summaries
  for each row execute function set_updated_at();

create trigger portfolio_entries_set_updated_at
  before update on portfolio_entries
  for each row execute function set_updated_at();

-- RLS
alter table ai_summaries enable row level security;
alter table portfolio_entries enable row level security;

create policy "ai_summaries_owner_all" on ai_summaries
  for all using (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  );

create policy "portfolio_entries_owner_all" on portfolio_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
