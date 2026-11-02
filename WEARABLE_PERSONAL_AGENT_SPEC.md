# SPEC-001 — FEELING FIND / WearAble Personalized Fashion Agent

**Status:** Ready for Codex implementation  
**Priority:** Feature 1 only — personalized online clothing discovery  
**Codebase:** Existing `Feeling-fine` Next.js App Router JavaScript repository  
**Mode:** Implement, test, and report. Do not replace the existing application.

## Codex execution instructions

You are coding inside the existing FEELING FIND repository. **Read the repository before changing anything.** The technical handoff below is context, not a substitute for inspecting actual files. Implement this specification end to end in small, coherent changes. Do not implement speculative unrelated refactors. Preserve the existing Google Places/map experience, login, registration, profile file uploads, and chat. Never commit credentials. If a service or API key is missing, provide a functioning, clearly labeled **demo catalog mode**, without pretending data is live. Do not claim tests pass unless actually executed.

At completion, give: changed-file list; architecture summary; migrations and manual setup steps; any keys needed (names only); commands actually executed and results; known limitations; screenshots if available; and a concise end-to-end user walkthrough. Do not silently skip essential acceptance criteria. If constrained by tooling, implement the highest-value safe working vertical slice and explicitly identify what remains.

## 0. Ground truth about the current checkout

The current app is branded **FEELING FIND**, not WearAble. It uses **Next.js App Router, React, JavaScript, plain CSS, Anthropic SDK, Supabase, and `@vis.gl/react-google-maps`**. Existing key entry points include:

- `app/page.js` — conversational homepage, routes to `/search?q=...`
- `components/SearchView.js`, `app/search/page.js` — text chat plus Google Places stores
- `app/api/chat/route.js` — Claude-powered `search_stores` tool loop, with demo fallback
- `lib/places.js` and `components/MapPanel.js` — place search and map
- `components/ProfileForm.js`, `app/profile/page.js`, `app/auth/actions.js` — Supabase profile, consent, account
- `lib/supabase/server.js`, `lib/supabase/client.js`, `proxy.js` — Supabase session integration
- `supabase/schema.sql` — defines `profiles`, `user_files`, `clothing_items` (but product table is not used by the app)
- `app/globals.css`, `components/Header.js`, `app/layout.js` — UI

**Do not trust README claims of seed/catalog files:** the inspected checkout lacks `lib/items.js`, `data/sample-items.js`, `supabase/seed.sql`, tracked migrations, and tests. The handoff did not verify remote Supabase provisioning or successfully run `npm`. Inspect the real checkout and update plan for discrepancies. The current `clothing_items` schema incorrectly requires lat/lng per item and lacks robust offers/materials/verification data. Do not force online products into this legacy store-oriented table.

## 1. Product intent, target user, and non-goals

### Intent

Build a **personalized online fashion discovery experience** for people with mobility/dexterity needs, sensory sensitivities, allergies, and fit/accessibility preferences. **Users choose structured preferences during onboarding**, not by typing a medical narrative into a chat. The AI works **behind the scenes**, translating their selected functional needs into meaningful product attributes and queries, then uses accessible data sources to discover, normalize, explain, and rank products.

### Must deliver

1. Structured, optional, usable onboarding with preference persistence for logged-in users.
2. Agent/orchestrator that receives validated structured preferences, plans searches, finds products from the internal catalog and an optional real authorized source, evaluates evidence, enforces exclusion rules, and returns recommendations.
3. Normalized product and retailer-offer records (image, title, brand, attributes, retailer, URL, price, currency, shipping/delivery if present, source, freshness, confidence/evidence).
4. Fashion-forward recommendation page with useful filtering, match reasons and clear unknowns, accessible responsive Liquid Glass styling.
5. A small, **explicitly labeled demo catalog** with diverse sample needs so the flow is demonstrable without credentials; demo sample products must never be represented as real live offers.
6. Tests for hard restrictions, unknown data, consent handling, input validation, product mapping, and demo recommendations.

### Out of scope for this feature

- Do **not** implement or redesign the offline store map, inventory feeds, store-to-product stock assertions, checkout, payments, medical advice, vision-based fit diagnosis, user-upload image interpretation, or a general autonomous website-crawling agent.
- Do **not** assume Google Places can supply product inventory.
- Do **not** scrape retailers against their terms. The default product discovery pathway must not rely on uncontrolled scraping.
- Avoid rebranding the whole app in this feature. Retain FEELING FIND unless actual design assets or existing branding indicate otherwise.

