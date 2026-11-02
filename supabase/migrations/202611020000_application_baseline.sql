-- =============================================================================
-- FEELING FIND — database setup
-- Proposed baseline for a fresh project. Review existing objects before applying.
-- Existing name collisions fail rather than replacing policies, triggers or functions.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PROFILES — one row per user (name, age, city, needs ...)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text,
  gender            text,
  age               int check (age is null or age between 13 and 120),
  city              text,
  country           text,
  needs             text[] not null default '{}',
  disability_info   text,
  use_needs_in_chat boolean not null default false,  -- user's consent to personalise chat
  updated_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Security rules: a user can only see and change THEIR OWN profile.
create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Users can create their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "Users can update their own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- Automatically create an empty profile when someone creates an account.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. USER FILES — metadata for each uploaded file (name, type, size, upload date)
--    The file itself lives in Storage (bucket "user-files", see section 4).
-- -----------------------------------------------------------------------------
create table public.user_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  size_bytes   bigint,
  uploaded_at  timestamptz not null default now()
);

create index user_files_user_id_idx on public.user_files (user_id);
alter table public.user_files enable row level security;

create policy "Users can view their own files" on public.user_files
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users can add their own files" on public.user_files
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users can delete their own files" on public.user_files
  for delete to authenticated using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 3. CLOTHING ITEMS — the catalogue shown on the map.
--    PLACEHOLDER DESIGN: change it once you know what your data looks like.
--    Everyone can read it; nobody can edit it from the website
--    (add/edit rows in the Supabase Table Editor instead).
-- -----------------------------------------------------------------------------
create table public.clothing_items (
  id                text primary key,
  name              text not null,
  brand             text,
  category          text,
  adaptive_features text[] not null default '{}',
  description       text,
  price             numeric(10, 2),
  currency          text default 'EUR',
  store_name        text,
  address           text,
  city              text,
  country           text,
  lat               double precision not null,
  lng               double precision not null,
  rating            numeric(2, 1),
  image_url         text,
  product_url       text
);

alter table public.clothing_items enable row level security;

create policy "Anyone can browse clothing items" on public.clothing_items
  for select to anon, authenticated using (true);

-- -----------------------------------------------------------------------------
-- 4. FILE STORAGE — private bucket. Files are saved as  <user id>/<file name>
--    and each user can only read, upload or delete files in their own folder.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-files', 'user-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "Users can view files in their folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can upload to their folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete files in their folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'user-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Restrict direct application-role grants to the operations covered by RLS.
revoke all on public.profiles, public.user_files, public.clothing_items from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.user_files to authenticated;
grant select on public.clothing_items to anon, authenticated;
