-- supabase/migrations/0001_init.sql

create extension if not exists "pgcrypto";

create type competition_status as enum (
  'researching', 'registered', 'in_progress', 'submitted', 'finalist', 'completed', 'not_selected'
);

create type document_type as enum ('guidebook', 'addendum', 'template', 'other');

create type notification_status as enum ('sent', 'failed');

create type rundown_generation_mode as enum ('auto', 'manual');

create type theme_preference as enum ('light', 'dark');

create table competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  organizer text,
  theme text,
  status competition_status not null default 'researching',
  team_name text,
  instagram_url text,
  website_url text,
  registration_deadline timestamptz,
  submission_deadline timestamptz,
  event_start_at timestamptz,
  event_end_at timestamptz,
  location text,
  tags text[] not null default '{}',
  cloned_from_id uuid references competitions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index competitions_user_id_idx on competitions(user_id);

create table competition_documents (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  file_name text not null,
  cloudinary_public_id text not null,
  cloudinary_url text not null,
  doc_type document_type not null default 'guidebook',
  extracted_text text,
  uploaded_at timestamptz not null default now()
);

create index competition_documents_competition_id_idx on competition_documents(competition_id);

create table rundown_items (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  title text not null,
  description text,
  event_at timestamptz not null,
  reminder_offsets_minutes int[],
  is_auto_generated boolean not null default false,
  auto_source text,
  created_at timestamptz not null default now()
);

create index rundown_items_competition_id_idx on rundown_items(competition_id);
create index rundown_items_event_at_idx on rundown_items(event_at);

create table notification_logs (
  id uuid primary key default gen_random_uuid(),
  rundown_item_id uuid not null references rundown_items(id) on delete cascade,
  channel text not null default 'whatsapp',
  message text not null,
  status notification_status not null,
  attempt_count int not null default 1,
  sent_at timestamptz not null default now()
);

create index notification_logs_rundown_item_id_idx on notification_logs(rundown_item_id);

create table user_settings (
  id uuid primary key references auth.users(id) on delete cascade,
  whatsapp_number text,
  default_reminder_offsets_minutes int[] not null default '{1440,180}',
  timezone text not null default 'Asia/Makassar',
  rundown_generation_mode rundown_generation_mode not null default 'auto',
  theme_preference theme_preference not null default 'light'
);

-- updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger competitions_set_updated_at
  before update on competitions
  for each row execute function set_updated_at();

-- Row Level Security
alter table competitions enable row level security;
alter table competition_documents enable row level security;
alter table rundown_items enable row level security;
alter table notification_logs enable row level security;
alter table user_settings enable row level security;

create policy "competitions_owner_all" on competitions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "competition_documents_owner_all" on competition_documents
  for all using (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  );

create policy "rundown_items_owner_all" on rundown_items
  for all using (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from competitions c where c.id = competition_id and c.user_id = auth.uid())
  );

create policy "notification_logs_owner_read" on notification_logs
  for select using (
    exists (
      select 1 from rundown_items r
      join competitions c on c.id = r.competition_id
      where r.id = rundown_item_id and c.user_id = auth.uid()
    )
  );

create policy "user_settings_owner_all" on user_settings
  for all using (auth.uid() = id) with check (auth.uid() = id);