## 2. Product flows

### Flow A — first visit / unauthenticated

- Landing page has a compelling visual fashion hero and primary CTA **Find my fit**.
- CTA opens `/discover` (or `/onboarding`, then `/discover`) with step-based structured preferences. Sign-in is **not mandatory to try**.
- For guests, keep preferences only in in-memory state or sessionStorage; do not claim they are saved to the account. Guest preferences must not be persisted to backend user profiles. SessionStorage is optional; avoid any long-lived sensitive local storage by default.
- On **Show my matches**, user sees products and clear reason/evidence tags. A guest may sign in to save preferences later.

### Flow B — signed-in

- Onboarding pre-fills from existing saved structured preferences (if any). Profile's existing broad `needs` can be offered as suggestions, but **do not silently reinterpret diagnosis labels into hard exclusions**.
- Explicit consent to save/share preference categories for recommendations; settings separate from existing `use_needs_in_chat` consent. Do not reuse chat-consent as authorization for product personalization.
- Save preferences in a user-scoped Supabase table under RLS; user can edit and delete their saved preferences easily.
- The server loads preferences for the authenticated user, never accepts another user's ID from the browser. The browser may submit temporary unsaved preferences for a single recommendation request; server should not persist them unless user explicitly requests save.

### Flow C — recommendations

- User chooses clothing category, size (optional), shopping country, budget/currency, requirements (multiple), fabric avoid/prefer, functional details, colors/style optional, then submits.
- Agent produces a **structured search plan**: canonical categories, requirements, translated features, query strings, hard constraints vs soft preferences, and search country.
- Backend searches cached DB first, optionally consults a configured authorized product adapter, then normalizes, deduplicates, filters and ranks. Network failure must degrade gracefully to labeled demo results only if the user selected/demo mode; never silently substitute fictional offers for live listings.
- Results display item cards and details, with evidence-backed match reasons, unknowns, offer link, retailer, checked date; price/delivery when known. Users can refine without redoing onboarding.

## 3. Onboarding UX and preference schema

### Steps (4–5 steps maximum, with back and skip where safe)

1. **How should your clothing feel / work?** Select functional needs (not required diagnosis): `easy_fastening`, `limited_dexterity`, `seated_fit`, `sensory_softness`, `flat_seams`, `tag_free`, `adjustable_openings`, `easy_dressing`, `temperature_comfort`. Add a freeform optional preference text field (max 300 chars) but do not require chat.
2. **Materials & contact restrictions:** avoid materials (`wool`, `latex`, `nickel_hardware`, `polyester`, etc.), prefer materials (`cotton`, `linen`, etc.). Each explicit avoid choice is a **hard exclusion requirement** unless user marks it as only a preference; show brief warning that incomplete product declarations cannot establish safety. Allow custom restrictions in a separate text field but initially treat unverified custom text as requiring clarification/manual review, not guaranteed filters.
3. **What are we finding?** Clothing category (`tops`, `shirts`, `trousers`, `dresses`, `jackets`, `shoes`), optional size and fit, optionally personal style (`minimal`, `streetwear`, `classic`, `sporty`, `elegant`) and colors.
4. **Budget and shipping destination:** max price, currency (default EUR), country (default Germany), optional delivery preference. Do not promise delivery ETAs without source.
5. **Review & discover:** grouped summary distinguishing hard restrictions and preferences; explicit checkbox for account saving; no checkbox required just to use guest/one-time search.

Design inputs to be keyboard/screen-reader friendly. Provide progressive disclosure to prevent an overwhelming form. A user can select no disability category and still search clothes.

Example request payload (contract may use more explicit enums, but document changes):

```json
{
  "category": "jackets",
  "size": "M",
  "needs": ["limited_dexterity", "easy_dressing"],
  "required_features": ["easy_fastening"],
  "avoid_materials": ["wool", "nickel_hardware"],
  "prefer_materials": ["cotton"],
  "style": ["minimal"],
  "max_price": 120,
  "currency": "EUR",
  "country": "DE",
  "mode": "demo"
}
```

Never collect exact medical diagnoses or medical records as a prerequisite. Do not infer protected or medical attributes from app usage or images. Avoid a disability-specific visual aesthetic; make it a sophisticated inclusive fashion service for everyone.

