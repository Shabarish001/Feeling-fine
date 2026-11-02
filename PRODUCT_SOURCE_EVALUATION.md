# Product source evaluation

Reviewed 2026-11-02. This evaluation does not alter the deployed Supabase database, ingest merchant content, or modify the existing Tavily discovery pipeline.

## Findings and source access

**The Able Label:** Its public site describes adaptive shirts and elastic-waist trousers. Its published [affiliate terms](https://www.theablelabel.com/pages/affiliates-terms-conditions) identify **Affiliatly** for tracking and place conditions on licensed materials. Those terms do not establish a product-feed license or prove Awin membership. Confirm directly with the retailer whether FEELING FIND can access a product feed and store/display each field, image, price, and link in Germany. The `srsltid` query on the provided link is tracking context, not a credential.

**Awin enhanced feed:** A promising structured publisher source if FEELING FIND obtains an Awin publisher account, the enhanced-feed Partner API bearer token, publisher ID, a permitted advertiser's ID, locale, and advertiser/feed approval. Awin's [enhanced-feed documentation](https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1) describes a JSONL download, optional/conditional fields, a maximum of five requests per minute, and a possible error object on the last line even after HTTP 200. Its [feed list documentation](https://help.awin.com/developers/docs/product-feed-list-download) distinguishes the older data-feed API key from the Partner API key. The adapter implements only the documented enhanced JSONL feed, not the separate standard CSV/list endpoint. Advertiser membership, exact fields, image rights, refresh cadence and storage/display terms must be checked per feed; access is not evidence The Able Label participates.

**eBay Browse:** The official [Browse API](https://developer.ebay.com/api-docs/buy/api-browse.html) returns keyword-search summaries and a separate item-detail method with conditional item aspects. [Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) describe developer/sandbox access and production approval through eBay Partner Network, the Buy API application, review, and contracts. The adapter uses the official OAuth client-credentials grant; set `EBAY_ENVIRONMENT=production` and `EBAY_PRODUCTION_APPROVED=true` only after actual approval. Sandbox data is labeled `sandbox_only` and is not treated as a genuine live listing. eBay's [API License Agreement](https://developer.ebay.com/join/api-license-agreement) imposes display, storage, removal and freshness conditions, including public eBay content isolation from non-eBay content and a six-hour maximum age for displayed item listings. Confirm the current agreement and permitted use before combining, ranking, displaying or retaining eBay data.

**Tavily:** Remains a secondary discovery aid. The earlier experiment had 14 successful searches, three unverified Adaptawear candidates and no permitted product-page extractions; see `TAVILY_DISCOVERY.md` and `artifacts/tavily-discovery.json`. Search metadata, snippets and source-specific features are not a licensed structured feed. Keep its existing robots and source-access gate.

## Expected data, subject to actual source payload and rights

| Field | Awin enhanced feed | eBay Browse |
| --- | --- | --- |
| Title, product link, price, image | Documented feed fields; mapped when present and HTTPS | Search summary fields; mapped when present and HTTPS |
| Description, brand | Feed fields; advertiser-dependent | Item detail may include description and item aspects; summary may omit them |
| Sizes, colors, material | Conditional fashion/feed fields, generally variant-specific; material may not include percentages | Conditional item aspects/detail; not guaranteed in a search summary |
| Accessibility details | Optional named `product_detail` assertions only; no inferred hard safety claim | Optional named seller item aspects in item detail; no inferred hard safety claim |
| Shipping and delivery | Structured shipping fields vary by destination; adapter maps a single matching-country charge, not an inferred delivery time | Shipping options may be present, with delivery estimates conditional on context; only one unambiguous fixed charge is mapped |
| Availability | Maps explicit in-stock/out-of-stock values, otherwise unknown | Maps an explicit singular estimated availability, otherwise unknown |

All mapped accessibility and material statements are labeled `unverified_seller_claim`. A named material without percentages remains evidence text, not confirmed full composition. Missing price, cost, delivery and availability remain null/unknown. Source image URLs are listed as API-provided references; the adapter does not verify display rights, download images or imply permission to reuse them.

## Code and contract

`lib/personal-shopping/sources/adapter.mjs` defines the common `search(plan)`/`getDetails(id)` seam. `awin.mjs` and `ebay.mjs` return arrays of `{product, source}` observations; the existing demo adapter has a legacy different shape, so no new adapter has been wired into the recommendation agent. `product` follows `schemas/discovered-product.schema.json` with category `unknown` when the source does not establish a supported category. `source` carries provider, source-specific identity, retrieval time, fixture/sandbox labels and `rights_status`. This is an in-memory evaluation contract, not a direct Supabase row. The 32-character digest ID, source identity, variants, prices, images and evidence need an explicit reviewed mapping into the UUID-based product/offer tables before persistence.

Awin sale-price rows are left without a current price until effective dates can be validated. Awin IDs are scoped by advertiser ID; a feed response must be complete and within the 8 MiB default cap or the adapter rejects it without returning partial products. Searches use a local exact-token filter after fetching the feed; they are not an Awin server-side product search. The in-memory feed cache retains its original fetch time; call `loadFeed()` to refresh and discard it on refresh failure. Awin's request spacing and concurrency protection are per adapter instance only and do not coordinate multiple processes or application instances. Large feeds require a future bounded streaming/indexing strategy.

eBay search is limited to 10 items per call, with a separate validated-ID detail method. Sandbox/production hosts and the OAuth endpoint are fixed; production requires an explicit approval flag. Location-specific shipping needs the appropriate eBay request context; mapped costs are not a promise for every destination. API descriptions are untrusted text and must be sanitized if displayed. Neither adapter writes to Supabase, checks licensing, runs automatically from the UI, or bypasses source restrictions.

## Credentials and execution

No Awin credentials, publisher/advertiser ID, eBay client credentials, eBay access token, or evidence of eBay production approval were found in the inspected environment. Variable **names** are documented in `.env.example`: `AWIN_PUBLISHER_ID`, `AWIN_ADVERTISER_ID`, `AWIN_API_TOKEN`, `AWIN_FEED_LOCALE`, `AWIN_SHIP_TO_COUNTRY`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_ACCESS_TOKEN`, `EBAY_ENVIRONMENT`, `EBAY_MARKETPLACE`, and `EBAY_PRODUCTION_APPROVED`. Do not put secrets in client-exposed variables.

- `node scripts/evaluate-product-sources.mjs`: three **synthetic fixture** searches per adapter; no network.
- `node scripts/evaluate-product-sources.mjs --live`: uses configured sources if credentials are present. eBay defaults to sandbox, which is explicitly reported as non-live; production requires the approval flag. Results are counted in memory, not saved to Supabase.
- `node --test tests/product-sources.test.mjs`: offline adapter tests.

Fixture results, not merchant data: each adapter returned three fictional products. Both mapped 3/3 titles, links and prices; 1/3 images, percent compositions, sizes and shipping; and 3/3 labeled feature claims. The Awin fixture additionally included 1/3 brands, descriptions, colors and availability; the eBay fixture contained none of those. Neither fixture contained delivery estimates. These counts reflect the chosen synthetic inputs and say nothing about live source completeness.

No genuine products were returned from Awin or eBay and no live feed or Browse endpoint was called. The recommended next step is to confirm a licensed feed with The Able Label, then obtain an approved Awin publisher feed if available. In parallel, evaluate eBay production approval and its display/retention rules. Test a small permitted batch before introducing a controlled server-side catalog ingestion path.

## Verification completed

The read-only remote schema check found all nine expected catalog tables with RLS enabled, anonymous SELECT grants, and no authenticated INSERT grant. The adapter tests and full test suite passed; the normalized output from all six synthetic fixture records was independently checked against `schemas/discovered-product.schema.json` using JSON Schema Draft 2020-12. The production Next.js build passed. These checks do not substitute for live provider responses, approval, ingestion authorization, or source-specific licensing review.
