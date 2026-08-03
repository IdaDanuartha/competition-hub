-- Add gemini_api_keys text array to user_settings for multi-key failover
alter table user_settings add column if not exists gemini_api_keys text[];
