# Playwright personalization report

**Overall: PARTIAL.** On 2026-11-02 the final Chromium run had **9 passed, 1 skipped**. Core demo personalization, the real Next.js recommendation endpoint and LangGraph, hard filtering, local feedback, and the read-only live empty state were exercised through the browser. Real Supabase authenticated preference/feedback durability and live recommendations with real inventory were not verified. No production catalog data was written.

| Scenario | Result | Scope |
| --- | --- | --- |
| Homepage navigation | PASS | Discovery loads; no uncaught page errors were observed. |
| Onboarding and payload | PASS | Hand dexterity, required fastening, shirts and budget reach the real recommendation route. |
| Same category, different profiles | PASS | Hand profile ranks Sample Easy Close Shirt first; sensory profile ranks Sample Soft Seam Shirt first. Both query shirts and explanations identify sample features. |
| Wool exclusion and required features | PASS, limited | The local test profile excludes known-wool and unknown-fabric fixtures, including when a request attempts to omit the saved exclusion. Required fastening needs sample evidence. This does not prove real-world allergy safety. |
| Budget and currency | PASS | EUR budget is enforced; USD budget does not accept EUR fixture prices. No currency conversion is attempted. |
| Feedback and preference memory | PASS, local store | Dislike changes the next ranking; saved preferences survive a new browser context while the local test server remains running. |
| Supabase authenticated persistence | SKIP | No isolated Supabase project or authorized disposable test account was provided. No shared-user data was modified. |
| Live empty catalog | PASS | Actual read-only live query returns no products; UI shows an empty state and does not substitute demo products. |
| Responsive UI | PARTIAL | Desktop and 390px mobile screenshots, image fallbacks, and initial keyboard tab were checked. A full accessibility audit, complete keyboard traversal and all loading/error states were not tested. |
| Error handling | PARTIAL | Malformed recommendation and unauthenticated feedback requests return controlled errors. An injected graph node failure was not exercised. |

## Graph execution and safety

The test-only node trace recorded `loadUserPreferences → interpretClothingNeeds → retrieveProducts → verifyRestrictions → rankProducts → explainRecommendations`; assertions also check that restriction verification precedes ranking and that results match the profile. Instrumentation emits node names only, is enabled by `E2E_GRAPH_TRACE=1` and is disabled in production. No private preferences or credentials are logged.

The isolated test boundary in `lib/personal-shopping/e2e-store.mjs` is active only in a non-production process with that flag and a test-user header. It uses process memory and does not call Supabase. A new browser context with the same test identity reads the same server memory; it does **not** prove storage across server restarts or actual Supabase authentication. React state, browser context, graph invocation state and Supabase storage are distinct. Demo feedback controls are exposed only for this test boundary; normal demo products remain non-purchasable samples.

## Findings and changes

- The existing development server occupied the normal Next.js build directory. Playwright now uses a separate `.next-e2e` directory and port 3107 rather than stopping the user's server.
- Initial browser runs could not start because the matching Chromium version was absent. Chromium was installed and the suite rerun.
- The UI showed corrupted punctuation in several labels and an obsolete “live unavailable” option; those labels were corrected. Existing Maps, authentication and database schema were not changed.
- A test-only graph trace and isolated in-memory feedback boundary were added to test actual UI → API → graph behavior without production writes. No migrations or retailer imports were performed.

## Artifacts and reproduction

Run from `Feeling-fine`:

```text
npm install
npx playwright install chromium
npm run test:e2e
node --test tests/*.test.mjs
npm run build
```

The final run produced an HTML report at `playwright-report/index.html`. Screenshots are under `test-results/`: `personalization-homepage-n-26742-oarding-without-page-errors-chromium/onboarding-desktop.png`, `personalization-hand-mobil-e0393-nd-real-graph-nodes-execute-chromium/hand-results.png`, `personalization-live-catal-1e079-oes-not-substitute-fixtures-chromium/live-empty.png`, and `personalization-mobile-onb-bca63-rd-and-shows-image-fallback-chromium/` (mobile onboarding and results). The mobile results screenshot was visually inspected. Screenshots, traces and videos are ignored by Git. Traces, screenshots and videos are retained on test failure; there were no failures in the final run, so no final failure trace exists.

Final verification: 41 Node tests passed; the production build passed. The local in-memory results must not be interpreted as proof of durable remote feedback, approved product imagery, real prices or a populated live catalog.
