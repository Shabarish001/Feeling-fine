# Real catalog integration report

## Bottom line

**The remote Supabase catalog is empty (0 products), and no real product was imported.** The success criterion ("a real product stored in Supabase is retrieved through LangGraph and displayed with its authorized image, verified price and retailer link") is **not demonstrated on production data**, because there is no real, authorized product to demonstrate it with.

What I did achieve: the code path from Supabase rows to a real product card is now built and tested end to end, using clearly labelled fixtures in the exact Supabase row shape, and the live query is verified valid against the real remote schema. When approved records exist and the import function is deployed, they should flow through to the UI without further code changes. That is a claim from fixture tests, not from production.

## Remote database counts (read-only, project `aceopapwpgpwyypopofi`)

Measured with `node --env-file=.env scripts/remote-counts.mjs` (confirms the configured URL belongs to that project; prints counts only).

| Table | Anon key (what the website sees) | Service role (true contents) |
|---|---|---|
| products | **0** | **0** |
| product_variants | 0 | 0 |
| retailers | 0 | 0 |
| product_offers | 0 | 0 |
| product_images | 0 | 0 |
| product_evidence | 0 | 0 |
| product_attributes | 0 | 0 |
| product_materials | 0 | 0 |
| shopping_preferences | not readable by anon (RLS) | 0 |
| product_feedback | not readable by anon (RLS) | 0 |

Notes: `product_offer_prices` is the real price-history table (my first query used a wrong name); it has no rows because there are no offers. The 0003 catalog tables are deployed and publicly readable. The proposed import function is **not deployed**: PostgREST exposes no RPC functions (`scripts/remote-function-check.mjs`, metadata only; I did not call it).

## Phase 1: what the data flow actually showed

| Check | Finding |
|---|---|
| 1. Real products in the remote catalog? | **None.** 0 rows everywhere. |
| 2. Offers, prices, images? | None exist. |
| 3. Does the API query the right tables? | Yes. `products` with embedded offers, variants, images, materials, attributes, evidence. I ran the real LangGraph in live mode against the real remote with the anon key (`scripts/live-retrieval-check.mjs`): the query is valid and returns 0 products. |
| 4. Is demo the default? | Yes: `defaults.mode = 'demo'`. Combined with an empty live catalog, users only ever saw samples. |
| 5. Is catalog mode passed correctly? | Yes, from onboarding and from the results page's Refine panel to the API. The live option was effectively invisible ("currently unavailable"). |
| 6. Does the UI render real image, price and link fields? | Partly. It rendered image and price but said "View retailer", showed no price date, had no broken-image fallback, and did not distinguish seller claims. Fixed (below). |
| 7. Do hard restrictions exclude all live products? | Not applicable to the empty catalog (0 candidates before any filter). But I found that they would have excluded every product the importer produces (see root cause). |

## Root cause

1. **There is nothing to display.** The catalog has 0 products. This is the direct reason users only see demo garments.
2. **Nothing can currently be imported.** 28 candidate records exist in the two CSVs; the importer reports **0 eligible** (see Import status). The CSVs are themselves marked `research_only_not_import_approved`, image permission `unverified` or `not_collected`. There is no `data/imports/product-approvals.json`. The import function is also not deployed.
3. **Two latent bugs would have hidden real products even if they were imported.** Neither had been exercised, since no data ever existed:
   - *Evidence type mismatch.* The importer stores every feature as `unverified_seller_claim`, but retrieval only trusted `retailer_spec` or `manufacturer_spec`. An imported product could never match a chosen need.
   - *Vocabulary mismatch.* The CSV features (`magnetic_closure`, `side_zippers`, `one_hand_dressing`, `tagless`…) are not the onboarding vocabulary (`easy_fastening`, `limited_dexterity`, `tag_free`…), so no real product could match.

## Code changes

**Matching (`lib/personal-shopping/matching.mjs`)**
- Added a conservative `FEATURE_ALIASES` map from retailer wording to onboarding needs. An alias only recognises equivalent wording; it never creates evidence.
- Added `claimedFor`: a seller-claimed feature makes a product **relevant to a chosen need**, scores lower than verified evidence, and is labelled "Seller-claimed feature (not independently verified)".
- **Not weakened:** hard restrictions (avoided materials, required features) still need *verified* evidence (`retailer_spec`/`manufacturer_spec`, https source, `checked_at`). Seller claims never satisfy them. Missing evidence stays unknown.

> **Decision for you to review:** letting seller claims count toward *relevance* (not restrictions) is a judgement call. Without it, no imported product (all stored as seller claims) could ever be recommended for any need. If you prefer a stricter policy, remove the `claimedFor` clause in the `needs` stage; real products would then appear only with no needs selected, or once evidence is upgraded to a retailer or manufacturer specification.

**Live retrieval (`lib/personal-shopping/graph.mjs`)**
- Offers now embed `retailers(name, website_url)`, so the retailer name comes from the normalized table when the legacy text column is empty.
- Offers are ordered deterministically (direct link and price first, then most recently observed). Images are ordered by `position`. Each offer carries `verified_at` (`price_observed_at`, else `last_checked_at`, else `observed_at`).
- Prices keep their original currency. A non-https link is dropped, never rewritten. An image without an `Approved source: https://…` rights note is not displayed.
- Live mode never substitutes samples (unit-tested, including the database-error case).

