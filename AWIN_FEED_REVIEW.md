# Awin feed shortlist and integration review

Reviewed 2026-11-03. **41 local candidates; 0 approved, 0 imported and 0 genuine products displayed end to end.** The feed is `data/imports/datafeed_3143018.csv`; `data/awin/` did not contain the feed. The full CSV has 15,694 rows, including non-clothing accessories. It contains 8,407 rows for Socken-online.de (advertiser 131023), 5,922 for Amazgifts DE, 1,010 for Glamory and 355 for Luregod (DE).

## Local shortlist

`artifacts/awin-feed-review.json` is the local-only shortlist: 41 distinct retailer product paths selected from 591 in-stock feed rows whose sock or hosiery descriptions contain a specific seam or seamless-construction claim. It contains 38 sock and three hosiery product groups. The search is deliberately narrow: these are **seller-reported comfort-related seam features**, not proof of medical suitability or comprehensive adaptive clothing. No magnetic shirts, seated-fit trousers or other specialized categories were selected from unrelated keyword hits. Review the source text for every candidate; a regex match can refer to a garment detail whose scope or location needs clarification.

Each preview record has its name, brand, retailer, original retailer URL, Awin tracking URL, image URL, feed price and currency, feed description and composition, feed update field, source-claim marker and proposed table mapping with deterministic IDs. Descriptions, image links and affiliate tracking links remain local and are not licensed for public display merely by appearing in this file. Both the source feed and preview are ignored by Git. The 41 prices are EUR; all have syntactically valid HTTPS retailer, image and Awin links, descriptions and composition strings. The structured `Fashion:size` column is blank for all; size-like text in titles has not been promoted to verified variant sizes. `last_updated` is retained as a feed field and is not treated as the time the price was verified.

The Awin tracking URLs contain matching advertiser and Awin product IDs for all 41 rows. That syntax check does not verify the redirect destination or the advertiser's approval. No live affiliate click was generated.

## Permissions and limited product checks

Using the configured Awin token and the publisher ID present in the feed, the documented read-only [program details API](https://help.awin.com/apidocs/get-program-information-details-for-publisher) returned **Not joined** for all four advertisers, including Socken-online.de. No credentials or publisher ID were printed. The response did not include program terms or establish whether soft membership applies. Awin's [publisher FAQ](https://help.awin.com/developers/docs/faqs-for-publishers) describes auto-join for some advertisers, so “Not joined” alone is not a universal statement that all feed use is forbidden. However, neither that exception nor FEELING FIND's site, image, storage and linking permissions have been established for this program. Awin says accepted publishers may use advertiser materials made available in the platform, subject to the program context ([Awin image guidance](https://success.awin.com/s/article/Can-I-use-any-images-from-the-advertiser-s-website?language=en_US)). Confirm the exact advertiser terms and relationship in Awin before publication.

The retailer's robots file requests a 30-second crawl delay. Validation was limited: one product URL returned HTTP 200, one associated feed image URL returned HTTP 200 with `image/jpeg`, and the retailer page's structured data for that product included EUR 3.95, matching the feed amount. These checks do not establish the correct variant, image association, stock, image rights, affiliate redirect behavior or prices for the other candidates. No restricted content was published or imported. Most candidate `last_updated` values predate this review by weeks or months, so refresh the feed and verify each selected variant and current price before ingestion.

## Import preparation and blockers

The review script proposes stable product, retailer and offer IDs without writing remotely. `lib/personal-shopping/sources/awin-csv-plan.mjs` prepares a deterministic transactional row plan only after an explicit per-product review attests to joined membership, site and field permissions, a matching product/image/affiliate link, documented seam feature, and a recent matching price. It preserves the tracked Awin link as the offer and the retailer URL as source evidence; seller descriptions are not written to the catalog. Material is omitted unless separately confirmed. The plan builder is **offline and has no remote import command**; its flags are human attestations, not independent proof of rights.

`supabase/import-tools/csv_catalog_import.sql` remains a proposed, undeployed atomic, service-role-only function. Read-only Supabase API metadata confirmed that the RPC is not exposed. Its insert-only conflict strategy prevents overwriting existing records but does not update prices, images or changed attributes; any future integration needs a reviewed refresh, expiry and takedown strategy. The current app's category chooser does not include socks/hosiery, so even after approval the live UI and matching experience must be tested with actual records rather than assumed from the fixture tests.

Read-only counts for the confirmed Supabase project returned zero products, offers and images. There is no genuine imported row to read back, and the live product-card flow cannot be verified with this feed yet. No RLS, UI or LangGraph files were changed for this task.

## Verification

- `python scripts/review-awin-feed.py`: scanned all 15,694 rows and produced 41 review-only candidates.
- `node --test tests/*.test.mjs`: 65 passed, including offline permission-gate and deterministic-plan tests.
- `npm run test:e2e`: 29 passed, one skipped for isolated authenticated persistence. The live-card tests use fixtures and do not prove real Awin display.
- `npm run build`: passed.

Next: establish whether Socken-online.de's program is joined or explicitly permits this publisher through auto-join, obtain the applicable feed/image/tracking and display terms, refresh and verify the selected products, then review and deploy a safe transactional ingestion path. Recheck and read back every actual inserted record. Do not treat this preview or the online plan's review flags as proof of approval.
