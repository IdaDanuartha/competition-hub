-- Add registration_fee column to ai_summaries table
alter table ai_summaries add column if not exists registration_fee text;
