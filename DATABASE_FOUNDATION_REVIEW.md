# Database foundation — review proposal

This is a review artifact. Do not apply the application migrations to the shared remote project until the schema and local/staging validation have been reviewed. No scraping or live catalog ingestion is implemented here.

## Current remote state and history

The linked project and application URL were verified as project `aceopapwpgpwyypopofi`. Before repair, `public` contained only `hackathon_connection_test`, and the migration was absent from history. The diagnostic table's seven column types/nullability/defaults, primary key, row-level security (RLS), single named SELECT policy and exact test row matched `202611020002_hackathon_connection_test.sql`. There were no custom triggers on it. The official `supabase migration repair` operation marked **only** version `202611020002` as applied. It did not rerun the SQL. Remote checks also found no `public.handle_new_user` function, `on_auth_user_created` auth trigger, `user-files` bucket, or baseline-named storage object policies. A read-only check found zero existing `auth.users` at review time. The new signup trigger does not backfill users who already exist at deployment time; plan any backfill separately if that changes. Verify these observations again immediately before any deployment.

The older `202611020000` and `202611020001` files are pending behind the repaired version. A normal migration dry run stops with `DbPushMissingRemoteError`. An explicitly requested `--include-all --dry-run --skip-vault` preview listed, in order, `202611020000_application_baseline.sql`, `202611020001_personal_shopping.sql`, and `202611020003_catalog_foundation.sql`. This is a preview only; it is not authorization to execute a push. Before any future deployment, recheck the target, existing objects, migration history, and the exact dry-run output. `--include-all` would include any additional pending local migration too; never use it blindly.

## Proposed migrations and exact changes

1. `202611020000_application_baseline.sql` stages the existing `supabase/schema.sql` design as an ordered migration: create `profiles`, `user_files`, and legacy `clothing_items`; create the profile-on-signup function and trigger on `auth.users`; create the private `user-files` storage bucket; add owner-specific profile, file, and storage policies and the public legacy catalog SELECT policy. It sets application-role grants to the operations covered by those policies. The existing `schema.sql` remains unchanged. Unlike that setup script, this baseline has no `DROP POLICY`, `DROP TRIGGER`, or `CREATE OR REPLACE FUNCTION` operations; existing name collisions stop the migration for review. Account deletion retains the existing cascading foreign-key behavior.
2. Existing `202611020001_personal_shopping.sql` creates `shopping_preferences`, `products`, `product_offers`, and `product_evidence`, with owner-only preference access and public catalog reads. Its `products.composition` and `products.images` JSON columns remain for compatibility. `clothing_items` is kept as a separate legacy store-oriented table and is not a source for the new catalog.
3. `202611020003_catalog_foundation.sql` adds the normalized tables and offer/evidence fields described below; adds indexes, RLS, and explicit catalog/preference/feedback grants; and restricts ordinary clients to reading shared catalog tables. It does not insert product records.
4. `202611020002_hackathon_connection_test.sql` is already reflected remotely and registered as applied. Do not rerun it.

If the three pending migrations are approved and applied to the current observed target, the expected net result is **14 new public tables** plus the existing diagnostic table; one new profile trigger and function; one private storage bucket; policies, grants, indexes and constraints specified by the files; and three new migration history entries. No retailer, product, offer, image, preference, or feedback rows are seeded. Review the SQL files themselves for exact definitions; the migration preview does not prove the SQL will execute successfully.

## Proposed data model

| Table | Purpose and notable fields |
| --- | --- |
| `profiles` | Existing app-compatible `auth.users` profile with `needs`, `disability_info`, and separate chat consent. |
| `user_files` | Existing private uploaded-file metadata; bytes remain in Supabase Storage. |
| `clothing_items` | Legacy location-oriented catalog, retained for compatibility; not the new online catalog. |
| `shopping_preferences` | One owner-scoped JSON object per account, with explicit saved-consent timestamp; used by the existing API. |
| `products` | Canonical title, brand, category, description and timestamps; legacy JSON fields remain. |
| `product_variants` | Product-specific SKU, size, color, fit and optional structured attributes. |
| `retailers` | Canonical retailer name and optional website. |
| `product_offers` | Retailer reference (plus legacy name), source ID, product and optional variant, URL, nullable price/currency, shipping, region, availability and observation timestamps. |
| `product_offer_prices` | Optional historical offer-price observations with currency, time and source URL. |
| `product_images` | Product/optional variant image URL, source URL, alt text, license note, position and observation time. |
| `product_materials` | Declared material, optional garment part/percentage and linked evidence. Absence of a material row is not proof of absence. |
| `product_attributes` | Structured accessibility or other feature assertions, optional variant and evidence reference. |
| `product_evidence` | Assertion/value, source type, HTTPS source URL, quotation/source description and checked time; optional variant and offer scope. Documented manufacturer/retailer claims require source text, URL and checked time. |
| `product_feedback` | Owner-scoped product/variant feedback type, optional rating and short note, timestamps. |

Composite foreign keys ensure variant, offer and evidence links refer to the same product. They do not prove that a linked evidence row applies to the same variant or offer as a claim; the ingestion and ranking layer must check that scope. Optional fields mean unknown rather than zero or confirmed absence. No database rule establishes an allergen-safe garment or current stock. Material percentages are individually bounded but are not required to sum to 100; this cannot establish complete composition.

The new `lib/personal-shopping/catalog-model.mjs` contains table names and an `isDocumentedAbsence` helper that rejects inference, missing source information, unsafe URLs, and a mismatched product/variant/offer. It is **not wired into a live adapter or the demo matching pipeline**, and does not independently resolve contradictory, stale, incomplete or misleading evidence. Live discovery must make those checks before using an assertion as a hard-filter input.

## Access and RLS

- `profiles`, `user_files`, `shopping_preferences`, and `product_feedback`: authenticated owner access only, checked with `auth.uid()`; no anonymous read. Feedback and preferences support owner deletion. Preference consent is required by the existing API; the database records the timestamp but cannot itself establish that a checkbox was actually shown or selected.
- `user-files` Storage: private bucket and policies limiting reads, inserts and deletes to the authenticated user's folder; check the Supabase-managed Storage grants as part of staging tests.
- `clothing_items` and shared product, variant, retailer, offer, offer-price, image, material, attribute and evidence tables: public SELECT policies. Ordinary clients receive no shared-catalog write policies; the extension explicitly revokes their catalog write grants. An authorized server-side ingestion path must be designed separately and keep privileged credentials off the client.
- RLS and grants do not validate source licenses or prevent publishing sensitive data accidentally. Only legitimately displayable catalog data should be ingested; image rights, URL safety, supplier provenance and retention require enforcement in the future ingestion service.

## Validation and outstanding work

- PostgreSQL parser validation checks grammar only, not database permissions, data semantics, triggers, or RLS behavior.
- Node tests cover catalog evidence scope and the existing demo planner/filter behavior. They do not prove the database migrations or RLS policies work on Supabase.
- Docker was unavailable during this review. Before deployment, apply the proposed chain to an isolated Supabase/Postgres staging instance with Auth and Storage available. Test signup/profile creation, preference consent/save/delete, user-to-user isolation, uploads, catalog reads, denied client writes, feedback ownership, constraints, and migration replay/order. Recheck for remote conflicts and dependencies immediately before any reviewed deployment.
- The remote project currently lacks the base profiles/file schema, so signed-in profile and file operations cannot work against it until the baseline is applied. Other application functionality also requires its own configuration and integration tests.