## 4. Agent architecture: bounded tools, not free-form scraping

Implement an explicit server-side pipeline with reusable modules under `lib/personal-shopping/` (names may be adapted to repo):

```
validatePreferences(input)
    → planProductSearch(preferences)          // deterministic rules; optional Claude query enhancement
    → searchCatalog(plan)                     // Supabase/local demo catalog
    → searchAuthorizedRetailer(plan)          // optional adapter, documented credentials and limits
    → normalizeOffersAndProducts(raw)
    → deduplicateByCanonicalUrlOrSourceId()
    → evaluateProductEvidence(product, hardConstraints)
    → filterIneligibleOrUnknownHardConstraints()
    → scoreSoftPreferencesAndExplain()
    → persistPermittedCatalogData()
    → return RecommendationsResponse
```

**Critical:** The LLM may propose synonyms and attribute mappings, but must not invent availability, material composition, safety, size, shipping, price, photos or URLs. Keep deterministic validation and hard filtering **outside** the model. LLM output must be schema-validated and have safe deterministic fallback. Restrict model output length, tokens, tools and maximum search iteration count. Existing Anthropic client can be reused (key server only), but **agent must work in demo mode with no LLM key**.

### Requirement translation examples

- `limited_dexterity` + `easy_fastening` → query terms `adaptive clothing`, `magnetic closure`, `large zipper pull`, `pull-on` (these are candidate helpful features, not universal medical suitability).
- `sensory_softness` → `soft fabric`, `low-irritation seams`, `tagless`.
- `seated_fit` → `seated fit`, `adaptive trousers`, `higher back rise`.
- `avoid_materials: wool` → hard filter: only products **explicitly confirmed wool-free**; unknown composition is **not safe**.
- `avoid_materials: nickel_hardware` → require explicit documented nickel-free hardware or no relevant hardware supported by evidence; unknown hardware is **not safe**.

When a supplier cannot establish an allergen-related restriction, the product is excluded from the safe-match list and may appear only in a separate **Needs verification** section, *never labeled safe*. Unknowns cannot be overridden by LLM scores. Do not show "allergy-safe" or "medical-grade" unless a reliable, specifically applicable claim is supported (prefer feature-based wording).

### Confidence/evidence

Record each feature claim as `{attribute, value, evidence_type, evidence_text_or_source, source_url, checked_at}` where evidence type is `retailer_spec`, `manufacturer_spec`, `unverified_seller_claim`, or `inferred`. UI distinguishes **Verified feature** (documented specification), **Seller-reported**, **Inferred**, **Unknown**. A manufacturer specification is still not a blanket medical guarantee. Do not show fabricated numerical confidence scores masquerading as scientific certainty. AI-created keyword inference is never sufficient evidence for a hard exclusion.

### Search modes

- `demo`: seeded local catalog, no external credentials required; prominent "Demo catalog / sample listings — not live prices or stock" notice across the results and cards.
- `live`: only when an actually functional, authorized retailer integration is configured. If none, give a clear error/status message and offer demo mode, rather than representing mock data as live.
- Optional `cached_live`: previously ingested permitted real listings clearly marked with last-checked timestamp; show stale/unknown availability and cost where relevant.

### Retailer integration

Define `ProductSourceAdapter` interface with `search(plan)` and `getDetails(id)` if source supports it. Build one adapter for a legitimate API only when feasible with current credentials/access; otherwise provide the interface plus a reliable demo adapter and describe exactly how to connect a real source later. Do not hardcode an unverified public API endpoint or brittle HTML selectors. Avoid sending sensitive user preferences to third parties: send only generated generic search terms or minimal filters required by the service.

## 5. Persistence / data model

Prefer a **new versioned additive SQL migration** under `supabase/migrations/` (or clearly staged SQL file if no migration tooling exists). Preserve existing `clothing_items` and profile/file tables; do not destructively alter unrelated data.

Proposed tables (adjust naming to fit code style):

- `shopping_preferences`: `user_id` FK auth.users unique, structured JSONB or well-defined columns with validation, `updated_at`, `consent_saved_at`; RLS owner-only select/insert/update/delete.
- `products`: UUID or stable ID, canonical title, brand, category, description, composition JSONB/normalized materials, accessibility feature claims, images URLs with provenance, created/updated timestamps. Public read only when data is legitimately displayable. Server-authorized ingestion writes only.
- `product_offers`: source, source_item_id, product FK, retailer, canonical product URL, currency, price, shipping_cost nullable, delivery_estimate nullable, stock_status (`in_stock`, `out_of_stock`, `unknown`), region/country, observed_at, last_checked_at, uniqueness constraint on `(source, source_item_id)` or reliable equivalent. Do not require coordinates for online products.
- `product_evidence` or structured claim storage: feature/material assertions with evidence level/source/checked_at.
- Optional `ingestion_runs` for errors/freshness if low complexity.

