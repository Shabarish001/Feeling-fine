# Diverse Awin shortlist and import workflow

Reviewed 2026-11-03. The existing `artifacts/awin-feed-review.json` remains the separate 41-product sensory-comfort pool. The new local-only `artifacts/awin-diverse-review.json` contains 40 distinct product URLs selected from a second pass over all 15,694 feed rows. Both files and the downloaded feed are ignored by Git because they contain advertiser material and tracking links.

| Candidate category | Count | Evidence in supplied feed |
| --- | ---: | --- |
| Shirts | 2 | Seller states 100% cotton; the structured material says cotton without a percentage. |
| Leggings | 7 | Seller states seamless construction; exact scope and fit still need checking. One is described as shapewear. |
| Underwear | 4 | Seller states seamless construction or a seamless waistband. |
| Hosiery | 3 | Seller states seam-related features. |
| Socks | 24 | Seller states seam-related features. |
| Jackets | 0 | No jacket title found in this feed. |

All 40 are supplied by **Socken-online.de** (advertiser 131023). This is a more varied shortlist, not a balanced source of wheelchair-friendly or magnetic-fastening garments. It contains no evidence that its leggings are seated-fit or easy to dress in, and no diagnosis or allergy-safety conclusion should be inferred. Two other shirt product paths were excluded because their descriptions claimed 100% cotton while their structured composition said 95% cotton and 5% elastane. One selected item's material field contains an unusable placeholder and is marked unknown; one other record has a possible size mismatch between title and SKU. All source claims remain unverified; selected variants, particularly colors and sizes, require human confirmation.

All 40 have feed-reported prices in EUR and syntactically valid image, merchant and Awin affiliate URLs. They are not independently verified current prices, stock statuses, image associations or rights. The structured size field is blank; size-like words in product names have not been treated as verified variant sizes. Seller descriptions, materials, image references, source links and tracking URLs are retained in the local preview only. Feed images and listings are not publicly displayed.

## Reproduce the preview

From `Feeling-fine`:

```text
python scripts/review-awin-feed.py
python scripts/review-awin-diverse.py
node scripts/import-awin-shortlist.mjs --dry-run
```

The second script verifies the sensory pool was created from the same feed hash, keeps it unchanged, and adds the new categories. The importer checks the current feed hash and reports **40 blocked / 0 ready** with no network or database calls in dry-run mode. The `aw_product_id` and advertiser ID are checked against each Awin tracking URL. Proposed product/offer IDs are deterministic, and the tracked URL is preserved separately from the retailer evidence URL.

## Approval and import prerequisites

The earlier authenticated Awin read-only program check returned **Not joined** for this advertiser. Awin also documents possible auto-join for some programs; this has not been confirmed for the account or FEELING FIND. Establish the actual relationship, site eligibility and feed, price, image and affiliate-link terms in Awin before authorizing any record. The current importer only accepts the API status `joined`; it deliberately fails closed on unverified soft membership.

After that, refresh the feed and independently verify each exact product/variant, price and currency, seam or material claim, image association, affiliate link and applicable permissions. A reviewer can provide a local, Git-ignored `data/imports/awin-approvals.json` object keyed by the exact `merchant_url`. Each review must include `advertiser_id`, `membership`, `site_approved`, `feed_use_approved`, `image_use_approved`, `tracking_use_approved`, `terms_url`, `checked_at`, `item_url`, `image_url`, `image_matches_product`, `feature_confirmed`, `price` and `currency`. `material_confirmed` is separately required to insert the seller's composition. These are explicit human attestations and do not themselves prove a license. The script requires a fresh review no older than seven days.

The existing proposed [atomic function](supabase/import-tools/csv_catalog_import.sql) is **not deployed**. Review its SQL and actual remote schema/grants before a targeted deployment. It uses SECURITY INVOKER and restricts execution to service_role; it performs a single-product transaction without changing RLS. Its insert-only behavior makes an identical retry idempotent and rejects conflicting existing rows. It is not a feed synchronization or takedown system. Price changes, revocation, stale records, concurrent non-cooperating writers and crash/read-back ambiguity need an operational process before production use. Do not use a normal migration push to install unrelated changes.

After permission and function review, `node --env-file=.env scripts/import-awin-shortlist.mjs --apply` requires the confirmed Supabase project, server-only key and Awin token. It rechecks Awin `joined` status, uses the atomic function per eligible product and independently reads each row back. It stops on failures and reports that earlier product transactions may already have succeeded. No `--apply` was run in this task, and no data or function was written remotely.

The current Next.js/LangGraph UI is unchanged. It has no specific socks, hosiery or underwear category option, and its existing feature aliases do not map all proposed seam/waistband claims. Thus neither visibility nor personalized relevance of these listings is established until actual authorized records are available and the unchanged live flow is tested. Do not describe fixture behavior as proof of live integration.

## Validation

The full scan and dry-run completed; 67 Node tests passed. The production build passed. In a disposable local PostgreSQL container loaded with the existing migrations and proposed function, the transaction, conflict, rollback and repeat-run tests passed; a clearly synthetic Awin underwear plan was inserted twice with no duplicate. That local check is not a remote function deployment or real-product read-back. The container was stopped. No Playwright run was performed for this task because neither the UI nor graph changed; the previous feed review recorded 29 passes and one skipped test.
