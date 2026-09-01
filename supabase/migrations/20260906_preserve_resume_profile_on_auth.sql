-- Migration: 20260906_preserve_resume_profile_on_auth.sql
-- Purpose: Prevent Google Auth login from overwriting user's verified resume profile data.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  raw_name text;
  first_n text;
  last_n text;
begin
  raw_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  first_n := coalesce(new.raw_user_meta_data->>'first_name', split_part(raw_name, ' ', 1));
  last_n := coalesce(new.raw_user_meta_data->>'last_name', nullif(substring(raw_name from ' (.+)'), ''));

  insert into public.profiles (user_id, email, first_name, last_name, updated_at)
  values (
    new.id::text,
    new.email,
    nullif(first_n, ''),
    nullif(last_n, ''),
    timezone('utc'::text, now())
  )
  on conflict (user_id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    -- CRITICAL FIX: Preserve verified profile names (from uploaded resumes) instead of overwriting with Google Auth
    first_name = coalesce(public.profiles.first_name, excluded.first_name),
    last_name = coalesce(public.profiles.last_name, excluded.last_name),
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;
