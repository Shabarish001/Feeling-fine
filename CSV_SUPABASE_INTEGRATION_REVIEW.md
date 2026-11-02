# CSV to Supabase integration review

Reviewed 2026-11-02. No retailer records, images or functions were written to the remote database. The two CSV inputs contain 28 records; no separate combined CSV is present. `artifacts/spreadsheet-import-preview.json` is the normalized local preview, and `artifacts/import-blockers.md` lists row-level gaps.

## Inputs and approval

- 28 records: 12 EUR, 10 GBP, 6 USD; 28 source-reported prices, none independently verified in this review.
- 18 product-format URLs and 10 category-page URLs; product-format syntax alone does not establish that a listing is current or correct.
- Three Joe & Bella records contain product-image URLs. Those associations come from the CSV; their correctness and image display rights remain unverified. The other 25 have no image URL. Repository PNG files found under `artifacts/` are interface screenshots, not authorized retailer product photographs. No local product image was identified or uploaded.
- All 28 rows are labeled research-only and no `data/imports/product-approvals.json` exists. No source-storage or image-display grant for these records was found in the supplied files. Therefore the importer reports zero eligible records and 28 needing review. Preserve the three URL references locally until permission and item association are established.

## Remote catalog

The application URL matched project `aceopapwpgpwyypopofi`. Read-only service-role counts returned zero for `products`, `retailers`, `product_offers`, `product_offer_prices`, `product_images`, `product_materials`, `product_attributes` and `product_evidence`. Zero products, offers, prices, images and attributes were imported in this task. Since all eight tables are empty, relationships between genuine imported records and remote read-back cannot be tested.

## Import function review

`supabase/import-tools/csv_catalog_import.sql` is the precise proposed SQL and is not a migration. Read-only PostgREST metadata did not expose `feeling_find_import_csv_product`. It has not been installed. Its design uses SECURITY INVOKER and a service-role guard, revokes execution from public/anonymous/authenticated roles, uses a per-call transaction and deterministic IDs, rejects mismatched existing rows, checks child-to-product and offer relationships, and serializes cooperating importers by URL. It does not relax RLS. Foreign keys enforce the deployed table relationships. The local SQL has previously been exercised against simplified disposable PostgreSQL fixtures; this is not an end-to-end verification against the remote schema.

Remaining limitations: the SQL trusts the privileged caller to have verified source permissions; the approval file is a human attestation rather than an automated rights determination. Its URL lock does not serialize independent writers that ignore that lock, existing records with different canonical URL representations require manual review, and changes to existing rows deliberately fail rather than update. Installing it changes the remote database and must follow review against the actual schema and grants. With zero eligible products, no deployment was necessary or authorized by an approved-record plan in this review.

## Application integration and verification

The existing graph reads the normalized catalog, uses approved-source image notes, maps offers and original currencies and labels seller claims. The discovery page can display these fields and retailer links. Deterministic material exclusions and required-feature checks remain in place; seller claims alone do not satisfy hard restrictions. The live path never substitutes demo products. The existing fixture tests exercise product-card mapping, image fallback, price, URL and restrictions, but fixtures are not genuine imported products.

`node --test tests/*.test.mjs`: 62 passed. `npm run build`: passed. `npm run test:e2e`: 28 passed, one skipped (authenticated persistence needs an isolated account), and one failed waiting five seconds for the initial live-catalog status message. The failed scenario passed on its standalone rerun; the complete suite was not rerun after that result, so the original timing failure remains a test reliability warning. Genuine Supabase → graph → API → product-card display remains unverified because no eligible products exist.

To proceed, establish the intended storage/display rights and any image license per retailer, verify each direct item URL, current price/currency, feature evidence and image association, then provide documented approval for eligible rows. Independently review and install the transaction function, and run the approved import followed by read-back verification. Do not replace missing data with fixtures.
