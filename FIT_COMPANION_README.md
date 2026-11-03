# Fit Companion demo

The Discover page currently shows a **Personal agent · Coming soon** button. It opens an informational preview of the planned agent and returns to the working Discover flow. The chat interface below is retained in code for future development but is not exposed through Discover right now.

## Future interactive demo

The companion uses the existing Anthropic server SDK, Supabase catalog and LangGraph recommendation flow. Configure `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (optional), `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the server environment. Do not expose the Anthropic key in a `NEXT_PUBLIC_` variable. With no AI key the standard Discover form still works, and the companion reports that AI is unavailable rather than simulating an answer.

1. When the interactive companion is restored to Discover, run `npm run dev`, open `/discover`, and select its entry button. For now, that button opens the coming-soon preview.
2. Try: “I use a wheelchair, I prefer black casual trousers, and small buttons are difficult.” The latest message is sent to Anthropic. Review and edit the suggested preferences, then choose **Confirm and find clothing**.
3. Product cards use the existing catalog and representative illustrations. Match evidence links lead to the recorded sources. Price, stock, color and style remain unknown where they are not documented.
4. Ask: “Please avoid magnetic closures.” Review and confirm that suggestion. Exclusions and required features are deterministic; missing evidence is unknown, not compatible. The current catalog may return no matches because it does not document the absence of magnets. This is not a promise of magnet-free items.
5. In an authenticated account, choose **Remember these preferences** to explicitly save confirmed preferences. Only the structured preferences are saved in `shopping_preferences` under the signed-in user; conversation messages and session dismissals are not saved. Use **Delete saved shopping preferences** to remove saved preferences. Session preferences and dismissals last only while the companion remains open. Saved material/fastening exclusions and required features remain active until saved preferences are deleted.

The AI only proposes structured values; the user confirms them before use. Unsupported constraints can be flagged for manual review, which blocks confirmed matches rather than silently dropping the restriction. Users can also edit preferences manually. AI output never supplies product facts. Suggestions are not medical advice; verify details with the retailer.

Run the deterministic unit tests with `node --test tests/*.test.mjs`. Run the current preview browser scenario with `npx playwright test e2e/personal-agent-preview.spec.mjs`. The separate `e2e/fit-companion-live.spec.mjs` is skipped by default; set `RUN_LIVE_FIT_COMPANION=1` to explicitly run two paid Anthropic calls and read the configured Supabase catalog. The live test depends on provider availability and the current catalog.