Protect sensitive preferences with RLS, prohibit direct client writes to the shared catalog, and avoid service-role secrets in browser bundles. Sanitize external URLs; reject unsafe schemes. Avoid storing arbitrary third-party page HTML or medical narratives. Verify remote schema before running changes when possible; include copy-paste migration steps if Codex cannot connect.

Avoid storing guest preferences in server logs or analytics. Keep short retention of external ingestion data as permitted by source terms. For real product images, show only URLs with permission to display, or licensed assets. Demo mode may use locally created original placeholder assets / CSS visuals. **Never hotlink random copyrighted retailer images.**

## 6. API contracts

Implement routes under `app/api/personal-shopping/` or clear analogous namespace; do not overload existing `/api/chat` with incompatible response data.

### `POST /api/personal-shopping/recommend`

Input: validated preference payload and `mode`. Server caps field sizes, limits requests and result counts, validates enums/country/currency/number ranges, and rejects malformed requests (400). Response:

```json
{
  "mode": "demo",
  "source_status": "sample_data",
  "summary": "Showing jackets that prioritize easy closures.",
  "search_plan": {"queries": ["adaptive easy-close jacket"], "mapped_features": ["easy_fastening"]},
  "results": [
    {
      "id": "sample-jacket-01",
      "title": "Sample Easy-Close Jacket",
      "brand": "Demo Studio",
      "category": "jackets",
      "image_url": "/demo/sample-jacket.svg",
      "offers": [{"retailer": "Demo retailer", "price": 89, "currency": "EUR", "product_url": null, "shipping_cost": null, "delivery_estimate": null, "stock_status": "unknown", "last_checked_at": null}],
      "matched_features": [{"name": "easy_fastening", "evidence": "sample_data"}],
      "unknowns": ["hardware_composition"],
      "match_reasons": ["Sample record includes an easy-close construction"],
      "safety_status": "needs_verification"
    }
  ],
  "needs_verification": [],
  "warnings": ["Demo products and prices are illustrative, not purchasable listings."],
  "generated_at": "ISO timestamp"
}
```

Strictly distinguish demo results and real offers. If a hard restriction is not supported by evidence, **put product only in `needs_verification`, not `results`**. It is acceptable for `results` to be empty; present helpful retry or relax-*preference* suggestions, never silently relax hard allergen restrictions.

### `GET /api/personal-shopping/preferences`, `PUT`, `DELETE`

Require auth. Return signed-in user's data only. `PUT` requires explicit save consent; no implicit saving just by obtaining recommendations. `DELETE` removes saved preferences. Unauthenticated access returns 401. If schema isn't installed, fail with actionable error, not a fake success.

### Optional: `GET /api/personal-shopping/health`

Simple non-sensitive status with adapter configuration/mode and DB readiness, without revealing credentials.

## 7. UI / visual system — high-end fashion x Liquid Glass

**Art direction:** Modern editorial fashion marketplace, not a medical portal. Premium and warm, minimal but expressive. Use the existing React + CSS architecture unless repo inspection proves an alternative is more appropriate. Avoid heavy component/UI frameworks for hackathon speed.

### Visual identity

- Retain brand **FEELING FIND**. Secondary label: **Wear what feels right.**
- Large elegant fashion typography: expressive serif headline paired with clean geometric sans for UI. Use safe fallbacks and avoid dependency on remote fonts at runtime.
- Palette: near-black ink `#202024`, ivory `#F7F5F0`, mauve/lilac tint `#E9DFF0`, pale blush `#F3E5E5`, muted sage `#DCE8E2`, silver highlights. High-contrast text; do not apply pastel text over translucent white.
- **Liquid Glass**: translucent layered panels `backdrop-filter: blur(...) saturate(...)`, subtle edge highlights, 1px translucent borders, inner glow, shallow shadows, curved corners (20–28px). Use stronger solid/opaque surfaces where required for contrast; degrade gracefully where backdrop-filter unsupported.
- Tasteful micro-interactions (hover lift 2–4px, springy selection chips, soft page transition, progress bar) respecting `prefers-reduced-motion`.
- Fashion product imagery should feel editorial. For demo, use coherent **original simple SVG illustrations or authored CSS garment silhouettes**, not misleading random internet product photography. No fake retailer brands or purchasable prices without clear sample badges.

