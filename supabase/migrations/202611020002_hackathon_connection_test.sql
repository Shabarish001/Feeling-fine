-- Isolated diagnostic migration. Run only after verifying the remote project,
-- migration history, and that public.hackathon_connection_test does not exist.
-- CREATE TABLE intentionally fails if the name already exists; no existing
-- table, policy, or data is modified. The fixed id makes the insert idempotent.
create table public.hackathon_connection_test (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  category text,
  price numeric(10, 2),
  currency text,
  source text,
  created_at timestamptz default now()
);

alter table public.hackathon_connection_test enable row level security;

create policy "Read the connection diagnostic record"
  on public.hackathon_connection_test
  for select to anon, authenticated
  using (
    id = '45eb8626-b97c-4fb7-9ca9-40fce1f4c611'::uuid
    and product_name = 'FEELING FIND Supabase Connection Test'
    and source = 'hackathon_connection_test'
  );

grant select on public.hackathon_connection_test to anon, authenticated;

insert into public.hackathon_connection_test
  (id, product_name, category, price, currency, source)
values
  ('45eb8626-b97c-4fb7-9ca9-40fce1f4c611'::uuid,
   'FEELING FIND Supabase Connection Test', 'adaptive_clothing_test',
   19.99, 'EUR', 'hackathon_connection_test')
on conflict (id) do nothing;
