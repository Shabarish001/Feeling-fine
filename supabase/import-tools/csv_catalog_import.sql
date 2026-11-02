-- PROPOSED FOR REVIEW. NOT DEPLOYED. Not a migration.
-- Imports ONE approved product per call. One call = one PostgreSQL transaction (PostgREST wraps each RPC).
-- Inserts only: no UPDATE, no DELETE, never adopts or rewrites an existing row.
--
-- Security model
--   * SECURITY INVOKER (not definer): the function has no privileges of its own. It runs as the caller.
--   * The caller must be `service_role` (server-side key). service_role bypasses RLS, so no RLS policy is loosened.
--   * EXECUTE is revoked from public, anon and authenticated (Supabase default privileges grant it otherwise)
--     and granted to service_role only.
--   * search_path is empty; every table is schema-qualified; identifiers are quoted with format('%I').
--
-- Changes from the original draft (csv_catalog_import.original.sql), found in the audit:
--   1. A missing `products`/`product_offers` key made jsonb_array_length() NULL, so the "exactly one" guard
--      evaluated to NULL and did not raise. Now coalesced, and the plan's shape is validated.
--   2. Child rows were not tied to the plan's product: a plan could attach images, evidence, offers or prices to a
--      DIFFERENT existing product. Every child row must now reference this product (prices: this offer;
--      retailer: the offer's retailer).
--   3. Unknown top-level keys and oversized arrays are rejected.
create or replace function public.feeling_find_import_csv_product(p jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  relations constant text[] := array['retailers','products','product_variants','product_offers','product_offer_prices','product_images','product_evidence','product_materials','product_attributes'];
  product_children constant text[] := array['product_variants','product_offers','product_images','product_evidence','product_materials','product_attributes'];
  item jsonb; column_names text; existing jsonb; expected jsonb; relation text; k text;
  v_product_id uuid; v_offer_id uuid; v_retailer_id uuid; offer_url text;
begin
  if current_user <> 'service_role' then raise exception 'service_role required'; end if;

  -- Shape of the plan.
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'plan must be a JSON object'; end if;
  for k in select jsonb_object_keys(p) loop
    if not (k = any(relations)) then raise exception 'unexpected plan key %', k; end if;
  end loop;
  foreach relation in array relations loop
    if p ? relation and jsonb_typeof(p->relation) <> 'array' then raise exception '% must be an array', relation; end if;
    if coalesce(jsonb_array_length(p->relation), 0) > 50 then raise exception 'too many % rows', relation; end if;
  end loop;
  if coalesce(jsonb_array_length(p->'products'), 0) <> 1 or coalesce(jsonb_array_length(p->'product_offers'), 0) <> 1 then
    raise exception 'expected exactly one product and one offer';
  end if;
  if coalesce(jsonb_array_length(p->'retailers'), 0) > 1 then raise exception 'at most one retailer'; end if;

  v_product_id := (p #>> '{products,0,id}')::uuid;
  v_offer_id := (p #>> '{product_offers,0,id}')::uuid;
  v_retailer_id := (p #>> '{product_offers,0,retailer_id}')::uuid;
  offer_url := p #>> '{product_offers,0,product_url}';
  if v_product_id is null or v_offer_id is null or offer_url is null then
    raise exception 'product id, offer id and offer URL are required';
  end if;

  -- Every row in the plan must belong to this one product.
  foreach relation in array product_children loop
    for item in select value from jsonb_array_elements(coalesce(p->relation, '[]'::jsonb)) loop
      if (item->>'product_id')::uuid is distinct from v_product_id then
        raise exception '% row % does not belong to product %', relation, item->>'id', v_product_id;
      end if;
    end loop;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p->'product_offer_prices', '[]'::jsonb)) loop
    if (item->>'offer_id')::uuid is distinct from v_offer_id then raise exception 'price row % does not belong to offer %', item->>'id', v_offer_id; end if;
  end loop;
  if coalesce(jsonb_array_length(p->'retailers'), 0) = 1 and (p #>> '{retailers,0,id}')::uuid is distinct from v_retailer_id then
    raise exception 'retailer row must be the offer retailer';
  end if;

  -- Serialize cooperating imports for this canonical URL.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(offer_url, 0));
  if exists (select 1 from public.product_offers o where o.product_url = offer_url and o.product_id <> v_product_id) then
    raise exception 'existing offer URL belongs to another product';
  end if;

  -- Each row must match an existing row exactly on all supplied fields, or be inserted.
  foreach relation in array relations loop
    for item in select value from jsonb_array_elements(coalesce(p->relation, '[]'::jsonb)) loop
      if item->>'id' is null then raise exception 'missing id in %', relation; end if;
      execute format('select to_jsonb(t) from public.%I t where id = $1', relation) into existing using (item->>'id')::uuid;
      if existing is not null then
        execute format('select jsonb_object_agg(k, to_jsonb(jsonb_populate_record(null::public.%I, $1))->k) from jsonb_object_keys($1) as k', relation) into expected using item;
        if not existing @> expected then raise exception 'existing % row differs for id %', relation, item->>'id'; end if;
        continue;
      end if;
      -- JSON keys become quoted identifiers; the relation comes from the fixed list above.
      select string_agg(format('%I', key), ', ' order by key) into column_names from jsonb_object_keys(item) as key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', relation, column_names, column_names, relation) using item;
    end loop;
  end loop;
  return jsonb_build_object('product_id', v_product_id, 'offer_id', v_offer_id, 'product_url', offer_url);
end $$;

revoke all on function public.feeling_find_import_csv_product(jsonb) from public, anon, authenticated;
grant execute on function public.feeling_find_import_csv_product(jsonb) to service_role;
