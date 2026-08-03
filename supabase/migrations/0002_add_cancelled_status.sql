-- Add 'cancelled' status to competition_status enum
ALTER TYPE competition_status ADD VALUE IF NOT EXISTS 'cancelled';
