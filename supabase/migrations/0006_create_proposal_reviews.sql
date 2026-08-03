-- Create proposal_reviews table for storing AI proposal and pitch deck reviews
create table if not exists proposal_reviews (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  file_name text not null,
  overall_score integer not null,
  summary text not null,
  criteria_scores jsonb not null default '[]'::jsonb,
  strengths text[] not null default '{}'::text[],
  weaknesses text[] not null default '{}'::text[],
  actionable_recommendations text[] not null default '{}'::text[],
  model_used text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_proposal_reviews_competition_id on proposal_reviews(competition_id);

alter table proposal_reviews disable row level security;

