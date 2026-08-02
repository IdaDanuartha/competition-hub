-- supabase/migrations/0007_ai_summary_execution_log.sql
-- generate-ai-summary/route.ts writes execution_log/execution_time_ms/pdf_size_kb
-- to ai_summaries, but no migration ever added these columns.

alter table ai_summaries
  add column if not exists execution_log text[] not null default '{}',
  add column if not exists execution_time_ms integer,
  add column if not exists pdf_size_kb integer;
