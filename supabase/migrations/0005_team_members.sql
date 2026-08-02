-- supabase/migrations/0005_team_members.sql

alter table competitions add column if not exists team_members text[] not null default '{}';
notify pgrst, 'reload schema';
