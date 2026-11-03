# Awin adaptive shirts and trousers: research report

Checked 3 November 2026. This is research only: no retailer content, images or products were imported or published. The authorized Supabase project `aceopapwpgpwyypopofi` had zero products on a read-only count.

## Search and account findings

The Awin publisher directory API returned 21,541 accessible program entries, which were searched across their returned names, URLs, descriptions and other fields for the requested retailer names, domains and English/German adaptive terms, plus additional specialist brands. This is a search of the returned directory records, not proof that no program exists elsewhere or that a general retailer carries no adaptive range. Able2 Wear, Vilber's and Tamonda had no matching entries; their Awin IDs, membership status, auto-join status and feed access are therefore **unknown**. No application was submitted.

| Directory lead | Awin program | Publisher status | Scope and feed |
| --- | --- | --- | --- |
| [Springrose](https://ui.awin.com/merchant-profile/63730) | 63730, US | Not joined | Adaptive bras/underwear in its directory description, not the requested shirts or trousers. Feed access not checked. |
| [Simply Magnetic Me](https://ui.awin.com/merchant-profile/46531) | 46531, US | Not joined | Magnetic-fastening babywear, not established as disability-specific adult shirts/trousers. Earlier en_US feed request returned HTTP 404. |
| [Marks and Spencer UK](https://ui.awin.com/merchant-profile/1402) | 1402, GB | Not joined | General retailer; current adaptive feed inventory not established. Earlier en_GB feed request returned HTTP 404. |
| [Marks and Spencer DACH](https://ui.awin.com/merchant-profile/23355) | 23355, DE | Not joined | General retailer; current adaptive feed inventory not established. Earlier de_DE feed request returned HTTP 404. |

Auto-join eligibility is unknown for these programs. A 404 is not evidence that no products exist, or that other feed types or locales are unavailable. None of these checks established an accessible eligible shirt/trouser feed. The directory response is a discovery source and may omit relevant terms from general retailers' profiles.

The downloaded local feed contains 15,694 rows from Amazgifts DE (5,922), Socken-online.de (8,407), Luregod DE (355) and Glamory (1,010). A text scan of title, description, keywords and specifications for wheelchair, seated fit, magnetic closure/button, adaptive clothing, assisted dressing, side opening, hook-and-loop and German equivalents found zero phrase matches. This does not prove no adaptive feature exists under other wording. No generic items were substituted.

## Genuine retailer-page research leads, not Awin feed products

These four product pages illustrate the desired designs; they are **not approved for import** and their image and data reuse rights have not been established. Retailer statements are attributed claims, not independent verification of individual suitability. Cached pages can be stale; check the live variant, price, currency and stock before making a buying recommendation.

| Item | Seller's documented feature | Status |
| --- | --- | --- |
| [Able2 Wear men's magnetic shirt](https://able2wear.co.uk/product/mens-magnetic-shirt/) | Magnets on the front and cuffs, intended to make fastening easier. Seller warns against use by people with pacemakers or deep brain stimulation devices. | Research only; Awin program and permission unknown. |
| [Vilber's seated-fit T-shirt](https://vilbers.com/products/mens-wheelchair-adaptive-t-shirt) | Shorter front for seated wear; the seller also describes printed information in place of a sewn-in tag. | Research only; not an authorized Awin feed record. |
| [Vilber's adaptive jeans](https://vilbers.com/products/mens-wheelchair-adaptive-jeans) | Seated tailoring and a drop-down front for dressing/access. | Research only; not an authorized Awin feed record. |
| [Vilber's assisted-dressing trousers](https://vilbers.com/products/mens-wheelchair-adaptive-trousers-for-assited-dressing) | Seller describes a higher back and fully openable front zippers. | Research only; not an authorized Awin feed record. |

Thus: 2 shirt and 2 trouser **research examples**, 0 verified Awin feed products, 0 approved products, 0 imported products and 0 confirmed real photographs on the deployed website. No deployed website URL was available, so the actual deployment was not checked. The existing fictional demo and empty live state remain separate.

## Concrete next action

[Vilber's affiliate page](https://no.vilbers.com/pages/become-an-affiliate) describes a manually reviewed application using UpPromote, with referral links and brand assets after approval. Apply there for FEELING FIND and ask for the current product feed/API, Germany eligibility, permission to store/display product facts and image URLs, use of affiliate links, and refresh requirements. Approval of an affiliate account alone must not be assumed to grant every requested use. This is a direct program, not an established Awin program. [Able2 Wear](https://able2wear.co.uk/) offers magnetic shirts and wheelchair trousers; contact the retailer to ask for authorized product data and image/display terms. Tamonda's [legal notice](https://adaptivemode.de/impressum/) states that its text and imagery are copyright protected, so seek permission directly before use.

Once terms and source access are documented, map actual feed records into the existing catalog, review and deploy the not-yet-deployed atomic import function through a targeted workflow, import only approved records, and verify read-back plus live recommendations and cards. The existing Awin shortlist importer is specifically tied to advertiser 131023; it must be adapted and retested for a different authorized advertiser rather than reused blindly. Accessibility evidence must be separately verified, and should not be promoted from a seller claim solely because rights were granted.

## Local changes and checks

The Awin enhanced-feed adapter previously requested `application/x-ndjson`, which returned HTTP 406 in the previous live checks. It now requests `*/*`; this fixes that observed content-negotiation issue but does not establish feed access or permissions. All 69 Node tests passed, including the source-adapter request-header test. `scripts/research-awin-adaptive.mjs` performs the read-only directory and selected membership checks using server-side environment variables without printing credentials. The live catalog count was checked read-only. No migrations, RLS changes, imports, UI redesign or LangGraph changes were made.