### Optional 3D element

- **Optional enhancement, never a blocker:** a subtle fashion mannequin/abstract 3D garment silhouette in the hero if an existing supported asset or lightweight pure-CSS/SVG approach is appropriate. Prefer performant SVG/CSS over heavy Three.js dependency. If true 3D is added, lazy-load it, provide static fallback, no constant spinning, and respect reduced motion and lower-end devices.
- Do **not** build an anatomical disability avatar or infer personal traits from the selected preferences.

### Layouts

**Homepage**: Keep existing store search accessible; introduce a prominent dual-path hero: **Find clothes for me** (personal agent flow) and **Explore nearby stores** (existing map chat). Do not break `/search?q=...`.

**Onboarding** (`/discover`): Desktop editorial split screen: left aspirational fashion/SVG visual and light narrative, right floating glass step card. Mobile: single-column, sticky progress and next/back controls where appropriate. Display progress "02 / 04" and chips with clear selected/focus states. No diagnosis required. Friendly precise copy, not pity/medical framing.

**Recommendations** (may be `/discover/results` or client state): Editorial headline "Made for the way you move" or "Your edit", filter rail/drawer, product grid (4 desktop / 2 tablet / 1–2 mobile depending viewport), card image, price, source, features, why it fits, evidence chips, delivery if supported, link to retailer for real listings, "Needs verification" separated visually. Loading skeleton, empty, unavailable source, error, and demo states.

**Saved settings**: link from profile to edit personal shopping preferences without replacing existing broad profile/consent form.

**Accessibility is essential**, not optional polish: semantic heading hierarchy, skip link, keyboard controls, visible focus rings, labeled form inputs, adequate contrast, touch targets ~44px, descriptive image alt text, never encode information by color only. Honor reduced motion. Aim WCAG 2.2 AA.

## 8. Engineering plan (implement in this order)

### Phase 0: inspect & protect

1. Read entry points, profile consent code, Supabase schema, CSS and package scripts.
2. Record current `git status` and existing tests. Preserve uncommitted edits.
3. Identify app router/client boundaries and no-key local behavior.

### Phase 1: data/contracts first

1. Define shared JS constants/enums and validation utilities. Prefer existing libs; if adding a validation dependency, document why.
2. Create minimal demo product data with 12–20 diverse original/illustrative records (e.g. magnetic closure shirt, tagless tee, seated-fit trousers, elastic-waist pants, easy-grip jacket); include both definite and unknown material/hardware attributes.
3. Implement deterministic query planner, constraint evaluator, soft ranking, deduplication, evidence mapper and tests. Explicitly test unknown-as-unsafe for hard exclusions.
4. Add optional authorized retailer adapter interface and keep nonconfigured mode honest.

### Phase 2: persistence/API

1. Add additive migration and RLS. Do not alter legacy `clothing_items` destructively.
2. Implement recommend route and preference save/get/delete with proper server-side auth.
3. Ensure guest demo works without Supabase or Anthropic keys; logged-in persistence requires configured Supabase.
4. Add payload limits, minimum error detail, no secrets leak, bounded concurrency and basic rate-limit approach if feasible (document limits of in-memory limiter in serverless).

### Phase 3: polished UX

1. Implement onboarding, results, reusable product card, preference chips and clear hard-vs-soft constraint UI.
2. Add Liquid Glass CSS theme and fashion editorial touches in targeted components; preserve readable legacy map/chat and auth pages.
3. Home dual CTA, profile edit entry, responsive states, keyboard accessibility, empty/verification states.
4. Optional decorative 3D/CSS garment visual only after working flow and accessibility.

### Phase 4: verify

1. Run existing unit checks and new tests; run `npm run build` if dependencies/tooling are available.
2. Verify guest onboarding→demo recommendations; hard exclusion; logged-in load/save/delete with Supabase (or note unverified if no connection); existing `/search` store map; login/profile/file routes; narrow/mobile layout; no-key fallback.
3. Fix feature-related regressions. Do not undertake general legacy code cleanup in this task.

