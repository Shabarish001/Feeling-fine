-- Proposed additive catalog extension. Requires application baseline and
-- 202611020001_personal_shopping.sql. No retailer data is inserted.
-- Legacy products.composition/images remain for compatibility; the tables below
-- are the preferred structure for newly ingested, source-backed data.

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text check (website_url is null or website_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  size_label text,
  color text,
  fit text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id),
  unique (product_id, sku)
);

alter table public.product_offers
  add column variant_id uuid,
  add column retailer_id uuid references public.retailers(id),
  add column price_observed_at timestamptz,
  add column shipping_currency text check (shipping_currency is null or shipping_currency ~ '^[A-Z]{3}$'),
  add column delivery_min_days integer check (delivery_min_days is null or delivery_min_days >= 0),
  add column delivery_max_days integer check (delivery_max_days is null or delivery_max_days >= 0),
  add column availability_note text,
  add constraint product_offers_variant_product_fk foreign key (variant_id, product_id)
    references public.product_variants (id, product_id),
  add constraint product_offers_id_product_unique unique (id, product_id),
  add constraint product_offers_price_nonnegative check (price is null or price >= 0),
  add constraint product_offers_shipping_nonnegative check (shipping_cost is null or shipping_cost >= 0),
  add constraint product_offers_currency_format check (currency is null or currency ~ '^[A-Z]{3}$'),
  add constraint product_offers_price_currency check (price is null or currency is not null),
  add constraint product_offers_shipping_currency check (shipping_cost is null or shipping_currency is not null or currency is not null),
  add constraint product_offers_delivery_range check (delivery_min_days is null or delivery_max_days is null or delivery_min_days <= delivery_max_days);

-- Optional historical observations; a missing observation is not a current price.
create table public.product_offer_prices (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.product_offers(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  observed_at timestamptz not null,
  source_url text check (source_url is null or source_url ~ '^https://'),
  unique (offer_id, currency, observed_at)
);

-- Evidence can describe a product, a specific variant, and/or an offer.
-- The composite references prevent linking a different product's variant/offer.
alter table public.product_evidence
  add column variant_id uuid,
  add column offer_id uuid,
  add constraint product_evidence_variant_product_fk foreign key (variant_id, product_id)
    references public.product_variants (id, product_id),
  add constraint product_evidence_offer_product_fk foreign key (offer_id, product_id)
    references public.product_offers (id, product_id),
  add constraint product_evidence_id_product_unique unique (id, product_id),
  add constraint product_evidence_documented_source check (
    evidence_type not in ('retailer_spec', 'manufacturer_spec') or
    (source_url is not null and checked_at is not null and evidence_text_or_source is not null)
  );

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  image_url text not null check (image_url ~ '^https://'),
  source_url text check (source_url is null or source_url ~ '^https://'),
  alt_text text,
  license_note text,
  position integer not null default 0 check (position >= 0),
  observed_at timestamptz,
  foreign key (variant_id, product_id) references public.product_variants (id, product_id)
);

-- One declared material per garment part. A missing row or an incomplete list
-- does not prove an allergen is absent. Evidence is required for safety claims.
create table public.product_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  material text not null,
  garment_part text,
  percentage numeric(5,2) check (percentage is null or percentage between 0 and 100),
  evidence_id uuid,
  foreign key (variant_id, product_id) references public.product_variants (id, product_id),
  foreign key (evidence_id, product_id) references public.product_evidence (id, product_id)
);

-- Actual assertions, not a derived medical suitability judgment. Evidence
-- levels and freshness are stored in the linked product_evidence row.
create table public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  attribute text not null,
  value jsonb not null,
  evidence_id uuid,
  foreign key (variant_id, product_id) references public.product_variants (id, product_id),
  foreign key (evidence_id, product_id) references public.product_evidence (id, product_id)
);

create table public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid,
  feedback_type text not null check (feedback_type in ('saved','dismissed','helpful','not_helpful','fit_feedback')),
  rating smallint check (rating is null or rating between 1 and 5),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (variant_id, product_id) references public.product_variants (id, product_id)
);

create index product_offer_prices_offer_idx on public.product_offer_prices(offer_id, observed_at desc);
create index product_variants_product_idx on public.product_variants(product_id);
create index product_offers_variant_idx on public.product_offers(variant_id);
create index product_images_product_idx on public.product_images(product_id);
create index product_materials_product_idx on public.product_materials(product_id);
create index product_attributes_product_idx on public.product_attributes(product_id);
create index product_evidence_product_idx on public.product_evidence(product_id);
create index product_feedback_owner_idx on public.product_feedback(user_id, created_at desc);

alter table public.retailers enable row level security;
alter table public.product_offer_prices enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.product_materials enable row level security;
alter table public.product_attributes enable row level security;
alter table public.product_feedback enable row level security;

create policy "Public read retailers" on public.retailers for select to anon, authenticated using (true);
create policy "Public read offer prices" on public.product_offer_prices for select to anon, authenticated using (true);
create policy "Public read product variants" on public.product_variants for select to anon, authenticated using (true);
create policy "Public read product images" on public.product_images for select to anon, authenticated using (true);
create policy "Public read product materials" on public.product_materials for select to anon, authenticated using (true);
create policy "Public read product attributes" on public.product_attributes for select to anon, authenticated using (true);

create policy "Users read own product feedback" on public.product_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own product feedback" on public.product_feedback for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own product feedback" on public.product_feedback for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own product feedback" on public.product_feedback for delete to authenticated using ((select auth.uid()) = user_id);

-- Make catalog grants explicit even if Supabase default privileges differ.
revoke all on public.products, public.product_offers, public.product_evidence,
  public.retailers, public.product_offer_prices, public.product_variants, public.product_images, public.product_materials,
  public.product_attributes from anon, authenticated;
grant select on public.products, public.product_offers, public.product_evidence,
  public.retailers, public.product_offer_prices, public.product_variants, public.product_images, public.product_materials,
  public.product_attributes to anon, authenticated;
revoke all on public.product_feedback from anon, authenticated;
grant select, insert, update, delete on public.product_feedback to authenticated;
-- Saved shopping preferences are account-scoped and require explicit app consent.
revoke all on public.shopping_preferences from anon, authenticated;
grant select, insert, update, delete on public.shopping_preferences to authenticated;
