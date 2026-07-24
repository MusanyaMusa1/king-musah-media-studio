-- Migration: add the "date" column that was missing from the original schema.
-- Run this once in Supabase SQL Editor if you already ran supabase-schema.sql
-- before this fix. (If you're setting up fresh, supabase-schema.sql now
-- includes this column already — you don't need to run this separately.)

alter table public.drafts
  add column if not exists date date not null default current_date;
