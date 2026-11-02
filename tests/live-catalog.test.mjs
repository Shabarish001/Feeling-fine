import test from 'node:test';
import assert from 'node:assert/strict';
import { graphRecommend, adaptCatalog } from '../lib/personal-shopping/graph.mjs';
import { defaults } from '../lib/personal-shopping/schema.mjs';
import { fixtureLiveRows, fixtureDb } from '../lib/personal-shopping/e2e-store.mjs';

// FIXTURE rows (clearly labelled, reserved .test domain) in the exact Supabase shape. They test the mapping and the
// rules. They say nothing about what the real remote catalog contains (see REAL_CATALOG_INTEGRATION_REPORT.md).
const live = (x = {}) => graphRecommend({ ...defaults, mode: 'live', ...x }, { db: fixtureDb(null), userId: null });
const byTitle = (r, t) => r.results.find((p) => p.title.includes(t));

test('live retrieval maps image, price in its own currency, direct link, retailer and timestamp', async () => {
  const r = await live();
  assert.equal(r.mode, 'live');
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((p) => !p.id.startsWith('sample-')), 'no demo products in live mode');
  const shirt = byTitle(r, 'Magnetic Shirt');
  assert.equal(shirt.image_url, 'https://fixtures.feelingfind.test/images/fixture-1.svg');
  assert.deepEqual([shirt.offers[0].price, shirt.offers[0].currency], [89.9, 'GBP']); // never converted
  assert.equal(shirt.offers[0].product_url, 'https://fixtures.feelingfind.test/products/fixture-1');
  assert.equal(shirt.offers[0].retailer, 'Fixture Retailer (test data)');
  assert.equal(shirt.offers[0].verified_at, '2026-11-01T10:00:00Z');
  assert.equal(byTitle(r, 'Tagless Tee').offers[0].currency, 'USD');
});

test('missing image or link stays missing (never invented)', async () => {
  const trouser = byTitle(await live(), 'Seated Trouser');
  assert.equal(trouser.image_url, null);
  assert.equal(trouser.offers[0].product_url, null);
});

test('an image without an approved rights note is not displayed', () => {
  const row = structuredClone(fixtureLiveRows[0]);
  row.product_images[0].license_note = null;
  assert.equal(adaptCatalog(row).image_url, null);
  row.product_images[0].license_note = 'Approved source: http://insecure.test/rights';
  assert.equal(adaptCatalog(row).image_url, null);
});

test('a non-https retailer link is dropped', () => {
  const row = structuredClone(fixtureLiveRows[0]);
  row.product_offers[0].product_url = 'http://fixtures.feelingfind.test/p';
  assert.equal(adaptCatalog(row).offers[0].product_url, null);
});

test('seller-claimed features make a product relevant to a need, labelled as unverified', async () => {
  const r = await live({ needs: ['easy_fastening'] });
  assert.deepEqual(r.results.map((p) => p.title.replace(' (test data)', '')), ['FIXTURE Magnetic Shirt']);
  const reasons = r.results[0].match_reasons.join(' ');
  assert.match(reasons, /Seller-claimed feature \(not independently verified\): easy fastening/);
  assert.doesNotMatch(reasons, /^Documented/);
});

test('seller claims never satisfy a required feature (hard restriction stays strict)', async () => {
  assert.deepEqual((await live({ required_features: ['easy_fastening'] })).results, []);
});

test('verified evidence satisfies a required feature', async () => {
  const r = await live({ required_features: ['seated_fit'] });
  assert.deepEqual(r.results.map((p) => p.id.slice(-1)), ['2']);
});

test('avoided materials need verified absence; missing evidence is unknown, not safe', async () => {
  const wool = await live({ avoid_materials: ['wool'] });
  assert.deepEqual(wool.results.map((p) => p.id.slice(-1)), ['1']); // only the garment with a verified wool-free spec
  assert.deepEqual((await live({ avoid_materials: ['latex'] })).results, []);
});

test('feature aliases bridge retailer wording to onboarding needs without inventing evidence', async () => {
  const r = await live({ needs: ['sensory_softness'] });
  assert.deepEqual(r.results.map((p) => p.id.slice(-1)), ['3']); // tagless + soft_seams claims
  assert.deepEqual((await live({ needs: ['tag_free'], category: 'shirts' })).results, []);
});

test('live mode with no products never falls back to samples', async () => {
  const empty = { auth: { getUser: async () => ({ data: { user: null } }) }, from: () => ({ select() { return this; }, in() { return this; }, limit: async () => ({ data: [], error: null }) }) };
  const r = await graphRecommend({ ...defaults, mode: 'live' }, { db: empty, userId: null });
  assert.deepEqual(r.results, []);
  assert.equal(r.diagnostics.available, 0);
});

test('a database error is reported, not hidden behind samples', async () => {
  const broken = { from: () => ({ select() { return this; }, in() { return this; }, limit: async () => ({ data: null, error: { message: 'boom' } }) }) };
  await assert.rejects(graphRecommend({ ...defaults, mode: 'live' }, { db: broken, userId: null }), /Could not read the product catalog/);
});
