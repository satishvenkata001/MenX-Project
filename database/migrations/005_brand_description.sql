-- Migration 005: Add description column to brands table if not exists
ALTER TABLE brands ADD COLUMN IF NOT EXISTS description TEXT;
