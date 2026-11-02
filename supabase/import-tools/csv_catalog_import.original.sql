-- Optional, NOT DEPLOYED. Review permissions, identity strategy and provider terms before use.
-- One call is one PostgreSQL transaction; no application migration is changed.
create or replace function public.feeling_find_import_csv_product(p jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb; column_names text; existing jsonb; expected jsonb; relation text;
  offer_url text := p #>> '{product_offers,0,product_url}';
  v_product_id uuid := (p #>> '{products,0,id}')::uuid;
begin
  if current_user <> 'service_role' then raise exception 'service_role required'; end if;
  if jsonb_array_length(p->'products') <> 1 or jsonb_array_length(p->'product_offers') <> 1 or offer_url is null then
    raise exception 'expected one product and offer';
  end if;
  -- Serialize cooperating imports for this canonical URL.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(offer_url, 0));
  if exists (select 1 from public.product_offers where product_url = offer_url and product_offers.product_id <> v_product_id) then
    raise exception 'existing offer URL belongs to another product';
  end if;
  -- Each row must match an existing row exactly on all supplied fields or be inserted.
  -- No UPDATE, DELETE, or adoption of an unrelated existing row is allowed.
  foreach relation in array array['retailers','products','product_variants','product_offers','product_offer_prices','product_images','product_evidence','product_materials','product_attributes'] loop
    for item in select value from jsonb_array_elements(coalesce(p->relation, '[]'::jsonb)) loop
      if item->>'id' is null then raise exception 'missing id in %', relation; end if;
      execute format('select to_jsonb(t) from public.%I t where id = $1', relation) into existing using (item->>'id')::uuid;
      if existing is not null then
        execute format('select jsonb_object_agg(k, to_jsonb(jsonb_populate_record(null::public.%I, $1))->k) from jsonb_object_keys($1) as k', relation) into expected using item;
        if not existing @> expected then raise exception 'existing % row differs for id %', relation, item->>'id'; end if;
        continue;
      end if;
      -- JSON keys are quoted identifiers; the relation is from the fixed list above.
      select string_agg(format('%I', key), ', ' order by key) into column_names from jsonb_object_keys(item) as key;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', relation, column_names, column_names, relation) using item;
    end loop;
  end loop;
  return jsonb_build_object('product_id', v_product_id, 'product_url', offer_url);
end $$;
revoke all on function public.feeling_find_import_csv_product(jsonb) from public, anon, authenticated;
grant execute on function public.feeling_find_import_csv_product(jsonb) to service_role;
