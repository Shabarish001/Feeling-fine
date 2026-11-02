# Field-level catalog import review

Reviewed 2026-11-02 to 2026-11-03 (Europe/Berlin). **Eligible and imported: 0 of 28.** No approvals were invented, no transaction function or migration was deployed, and no retailer data was written to the remote database. The public catalog's `products`, `product_offers` and `product_images` each returned zero rows in a read-only recheck.

## What changed

The earlier importer required the same blanket storage/display approval and an approved image before any record could be stored. That conflated field categories and imposed an unnecessary image requirement on factual metadata. It now accepts an independently reviewed public-catalog basis for metadata without an image. Separately reviewed price, image, seller-claim and material fields are included only when their own approval and verification are present. Unknown fields are omitted, and the product card marks the resulting listing incomplete. Product identity and source observation are recorded in product evidence. No copied retailer description is imported.

The source URL now retains the original variant query and path; a separate canonical URL is used for deduplication and deterministic product identity. Removing variant query parameters from the shopping URL could otherwise change the actual item or price. Prices require their own observed timestamp and source; a general offer-check timestamp is no longer presented as a price observation.

The database's public catalog tables are selectable by anonymous users. An image-free row is therefore **publicly readable**, not a private draft. The field-level review explicitly concerns public catalog use; a reviewer must not mark an unresolved record approved merely because it is incomplete.

## Field distinctions and limits

| Field | Assessment |
| --- | --- |
| Product identity, category, price and composition as facts | Individual facts are different from protected expression. US guidance says plain facts are not copyrightable ([US Copyright Office](https://copyright.gov/help/faq/faq-general.html)). The EU may also protect qualifying database investments and restrict substantial or certain repeated extraction ([EU database directive](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A01996L0009-20190606)). Applicable site terms, contracts, database rights and jurisdiction still need assessment. A basis other than retailer copyright permission may be documented; none was established for the full intended public use of these records. |
| Retailer URLs | Ordinary links to works freely available with the rightsholder's consent have a distinct copyright analysis under [Svensson](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=ecli%3AECLI%3AEU%3AC%3A2014%3A76). It does not authorize bypassing restrictions or establish permission for other fields. Retain the exact URL and verify the actual product. |
| Seller accessibility claims | Source and date them as seller claims. Claims are not automatically verified specifications or a basis for allergy-safety guarantees. Review use of the words and provenance separately. |
| Retailer descriptions | Original expression may be protected. Current importer does not copy descriptions. |
| Product photographs | Require a separate documented display authorization; unknown rights mean no public image row or Storage upload. |

The retailer terms differ. [Joe & Bella](https://joeandbella.com/policies/terms-of-service) states a personal, noncommercial website-use restriction; [ABLE](https://www.ableclothing.com/pages/terms) describes content as intended for personal, noncommercial use. [Blusss](https://blusss.com/pages/legal-information) reserves content rights. [The Able Label affiliate terms](https://www.theablelabel.com/pages/affiliates-terms-conditions) have specific affiliate conditions but do not themselves establish this project's product-data and image license. Tamonda's supplied records and materials do not establish a public reuse basis. These observations do not adjudicate enforceability of particular terms or imply every factual field is copyrighted. This is a technical and source review, not a jurisdiction-specific legal opinion.

## Independent product and price checks

The 18 original product-format URLs were checked against the available web page representations, without bypassing access restrictions. Eight returned identifiable product-page snapshots (seven dated today by the research tool, one last week); nine were unavailable through the tool and one redirected to a homepage. Another ten CSV entries point to category pages. These are not proof that every exact variant is currently purchasable.

Same-day cached pages showed the CSV's displayed £59 amount for [Estelle](https://www.theablelabel.com/collections/shirts-blouses/products/estelle-relaxed-3-4-sleeve-velcro-brand-fastening-shirt), [Carly](https://www.theablelabel.com/collections/shirts-blouses/products/carly-classic-velcro-brand-fastening-shirt) and [Gillian](https://www.theablelabel.com/collections/shirts-blouses/products/gillian-cotton-velcro-brand-fastening-blouse). Same-day representations also showed matching dollar amounts for the [short-sleeve magnetic shirt](https://joeandbella.com/collections/special-needs-adaptive-clothing/products/short-sleeve-everyday-magnetic-button-shirt-for-men?variant=48227420078317), [HoodEase](https://joeandbella.com/products/magnetic-zip-up-hoodie-men), [CareZips](https://joeandbella.com/products/carezips-adaptive-pants-for-men) and [side-zip pants](https://joeandbella.com/products/mens-everyday-side-zip-pant). Dollar sign alone does not independently establish the currency, and these pages show conflicting sold-out/stock indicators. Cached snapshots are not a live price or inventory guarantee and are not converted into importer approvals.

## Transaction and verification

The proposed `supabase/import-tools/csv_catalog_import.sql` remains SECURITY INVOKER, service-role-only and undeployed; it does not modify RLS. Its identity, child relationships, conflict handling and single-call transaction were checked locally. In disposable PostgreSQL with the existing application migrations, the SQL transaction tests passed and a metadata-only plan inserted and reran idempotently. This does not verify remote execution, refresh/upsert behavior, or concurrency with unrelated writers. Partial records may require an explicit later synchronization strategy: the current insert-only function rejects conflicting changes.

Validation: 62 Node tests passed, production build passed, and two focused Playwright product-card tests passed. `node scripts/import-csv-products.mjs --validate` read 28 records and reported zero eligible. The current review does not establish enough source-specific public-use basis and current item/price evidence to import any actual record. Read-back verification of inserted records is therefore not applicable; no insertion was attempted.
