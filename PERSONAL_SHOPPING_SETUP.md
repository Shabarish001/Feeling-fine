# Personal shopping setup

The `/discover` flow uses an illustrative local demo catalog. Its products, descriptions, prices and declarations are fictional, with no purchasable offers. No Anthropic, Google, or Supabase key is required for guest recommendations. Live and cached live modes return `unavailable`; no authorized retailer feed is configured. `lib/personal-shopping/sources/adapter.mjs` defines the seam for a future permitted source. Implement source-specific URL/image validation, provenance, freshness and safe ingestion before connecting one. The migration's catalog tables are staged for that integration; the current recommendation pipeline does not read or write them.

## Run

Use Node.js and run `npm ci`, then `npm run dev`; open `http://localhost:3000/discover`. On Windows PowerShell, use `npm.cmd` if script execution policies block `npm`. Run `node --test tests/personal-shopping.test.mjs` and `npm run build` to verify.

## Optional account persistence

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the existing Supabase auth setup. Apply `supabase/schema.sql` to a new project first, then apply `supabase/migrations/202611020001_personal_shopping.sql` once through the Supabase SQL Editor or your migration workflow. Review the migration and existing remote schema before applying it. No migration was applied by this change. The new tables have owner-only RLS for shopping preferences and public read-only catalog policies; shared catalog writes have no client policy. The profile links to `/discover` to edit or delete preferences. Saving requires the explicit shopping consent checkbox and is independent of chat consent. Guest selections remain in page memory.

## Current boundaries

Search planning, matching, and demo evidence are deterministic; no LLM or retailer is called. There is no real catalog ingestion, live cache lookup, scheduled refresh, or retailer integration. Size, fit, shipping, and custom restrictions cannot be verified by demo records; custom restrictions place results under Needs verification. Country and delivery are collected for future sources and do not imply shipping availability. A maximum price in a different currency will not match EUR demo prices. Notes are not interpreted. The demo catalog has no real stock or product URLs. Unknown material/hardware exclusions go to Needs verification; documented sample exclusions are illustrative only and are never medical assurances. Product source adapters must not treat inferred or unverified seller claims as proof of an exclusion. The current endpoint has payload validation but no distributed rate limiter; apply deployment-level limits before exposing a paid live integration.
