# Onboarding and "No matches available" fix report

## 1. Root cause

The graph was not broken. Retrieval, restriction filtering and ranking all ran correctly. Users saw "No matches available" because the five-step onboarding let them set **hard filters the demo catalog cannot satisfy**, and nothing told them. I reproduced each cause by running the real graph and the real UI (`scripts/_diag.mjs` before the fix, the e2e suite after).

| # | Cause | Reproduction (before) | Results |
|---|---|---|---|
| 1 | **Category defaulted to `tops`, chosen on step 3, after the needs steps.** No sample top documents any fastening feature. | Required "Easy Fastening", leave category | 0 |
| 2 | **"Required features" duplicated the needs list.** Ticking an item there made it a hard filter, with no hint of which categories could meet it. | `required_features: [easy_fastening]` with tops, or `seated_fit` with shirts | 0 |
| 3 | **Size was asked on the category step.** Every sample product lacks variants and stock data, so any size excludes everything. | `size: "M"` | 0 |
| 4 | **Polyester was offered as a "must avoid" material.** No sample declares polyester absent, so unknown fails. | `avoid_materials: [polyester]` | 0 |
| 5 | **A free-text restriction blocks everything** (it cannot be verified automatically). The old copy said only "require manual verification". | `custom_restrictions: "no itchy"` | 0 |
| 6 | **"Live — currently unavailable" was a selectable catalog mode** on the review step, with no live data behind it. | `mode: live` | 0 |
| 7 | **Saved optional refinements applied silently.** A saved budget or size was loaded into state and sent on every search, but the new flow never showed it. | saved `max_price: 20` | 0 |
| 8 | **The empty state never said why.** It showed one generic sentence. | any of the above | n/a |

Evidence for the "before" state: `artifacts/onboarding-fix/before-no-matches.png` (captured through the real UI).

Needs were also never a relevance rule. A "needs" selection only changed the order, so a user who chose easy dressing with category `tops` saw three unrelated tops with a score of 0. That hid the real problem in some paths and showed filler in others.

## 2. Onboarding changes

Five steps became three. Colour, style, budget, size, fit, country, delivery and catalog source moved out of the flow.

1. **Needs.** Three cards: *Easy dressing and fastenings*, *Sensory-friendly and soft*, *Seated comfort and accessible fit*. Each shows real sample-catalog coverage (for example "1 sample garment, trousers only" for seated comfort). Multi-select, optional, no diagnosis asked.
2. **Category.** "Explore all compatible clothing" (default) plus one card per category. Categories with no compatible sample for the chosen needs are **disabled** and say so. If a need change empties the chosen category, it resets to "all".
3. **Restrictions.** Materials to avoid (each shows how many sample products can verify it; polyester says "Cannot be verified in the sample catalog"), an expandable "Non-negotiable accessibility requirements", an optional free-text restriction with an honest warning, and a live preview line ("About 6 sample garments fit…" or a plain warning when nothing does). Consent to save stays here.

After results, **Refine preferences** (expandable) holds style, colours, budget and currency, fit and catalog source. Size appears only for a live catalog. An **active-filters bar** lists every filter in force, with a remove button on optional ones.

**Saved preferences:**
- Saved hard restrictions (avoided materials, required features, custom text) appear checked and **locked**. The server also keeps them, so they cannot be dropped by omission.
- Saved optional refinements (budget, size) show a banner on step 1 with a "Clear them" button.
- "Change my answers" returns to the wizard with every selection preserved.

## 3. Matching and mapping changes

All hard and soft rules now live in `lib/personal-shopping/matching.mjs`, a pure module with no LangGraph imports. The API graph and the UI both use it, so the UI can only advertise what a search returns. A unit test checks the counts match across every need and category.

- **Hard rules** (decide whether a product may appear), applied before ranking: relevance to chosen needs (at least one documented feature), free-text restriction, avoided materials (needs a declared-absent record), required features, size, budget.
- **Soft rules** (order only): preferred materials, style, fit, **colour** (previously collected but unused), feedback.
- Unknown is never compatible. A hard rule needs positive evidence.
- New category value `all`, now the default. Live mode with `all` queries without a category filter. Live mode never falls back to samples.
- The result carries a **counts-only `diagnostics`** object: category, products available, per-filter excluded and remaining, eligible and returned counts, and compatible products in other categories (sample catalog only). Nothing from the user's profile is included. In development, or with `PERSONAL_SHOPPING_DIAGNOSTICS=1`, the route logs the same counts.
- A saved free-text restriction is de-duplicated when the client sends it back. It would otherwise have grown with every search.

**Empty states** explain the real cause from the diagnostics (nothing documents your needs; N products could not be confirmed free of the materials you avoid; budget; no live data; a compatible product exists in another category). Actions offered only touch **optional** filters (remove budget, remove size, explore all categories). No action relaxes a material, required-feature or free-text restriction.

**Product cards** now show documented features and, for avoided materials, "Confirmed free of: …" only where the garment actually declares it.

**Not changed:** Supabase migrations, authentication, Google Maps, external APIs. No fake retailer products. The only schema-level change is the additive `all` category.

One existing unit test asserted the old `tops` default, so I updated that assertion on purpose.

## 4. Demo catalog coverage matrix

Generated from the real fixtures and engine (`node scripts/catalog-matrix.mjs`). All products are illustrative samples with no variants, stock, image or retailer URL.

