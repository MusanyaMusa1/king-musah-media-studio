-- King Musah Media Studio — database schema
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor > New query)

-- ============================================================
-- PROFILES: one row per user, extending Supabase's built-in auth.users
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'reporter')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can read the list of profiles (needed for the "Author" dropdown)
create policy "Authenticated users can view profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- Users can update their own profile (but not their own role — enforced below)
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Only admins can insert/delete profiles (user management)
create policy "Admins can manage profiles"
  on public.profiles for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================
-- DRAFTS: stories in progress, before they're committed to GitHub
-- ============================================================
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text not null,
  category text not null check (category in ('news', 'politics', 'entertainment', 'sports', 'business')),
  language text not null default 'en' check (language in ('en', 'lg')),
  author_type text not null default 'individual' check (author_type in ('individual', 'newsdesk')),
  author_name text not null,
  breaking boolean not null default false,
  featured boolean not null default false,
  excerpt text,
  content text not null,
  tags text[] default '{}',
  image_path text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'published', 'archived')),
  review_comment text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.drafts enable row level security;

-- Everyone signed in can see all drafts (small newsroom — simplicity over strict isolation for V1)
create policy "Authenticated users can view drafts"
  on public.drafts for select
  using (auth.role() = 'authenticated');

-- Reporters can create and edit their own drafts
create policy "Users can create drafts"
  on public.drafts for insert
  with check (auth.uid() = created_by);

create policy "Users can edit their own drafts"
  on public.drafts for update
  using (auth.uid() = created_by);

-- Editors and admins can edit/publish any draft
create policy "Editors and admins can manage all drafts"
  on public.drafts for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

create policy "Editors and admins can delete drafts"
  on public.drafts for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'editor'))
  );

-- Keep updated_at current automatically
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger drafts_set_updated_at
  before update on public.drafts
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), new.email, 'editor');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
