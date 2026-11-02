-- Minimal stand-ins for the Supabase platform objects the real migrations depend on.
-- Used ONLY in the disposable Docker database (scripts/test-import-function.mjs). Never run against a real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;  -- as on Supabase: service_role bypasses RLS
grant anon, authenticated, service_role to postgres;

create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;

-- Supabase's default privileges: application roles receive grants on new objects in public; RLS restricts rows.
-- This matters for the audit: a newly created function is EXECUTE-able by anon/authenticated unless revoked.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
