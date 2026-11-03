# Adaptive clothing: demo readiness

Checked 3 November 2026. The remote project `aceopapwpgpwyypopofi` has zero products on a read-only check. No advertiser products were imported or published. The number of genuinely adaptive products in the inaccessible advertiser feeds is unknown; zero were verified from those feeds. The existing 41 hosiery candidates remain a local sensory-comfort research pool and are not represented as disability-specific products.

## Awin advertiser leads

The authenticated publisher directory reports these programs as active and **Not joined**. The feed responses are observations, not proof that an advertiser has no products. Product availability, current prices, territory, affiliate terms and image rights were not verified.

| Advertiser | Program | Region | Potential relevance | Feed check |
| --- | --- | --- | --- | --- |
| [Simply Magnetic Me](https://ui.awin.com/merchant-profile/46531) | 46531 | US | Magnetic-fastening babywear; disability-specific relevance not established | HTTP 404 |
| [Cadense](https://ui.awin.com/merchant-profile/74410) | 74410 | US | Adaptive footwear | HTTP 403 |
| [BILLY Footwear US](https://ui.awin.com/merchant-profile/123658) | 123658 | US | Footwear with opening zippers | HTTP 403 |
| [Outcaest UK](https://ui.awin.com/merchant-profile/131260) | 131260 | UK | Sensory-conscious underwear | HTTP 403 |
| [Marks & Spencer DACH](https://ui.awin.com/merchant-profile/23355) | 23355 | DE | Possible clothing lead; current adaptive product availability unverified | HTTP 404 |
| [Marks & Spencer UK](https://ui.awin.com/merchant-profile/1402) | 1402 | UK | Possible clothing lead; current adaptive product availability unverified | HTTP 404 |

M&S has previously documented a [children's easy-dressing range](https://corporate.marksandspencer.com/newsroom/press-releases/easy-dressing-ms-launches-high-streets-first-kidswear-range-children); that historical announcement does not establish current regional availability. [BILLY](https://billyfootwear.com/pages/about-us) describes its zip-opening footwear, [Cadense](https://cadense.com/pages/affiliates) describes its Awin affiliate program, and [Outcaest](https://outcaest.bigcartel.com/faq) describes its sensory-conscious products. These are retailer claims, not independently validated suitability for any individual.

The Awin API returned 403 for three enhanced-feed requests and 404 for the others, using the relevant locale. The exact reason for each refusal is unconfirmed. Awin [documents its product feed API](https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1) and [advertiser image guidance](https://success.awin.com/s/article/Can-I-use-any-images-from-the-advertiser-s-website?language=en_US). Program membership alone should not be assumed to settle every intended use or territorial restriction.

## Shortest path to genuine listings

1. In the publisher account, review the linked advertiser profiles and apply to suitable programs, or check whether each program offers auto-join. Confirm that FEELING FIND's site and territory are eligible.
2. Obtain the applicable advertiser/feed terms or written confirmation covering affiliate links, storage and display of product data and images, and price refresh requirements.
3. Retrieve an authorized current feed, select actual relevant garments, and verify product identity, image association, price, availability, territory, and specific accessibility evidence. Claims stay labeled as claims; do not infer medical suitability.
4. Review and deploy the existing atomic import function only after its SQL and privileges are approved, then use the authorized importer with the relevant field-level checks. Read records back and run live UI checks. Until then, approved genuine records, imported records, and verified live product displays are all **0**.

## Local demo fallback

The existing local demo catalog contains 15 fictional garment samples using original illustrated silhouettes. They are labeled demo samples, not for sale, with sample prices and no real shopping links. It is not a live retailer catalog. The sample features now include fictional magnetic closures, hook-and-loop fastening, easy-grip zippers and seated-fit details, so the recommendation scenarios can be demonstrated without implying real inventory.

Run `npm run dev` in this directory and open `/discover`; use demo mode. No deployed website URL was available to verify, and no deployment was performed.

Accessibility needs now require a dated, sourced retailer/manufacturer specification for live products; an unverified seller claim alone cannot satisfy a need or hard restriction. Demo samples use explicitly labeled sample evidence. The existing Awin plan currently treats its feed claims as unverified; approving data-use rights does not itself promote those claims to verified specifications.

## Verification

- Automated Node tests: 68 passed.
- Playwright: 29 passed, one isolated authenticated-project test skipped because its separate test environment was not configured. Browser tests use fixtures where indicated and do not establish live retailer inventory.
- Production build: passed.
- Remote read-only product count: zero. No database writes, migrations, or deployment were performed.
