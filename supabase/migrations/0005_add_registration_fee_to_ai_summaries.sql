-- Add registration_fee and logging columns to ai_summaries table
alter table ai_summaries add column if not exists registration_fee text;
alter table ai_summaries add column if not exists execution_log text[];
alter table ai_summaries add column if not exists execution_time_ms integer;
alter table ai_summaries add column if not exists pdf_size_kb integer;