| ID | Category | Documented features | Documented materials | Declared absent | Supports need groups | Missing attributes |
|---|---|---|---|---|---|---|
| t01 | tops | tag free, flat seams, sensory softness | cotton | wool, latex | sensory | sizes/variants, stock, image |
| t02 | tops | tag free, sensory softness | undocumented | none | sensory | materials, sizes/variants, stock, image |
| t03 | tops | temperature comfort | linen | wool, latex, nickel hardware | none | sizes/variants, stock, image |
| s01 | shirts | easy fastening, limited dexterity, easy dressing | cotton | wool, latex, nickel hardware | easy_dressing | sizes/variants, stock, image |
| s02 | shirts | flat seams, sensory softness | cotton | wool | sensory | sizes/variants, stock, image |
| p01 | trousers | seated fit, easy dressing | cotton | wool, latex | easy_dressing, seated | sizes/variants, stock, image |
| p02 | trousers | easy fastening, limited dexterity, adjustable openings | viscose | wool, latex, nickel hardware | easy_dressing | sizes/variants, stock, image |
| p03 | trousers | easy dressing | undocumented | none | easy_dressing | materials, sizes/variants, stock, image |
| d01 | dresses | adjustable openings, easy dressing | linen | wool, latex, nickel hardware | easy_dressing | sizes/variants, stock, image |
| d02 | dresses | tag free, sensory softness, flat seams | cotton | wool | sensory | sizes/variants, stock, image |
| j01 | jackets | easy fastening, limited dexterity, easy dressing | polyester | wool, latex | easy_dressing | sizes/variants, stock, image |
| j02 | jackets | easy fastening, limited dexterity, adjustable openings | cotton | wool, latex, nickel hardware | easy_dressing | sizes/variants, stock, image |
| j03 | jackets | easy dressing | undocumented | none | easy_dressing | materials, sizes/variants, stock, image |
| f01 | shoes | adjustable openings, easy dressing | undocumented | nickel hardware | easy_dressing | materials, sizes/variants, stock, image |
| f02 | shoes | limited dexterity, easy fastening | undocumented | none | easy_dressing | materials, sizes/variants, stock, image |

**Which onboarding answers can produce recommendations**

| Need | Compatible samples | Categories |
|---|---|---|
| Easy dressing and fastenings | 10 | shirts 1, trousers 3, dresses 1, jackets 3, shoes 2 (tops 0) |
| Sensory-friendly and soft | 4 | tops 2, shirts 1, dresses 1 (trousers, jackets, shoes 0) |
| Seated comfort | 1 | trousers 1 only |

| Avoid material | Samples that can verify it |
|---|---|
| Wool | 10 |
| Latex | 8 |
| Nickel hardware | 6 |
| Polyester | **0** (any polyester exclusion returns an honest empty result) |

## 5. Browser test results

`npx playwright test`: **20 passed, 1 skipped** (the skipped one was already skipped: authenticated persistence in an isolated Supabase project). The suite drives the real UI against the real LangGraph; the recommendation API is not mocked.

| Requested scenario | Result |
|---|---|
| 1. Easy dressing → compatible garments | Pass: 10 results, each documents an easy-dressing feature |
| 2. Sensory-friendly → compatible garments | Pass: 4 results incl. Soft Everyday Tee and Soft Seam Shirt |
| 3. Seated comfort | Pass: 1 result (Seated Cut Trouser); every other category is disabled with "No compatible samples yet" |
| 4. Category filters results | Pass: Jackets gives exactly the 3 jackets |
| 5. Wool exclusion | Pass: garments with no wool declaration (p03, j03, f01, f02) excluded; "Confirmed free of: Wool" shown |
| 6. Unsupported combination | Pass: sensory plus polyester gives the empty state with the real reason and no relaxing action |
| 7. Returning preserves restrictions | Pass: needs, avoided material and required feature all still checked |
| 8. Different rankings | Pass: easy dressing leads with an Easy Close garment; sensory leads with a Soft garment |
| 9. Mobile and desktop | Pass: mobile 390px results and keyboard selection work, no horizontal overflow |

Also covered: saved hard restrictions are locked and enforced server-side; stale saved budget and size are announced and clearable; budget refinement and its removable chip; currency mismatch is never converted; live mode stays empty with no sample fallback; unauthenticated feedback and malformed requests fail safely; feedback changes later ranking and preferences survive a new session.

`node --test tests/*.test.mjs`: **51 passed** (41 existing plus 10 new in `tests/onboarding-matching.test.mjs`). `next build`: succeeds.

## 6. Screenshots (`artifacts/onboarding-fix/`)

- **Before:** `before-no-matches.png`
- **After, desktop:** `shot-desktop-1-needs.png`, `-2-category.png`, `-3-restrictions.png`, `-4-results.png`, `-5-empty-explained.png`
- **After, mobile:** `shot-mobile-1…5` (same sequence)
- Extra e2e captures: `after-seated-categories.png`, `after-easy-dressing-desktop.png`, `after-results-mobile.png`. Some of these were captured mid-fade by the page-entrance animation and look washed out; the `shot-*` set was taken after settling.

Regenerate with `node scripts/shoot-onboarding-fix.mjs`.

## 7. Remaining genuine limitations

- **The demo catalog is small and uneven.** Seated comfort has one product. Tops have no fastening features. Polyester cannot be verified for any product.
- **Size filtering cannot work on demo data** (no variants or stock), so it is hidden for the demo catalog.
- **Free-text restrictions cannot be verified**, so they return no matches by design. The UI says so before the user submits.
- **Live catalog is empty.** Live mode returns an honest empty state, and I could not test it against real product data.
- **Saved hard restrictions can only be removed by deleting saved preferences.** That follows the existing server rule, and the UI now says so, but it may feel strict.
- The authenticated Supabase path (real saved preferences) was exercised only through the repo's local test store, not a live Supabase project.
- Colour is now a soft ranking signal only; the sample data has one colour per product.
