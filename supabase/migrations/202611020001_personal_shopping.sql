-- Additive schema; existing profile, files and clothing_items remain untouched.
create table if not exists public.shopping_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object'),
  consent_saved_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.shopping_preferences enable row level security;
create policy "Shopping preferences owner select" on public.shopping_preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "Shopping preferences owner insert" on public.shopping_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Shopping preferences owner update" on public.shopping_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Shopping preferences owner delete" on public.shopping_preferences for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), title text not null, brand text, category text not null,
  description text, composition jsonb, images jsonb not null default '[]', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_offers (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  source text not null, source_item_id text not null, retailer text, product_url text, currency text, price numeric(12,2),
  shipping_cost numeric(12,2), delivery_estimate text, stock_status text not null default 'unknown' check (stock_status in ('in_stock','out_of_stock','unknown')),
  country text, observed_at timestamptz, last_checked_at timestamptz, unique(source,source_item_id),
  check (product_url is null or product_url ~ '^https://')
);
create table if not exists public.product_evidence (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  attribute text not null, value jsonb not null, evidence_type text not null check (evidence_type in ('retailer_spec','manufacturer_spec','unverified_seller_claim','inferred')),
  evidence_text_or_source text, source_url text, checked_at timestamptz,
  check (source_url is null or source_url ~ '^https://')
);
alter table public.products enable row level security;
alter table public.product_offers enable row level security;
alter table public.product_evidence enable row level security;
create policy "Public read products" on public.products for select to anon, authenticated using (true);
create policy "Public read offers" on public.product_offers for select to anon, authenticated using (true);
create policy "Public read evidence" on public.product_evidence for select to anon, authenticated using (true);
-- Ingestion requires a separately authorized server-side role. No client write policies.
