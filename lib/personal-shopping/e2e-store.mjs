// Local Playwright boundary only. Never enabled in production and never uses Supabase.
const state=globalThis.__feelingFindE2EStore ||= new Map();
import { demoCatalog } from './demo-catalog.mjs';
const shirt=demoCatalog.find(p=>p.id==='sample-s02');
export const testFixtures=[...demoCatalog,
  {...shirt,id:'sample-wool',title:'Sample Wool Test Shirt',materials:['wool'],evidence:shirt.evidence.filter(e=>e.attribute!=='wool')},
  {...shirt,id:'sample-unknown',title:'Sample Unknown Fabric Shirt',materials:null,evidence:shirt.evidence.filter(e=>e.attribute!=='wool')},
];
export function testUser(request) {
  if(process.env.NODE_ENV==='production'||process.env.E2E_GRAPH_TRACE!=='1') return null;
  const id=request.headers.get('x-e2e-user');
  return /^[a-z0-9-]{1,40}$/.test(id||'') ? id : null;
}
export function testRecord(user) { if(!state.has(user)) state.set(user,{preferences:null,feedback:[]}); return state.get(user); }
export function testDb(user) {
  const record=testRecord(user);
  return {from(table){return {select(){return this},eq(key,value){if(key!=='user_id'||value!==user) throw Error('Test user mismatch');return this},maybeSingle:async()=>({data:record.preferences?{preferences:record.preferences}:null,error:null}),order(){return this},limit:async()=>({data:record.feedback,error:null})}}};
}

// ---- Controlled FIXTURE live catalog (tests only) -------------------------------------------------------------
// Rows use the exact shape Supabase returns for `products` with embedded relations, so they exercise the real
// live-retrieval mapping. They are NOT real inventory: every name says so, and the URLs use a reserved .test domain.
// Reachable only with the local test gate (non-production + E2E_GRAPH_TRACE=1) and header `x-e2e-catalog: fixture`.
const FIXTURE_HOST = 'https://fixtures.feelingfind.test';
const iso = '2026-11-01T10:00:00Z';
function fixtureProduct({ n, title, category, brand = 'Fixture Brand', retailer = 'Fixture Retailer (test data)', price, currency, url = true, image = true, claims = [], verified = [], absent = [], materials = [] }) {
  const id = `00000000-0000-4000-8000-00000000000${n}`;
  const ev = (attribute, value, type, extra = {}) => ({ id: `${id}-ev-${attribute}`, product_id: id, attribute, value, evidence_type: type, evidence_text_or_source: `${type} (fixture)`, source_url: type === 'unverified_seller_claim' ? null : `${FIXTURE_HOST}/spec/${n}`, checked_at: type === 'unverified_seller_claim' ? null : iso, variant_id: null, offer_id: null, ...extra });
  const evidence = [...claims.map((a) => ev(a, true, 'unverified_seller_claim')), ...verified.map((a) => ev(a, true, 'retailer_spec')), ...absent.map((a) => ev(a, 'absent', 'retailer_spec')), ...materials.map((m) => ev(`material-${m}`, m, 'retailer_spec'))];
  return {
    id, title, brand, category, description: 'FIXTURE product used only for automated UI tests. Not real inventory.',
    product_offers: [{ id: `${id}-offer`, product_id: id, source: 'fixture', source_item_id: `fixture-${n}`, retailer, retailers: { name: retailer, website_url: FIXTURE_HOST }, product_url: url ? `${FIXTURE_HOST}/products/fixture-${n}` : null, currency, price, shipping_cost: null, stock_status: 'unknown', price_observed_at: iso, last_checked_at: null, observed_at: null, variant_id: null }],
    product_variants: [],
    product_images: image ? [{ id: `${id}-img`, product_id: id, image_url: `${FIXTURE_HOST}/images/fixture-${n}.svg`, source_url: `${FIXTURE_HOST}/images`, license_note: `Approved source: ${FIXTURE_HOST}/rights`, position: 0 }] : [],
    product_materials: materials.map((m) => ({ id: `${id}-mat-${m}`, product_id: id, material: m, evidence_id: `${id}-ev-material-${m}` })),
    product_attributes: [...claims, ...verified].map((a) => ({ id: `${id}-attr-${a}`, product_id: id, attribute: a, value: true, evidence_id: `${id}-ev-${a}` })),
    product_evidence: evidence,
  };
}
export const fixtureLiveRows = [
  fixtureProduct({ n: 1, title: 'FIXTURE Magnetic Shirt (test data)', category: 'shirts', price: 89.9, currency: 'GBP', claims: ['magnetic_closure', 'one_hand_dressing'], absent: ['wool'], materials: ['cotton'] }),
  fixtureProduct({ n: 2, title: 'FIXTURE Seated Trouser (test data)', category: 'trousers', price: 120, currency: 'EUR', verified: ['seated_fit'], image: false, url: false }),
  fixtureProduct({ n: 3, title: 'FIXTURE Tagless Tee (test data)', category: 'tops', price: 35, currency: 'USD', claims: ['tagless', 'soft_seams'] }),
];
export const testCatalog = (request) => process.env.NODE_ENV !== 'production' && process.env.E2E_GRAPH_TRACE === '1' && request.headers.get('x-e2e-catalog') === 'fixture';
export function fixtureDb(user) {
  const prefs = user ? testDb(user) : null;
  return {
    auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) },
    from(table) {
      if (table === 'products') {
        // Honour .in('category', [...]) like the real database does.
        let cats = null;
        return { select() { return this; }, in(_col, values) { cats = values; return this; }, limit: async () => ({ data: cats ? fixtureLiveRows.filter((r) => cats.includes(r.category)) : fixtureLiveRows, error: null }) };
      }
      if (prefs) return prefs.from(table);
      return { select() { return this; }, eq() { return this; }, order() { return this; }, maybeSingle: async () => ({ data: null, error: null }), limit: async () => ({ data: [], error: null }) };
    },
  };
}
