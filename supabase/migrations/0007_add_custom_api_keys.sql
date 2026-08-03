-- Add custom API keys for Gemini and OpenAI to user_settings table
alter table user_settings add column if not exists gemini_api_key text;
alter table user_settings add column if not exists openai_api_key text;

alter table user_settings disable row level security;
