import { createClient } from '@/lib/supabase/server';
import { testCatalog, fixtureLiveRows } from '@/lib/personal-shopping/e2e-store.mjs';

// Read-only: how many products the live catalog holds. The onboarding uses it to be honest about live availability.
// Counts only; no product data. Public-read RLS already allows this for the anon role.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (testCatalog(request)) return Response.json({ live_products: fixtureLiveRows.length }, { headers });
    const db = await createClient();
    if (!db) return Response.json({ live_products: 0, available: false }, { headers });
    const { count, error } = await db.from('products').select('id', { count: 'exact', head: true });
    if (error) return Response.json({ live_products: 0, available: false }, { headers });
    return Response.json({ live_products: count ?? 0, available: true }, { headers });
  } catch {
    return Response.json({ live_products: 0, available: false }, { headers });
  }
}
