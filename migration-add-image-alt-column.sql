-- Migration: add the image_alt column, used when actually publishing to the
-- live site (accessibility + SEO text for the story's photo).
-- Run this once in Supabase SQL Editor.

alter table public.drafts
  add column if not exists image_alt text;