**UI**
- Product card: genuine title, approved image with graceful fallback if it fails to load, retailer, price and currency, "price observed <date>" (or "price date not recorded"), seller-claim features marked as such, **"View at retailer"** opening the exact URL in a new tab, and an honest note when no direct link is recorded. Demo products keep the "Demo sample - not for sale" badge and never get a retailer link.
- Onboarding checks live availability through a new read-only `/api/personal-shopping/catalog-status` (a count). It **defaults to the live catalog only when it has products**, and says so; otherwise it tells the user the live catalog is empty and samples are illustrative. The Refine source option now reads "Live catalog (N products)" or "Live — no products yet".

**Test infrastructure:** a fixture live catalog (`fixtureLiveRows`) in `lib/personal-shopping/e2e-store.mjs`, reachable only through the existing local test gate (non-production, `E2E_GRAPH_TRACE=1`) plus the header `x-e2e-catalog: fixture`. Every fixture name says "FIXTURE … (test data)", and URLs use a reserved `.test` domain. Nothing is written to the remote database.

**Not changed:** migrations, authentication, Google Maps, the import function (not executed), the importer rules.

## Import status

`node scripts/import-csv-products.mjs --validate`: **28 records, 0 eligible, 0 imported.**

| Fact (from the importer) | Count |
|---|---|
| Candidate records | 28 (EUR 12, GBP 10, USD 6) |
| With a direct-format URL (unverified) | 18 |
| **With an image URL** | **3** (all `joeandbella.com`, permission `unverified`) |
| With a price observation date | 16 |
| `product-approvals.json` present | **No** |
| Import function deployed remotely | **No** |

**Blockers, by kind:**
1. **No source or image permission.** No record has image display rights, a rights reference, or any human attestation. This is the hard blocker: I cannot and did not invent permissions.
2. **Missing data.** Category missing for 12 of 28; image URL missing for 25 of 28; direct product URL missing for 10 of 28; observation date missing for 12 of 28; 10 have a material needing verification.
3. **No verification.** Prices, links and features are seller-reported and unchecked; the importer requires a reviewer attestation checked within seven days.
4. **Deployment.** `feeling_find_import_csv_product` is not installed remotely and awaits independent review, as you instructed. I did not execute it.

The complete per-record list of missing fields is in `artifacts/import-blockers.md` and `.json` (regenerate with `node scripts/import-blockers.mjs`). To make a record eligible, a reviewer must supply, per record: category, a direct https product URL, an image URL, the price observation date, and the full set of attestations in `data/imports/product-approvals.json` (price reference, feature evidence URL, image rights reference, `url_verified`, `image_matches_product`, `accessibility_verified`, `storage_and_display_approved`, `image_display_approved`, a `checked_at` within seven days, plus material verification where a material is claimed).

## Real product count, images and links displayed

- **Real products in Supabase: 0.**
- **Real product images displayed from Supabase: 0.**
- **Real retailer links displayed from Supabase: 0.**

Only fixture products (clearly labelled test data) rendered images and links in the browser.

## Test results

- `node --test tests/*.test.mjs`: **62 passed** (51 before, plus 11 in `tests/live-catalog.test.mjs`). These push schema-shaped rows through the real LangGraph and check that: image, price in its own currency (GBP is not converted), link, retailer and timestamp survive; missing image or link stay missing; an image without a rights note, or a non-https link, is dropped; seller claims count toward relevance only; seller claims never satisfy a required feature; unknown material evidence is not safe; aliases do not invent evidence; and live mode never falls back to samples.
- `npx playwright test`: **29 passed, 1 skipped** (already skipped before: authenticated persistence in an isolated Supabase project). The new `e2e/live-catalog.spec.mjs` covers: demo mode correctly labelled (with the real empty live catalog); live fixture mode reads the catalog and shows no demo products; image decodes (`naturalWidth > 0`); price and currency, retailer, observation date, seller-claim labels; "View at retailer" opens the exact URL; missing image and link shown honestly; broken-image fallback; rankings use attributes; hard restrictions not weakened; the **real** remote's empty live catalog gives an honest empty state; mobile card with a 44px tappable link and no overflow.
- Tests 1 and 8 run against the real remote and skip themselves if it later contains products, since live then becomes the default.
- `scripts/live-retrieval-check.mjs`: real LangGraph against the real remote, valid query, 0 products.
- `next build`: succeeds.
- Screenshots: `artifacts/real-catalog/` (demo mode, live fixture card on desktop and mobile, real empty live catalog). In the full-page desktop capture the sticky header and filter bar overlap the card; that is a screenshot artifact of the sticky bars, not a layout bug.

**Fixture-only tests do not demonstrate production success.**

## Remaining blockers

1. **No eligible real records.** 0 of 28 qualify; none has image rights or any reviewer attestation.
2. **Import function not deployed.** `feeling_find_import_csv_product` needs independent review and authorized installation. Until then even a fully approved record cannot be imported by the workflow.
3. **Policy decision pending:** seller claims counting toward need relevance (see above).
4. Even after import, features stored as seller claims will always show as "seller claim". Upgrading them to verified requires retailer or manufacturer specification evidence with an https source and check date.
5. Size filtering still needs real variant and stock data.
6. No automated check that a retailer URL still resolves at render time. The importer relies on the reviewer's `url_verified` attestation.