## 9. Mandatory acceptance criteria

- [ ] Existing store-finder chat/maps routes remain functional and retain response formats.
- [ ] New UI allows choosing structured preferences **without writing a prompt** and without needing to select a disability diagnosis.
- [ ] The user can complete the onboarding as a guest and receive meaningful, conspicuously **demo-labeled** results without service keys.
- [ ] Logged-in users can explicitly save, reload, edit and delete shopping preferences; RLS prevents accessing another user's preferences.
- [ ] Recommendation API validates request, consistently returns schema-shaped responses, and distinguishes `demo`, `live`, and unavailable sources.
- [ ] Agent expands user-selected needs into clothing attributes and queries with optional LLM, deterministic fallback, and no invented product facts.
- [ ] Hard avoid-material/hardware constraints are **never** treated as satisfied when composition/evidence is missing or merely LLM-inferred.
- [ ] Match reasons cite actual product attributes; unknown and verification items are visibly separate.
- [ ] Product model supports online-only products and multiple offers without lat/lng requirements, and records source, timestamp, and price/shipping nullability.
- [ ] External retailer URLs and image handling are safe; no direct exposure of private API keys or user-sensitive fields.
- [ ] Fashion-forward Liquid Glass design looks deliberate across desktop and mobile; visible focus, readable contrast, reduced motion and functional fallback.
- [ ] Working loading, empty, error and no-external-source states.
- [ ] At least deterministic planner, filter, ranking, validation and API/demo happy-path tests exist; run them and report actual results.
- [ ] Document exactly how to run the application and apply database migration, plus any configuration dependencies.

## 10. Demo scenarios to verify

1. **Dexterity:** User selects `limited_dexterity`, `jackets`, max €120, DE. Shows demo jackets matching easy-close/large-pull features; exact match reason, clear sample status.
2. **Wool exclusion:** User selects `avoid wool` plus `tops`. A product with `composition: unknown` must **not** appear in the safe-match results; it may appear under Needs verification. A confirmed wool-free item may appear.
3. **Nickel exclusion:** User selects `avoid nickel_hardware`. A product with metal fastener but unknown composition must not appear as safe, regardless of match score.
4. **Sensory:** User selects `tag_free`, `flat_seams`, `soft_fabric`, tees. Results explain verified/reported characteristics; avoid empty blanket claims of suitability.
5. **No keys:** Start local app with no Anthropic, no Maps, no Supabase configuration. Onboarding and demo recommendation journey works. Existing map uses its prior fallback.
6. **Guest privacy:** Guest recommendations do not write preferences to Supabase.
7. **Consent:** Signed-in profile's `use_needs_in_chat=false` does not automatically disable one-time shopping preferences, and does not authorize saving them. Save only after explicit shopping consent.

## 11. Suggested implementation patterns and naming

Use file names that align with actual repository conventions. Proposed examples:

```
app/discover/page.js
app/api/personal-shopping/recommend/route.js
app/api/personal-shopping/preferences/route.js
components/discover/OnboardingWizard.js
components/discover/ProductGrid.js
components/discover/ProductCard.js
components/discover/RecommendationSummary.js
lib/personal-shopping/schema.js
lib/personal-shopping/plan.js
lib/personal-shopping/filter.js
lib/personal-shopping/rank.js
lib/personal-shopping/sources/demo.js
lib/personal-shopping/sources/adapter.js
lib/personal-shopping/agent.js
lib/personal-shopping/demo-catalog.js
supabase/migrations/<timestamp>_personal_shopping.sql
```

Treat these as guidance, not rigid requirements. Avoid writing one giant `route.js`; keep matching testable in pure functions. Use existing server helpers to resolve authenticated users. Keep React/JS instead of TypeScript rewrite. Use straightforward CSS to avoid large dependency churn. Use a small tested server-only integration seam for any future retailer API.

## 12. Explicit trade-offs for the hackathon

**Working personal recommendations and a gorgeous accessible interface beat an unbounded crawling system.** A real universal product aggregator is a later phase and depends on permitted feeds or licensed product APIs. It is okay to ship a demo-only catalog today; it is not okay to claim invented listings are live or allergy-safe. Use the demo to show the full architectural loop and leave a clean source-adapter integration point for legitimate live products.

**Begin implementing now. Do not ask for a separate plan approval.** Report blockers honestly. Do not modify unrelated existing map/chat behavior beyond navigation and coherent styling.
