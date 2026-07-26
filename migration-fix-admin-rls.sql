-- Fix: the original "Admins can manage profiles" policy checked admin status
-- by querying the profiles table from within a policy ON the profiles table
-- itself. Postgres can't safely resolve that self-reference, so the check
-- silently failed for everyone, regardless of their actual role.
--
-- Run this once in Supabase SQL Editor.

-- A small helper function that checks admin status. Because it's SECURITY
-- DEFINER, it runs with elevated privileges and bypasses RLS internally,
-- which breaks the recursive loop.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Replace the broken policy with one that uses the safe helper function
drop policy if exists "Admins can manage profiles" on public.profiles;

create policy "Admins can manage profiles"
  on public.profiles for all
  using (public.is_admin());
