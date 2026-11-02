// READ-ONLY: runs the real LangGraph in live mode against the real remote Supabase with the site's anon key.
// Proves the query/embeds are valid against the deployed schema. Prints counts only. Usage: node --env-file=.env scripts/live-retrieval-check.mjs
import { createClient } from '@supabase/supabase-js';
import { graphRecommend } from '../lib/personal-shopping/graph.mjs';
import { defaults } from '../lib/personal-shopping/schema.mjs';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
for (const category of ['all', 'shirts']) {
  const r = await graphRecommend({ ...defaults, mode: 'live', category }, { db, userId: null });
  console.log(`live/${category}:`, JSON.stringify({ mode: r.mode, results: r.results.length, diagnostics: r.diagnostics }));
}
