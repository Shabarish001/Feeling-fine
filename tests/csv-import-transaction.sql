-- Run only in a disposable PostgreSQL database with the fixture tables and function installed.
set role service_role;
do $$
declare p jsonb := '{"products":[{"id":"10000000-0000-5000-8000-000000000001","title":"Fixture","category":"shirt","images":[]}],"product_offers":[{"id":"20000000-0000-5000-8000-000000000001","product_id":"10000000-0000-5000-8000-000000000001","source":"fixture","source_item_id":"one","product_url":"https://example.com/products/one","price":10,"currency":"EUR","price_observed_at":"2026-11-02T12:00:00Z"}]}'; p2 jsonb;
begin
  perform public.feeling_find_import_csv_product(p);
  perform public.feeling_find_import_csv_product(p);
  if (select count(*) from public.products) <> 1 or (select count(*) from public.product_offers) <> 1 then raise exception 'repeat created duplicates'; end if;
  p2 := replace(replace(replace(p::text,'000000000001','000000000002'),'products/one','products/two'),'"one"','"two"')::jsonb;
  begin
    perform public.feeling_find_import_csv_product(p2 || '{"product_images":[{"id":"30000000-0000-5000-8000-000000000002","product_id":"10000000-0000-5000-8000-000000000002"}]}'::jsonb);
    raise exception 'invalid image unexpectedly accepted';
  exception when not_null_violation then null; end;
  if (select count(*) from public.product_images) <> 0 or (select count(*) from public.products) <> 1 or (select count(*) from public.product_offers) <> 1 then raise exception 'failed transaction left partial rows'; end if;
  begin
    perform public.feeling_find_import_csv_product(jsonb_set(p,'{products,0,title}','"Changed"'));
    raise exception 'conflicting row unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm = 'conflicting row unexpectedly accepted' then raise; end if;
  end;
end $$;
reset role;
