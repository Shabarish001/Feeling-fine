// READ-ONLY remote catalog diagnostics. Prints counts only, never keys. Usage: node --env-file=.env scripts/remote-counts.mjs
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log('project ref matches expected:', new URL(url).hostname.startsWith('aceopapwpgpwyypopofi.'));
const tables = ['products','product_variants','retailers','product_offers','product_price_observations','product_images','product_evidence','product_attributes','product_materials','shopping_preferences','product_feedback'];
for (const [label, key] of [['anon/publishable (what the website sees)', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY], ['service role (true contents)', process.env.SUPABASE_SERVICE_ROLE_KEY]]) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  console.log('\n==', label);
  for (const t of tables) {
    const { count, error } = await db.from(t).select('*', { count: 'exact', head: true });
    console.log(t.padEnd(28), error ? `ERROR: ${error.code || ''} ${error.message.slice(0, 90)}` : count);
  }
}
