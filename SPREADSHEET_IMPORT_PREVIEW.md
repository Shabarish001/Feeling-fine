# Supplied product files: import preview

Reviewed 2026-11-02. The input directory contains two CSV files, not Excel workbooks. A CSV contains one table; there are no additional workbook sheets to inspect. The original files are unchanged. The full normalized preview, including original source rows and review reasons, is `artifacts/spreadsheet-import-preview.json`. Regenerate it with `python scripts/preview-imports.py`.

| Measure | Count |
| --- | ---: |
| Input rows | 28 (12 Germany, 16 UK/US research) |
| Candidate records after URL deduplication | 28 |
| Duplicate rows identified by canonical direct URL | 0 |
| Supplied price and recognized currency | 28 |
| URLs with a product-page format | 18, not independently verified |
| Supplied image URLs | 3, all with permission unverified |
| Supplied accessibility claims | 28, not independently verified |
| Supplied price observation date | 16 |
| Require review | 28 |
| Approved and imported | 0 |

Currencies remain as supplied: 12 EUR, 10 GBP, and 6 USD. These are source-reported amounts, not verified current prices. Twelve German entries have no observation date. Ten German entries have only shared category links; these remain separate records and do not count as product links or duplicates. Product-page URL formats do not prove that a page resolves or matches a particular item. The importer cannot know whether those ten records duplicate another product without item URLs.

The German CSV columns are `product_name`, `retailer`, `observed_price_eur`, `currency`, `seller_claimed_features`, `source_url`, `url_type`, `retailer_sku_or_variant`, `image_url`, `image_usage_permission`, and `data_status`. The other CSV columns are `id`, `product_name`, `retailer`, `category`, `price_observed`, `currency`, `product_url`, `product_image_url`, `image_publication_permission`, `accessibility_features`, `materials_seller_claim`, `price_observed_date`, `availability`, `delivery_to_germany`, `source_url`, `publication_status`, and `notes`.

## Rights and approval

Every source row is labeled research-only; the three included image URLs are labeled unverified. No field-level permission allowing this project to persist and publicly display the records has been established. [Blusss's legal notice](https://blusss.com/pages/legal-information) says its content may not be copied or reused without permission. [The Able Label's affiliate terms](https://www.theablelabel.com/pages/affiliates-terms-conditions) describe a conditional affiliate program and do not by themselves establish this project's image or feed rights. No retailer permission for these records was supplied. Obtain and record the relevant provider authorization, scope, fields and image use before import. The application has public catalog reads, so a public-schema insert would expose the data.

## Mapping and remote status

After source approval and validation, map names and categories to `products`; variant identifiers, sizes and colors to `product_variants` when verified; retailers to `retailers`; original product URLs, currency, price, availability and observed time to `product_offers`; price snapshots to `product_offer_prices`; authorized product image URLs and license details to `product_images`; supported composition claims to `product_materials`; and source-backed accessibility claims and their provenance to `product_attributes` and `product_evidence`. Do not populate timestamps, price history, variants or materials when the source does not substantiate them. Any multi-table importer must guard against duplicate identities and overwriting unrelated records and independently read rows back.

The linked project reference and configured application URL both identify `aceopapwpgpwyypopofi`. No authorized `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, access token, or database URL was found in the inspected environment files or process environment. No database operation was attempted: none of the records is approved, and the existing research importer intentionally cannot write complete product records. Consequently there are zero imported products, offers and images, and zero prices verified remotely. Read-back and live idempotence remain untested. No migrations or UI files were changed.
