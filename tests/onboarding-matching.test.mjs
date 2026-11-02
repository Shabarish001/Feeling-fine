import test from 'node:test';
import assert from 'node:assert/strict';
import { graphRecommend } from '../lib/personal-shopping/graph.mjs';
import { defaults } from '../lib/personal-shopping/schema.mjs';
import { demoCatalog } from '../lib/personal-shopping/demo-catalog.mjs';
import { NEED_GROUPS, groupCoverage, categoryCounts, previewCount, materialCoverage } from '../lib/personal-shopping/needs.mjs';
import { explainEmpty, activeFilters } from '../lib/personal-shopping/explain.mjs';
import { applyStages } from '../lib/personal-shopping/matching.mjs';

const prefs = (x = {}) => ({ ...defaults, ...x });
const group = (id) => NEED_GROUPS.find((g) => g.id === id);

test('the default category explores everything instead of silently choosing tops', () => {
  assert.equal(defaults.category, 'all');
});

test('every advertised need group has at least one compatible sample, and seated comfort is honestly limited', () => {
  for (const g of NEED_GROUPS) assert.ok(groupCoverage(demoCatalog, g).total > 0, g.id);
  assert.deepEqual(groupCoverage(demoCatalog, group('seated')).categories, ['trousers']);
});

test('UI availability counts equal what the real graph returns', async () => {
  for (const g of NEED_GROUPS) for (const category of ['all', 'tops', 'shirts', 'trousers', 'dresses', 'jackets', 'shoes']) {
    const p = prefs({ needs: g.needs, category });
    const r = await graphRecommend(p);
    assert.equal(categoryCounts(demoCatalog, p, [category])[category], r.results.length, `${g.id}/${category}`);
    assert.equal(previewCount(demoCatalog, p), r.results.length);
  }
});

test('chosen needs are a relevance requirement, never filler', async () => {
  const r = await graphRecommend(prefs({ needs: ['easy_fastening'], category: 'tops' }));
  assert.deepEqual(r.results, []);
  assert.equal(r.diagnostics.filters[0].filter, 'needs');
});

test('hard restrictions are applied before ranking and unknown is not safe', async () => {
  const r = await graphRecommend(prefs({ needs: group('easy_dressing').needs, avoid_materials: ['wool'] }));
  assert.ok(r.results.length > 0);
  for (const x of r.results) assert.ok(x.evidence.some((e) => e.attribute === 'wool' && e.value === 'absent'));
  for (const unknown of ['sample-p03', 'sample-j03', 'sample-f01', 'sample-f02']) assert.ok(!r.results.some((x) => x.id === unknown));
});

test('polyester cannot be verified by any sample, so avoiding it yields an honest empty result', async () => {
  assert.equal(materialCoverage(demoCatalog, 'polyester'), 0);
  const p = prefs({ needs: group('sensory').needs, avoid_materials: ['polyester'] });
  const r = await graphRecommend(p);
  assert.deepEqual(r.results, []);
  const why = explainEmpty(r.diagnostics, p);
  assert.match(why.reasons.join(' '), /could not be confirmed free/);
  assert.deepEqual(why.actions, []); // never offers to relax a material restriction
});

test('empty-state actions only touch optional filters', async () => {
  const p = prefs({ needs: group('easy_dressing').needs, max_price: 10 });
  const why = explainEmpty((await graphRecommend(p)).diagnostics, p);
  assert.deepEqual(why.actions.map((a) => a.patch), [{ max_price: null }]);
  const wrongCategory = prefs({ needs: ['seated_fit'], category: 'shirts' });
  const alt = explainEmpty((await graphRecommend(wrongCategory)).diagnostics, wrongCategory);
  assert.deepEqual(alt.actions.map((a) => a.patch), [{ category: 'all' }]);
  assert.match(alt.reasons.join(' '), /Trousers \(1\)/);
});

test('live mode never falls back to samples and explains the empty catalog', async () => {
  const p = prefs({ needs: ['easy_dressing'], mode: 'live' });
  const r = await graphRecommend(p);
  assert.deepEqual(r.results, []);
  assert.equal(r.diagnostics.mode, 'live');
  assert.match(explainEmpty(r.diagnostics, p).reasons[0], /live catalog/);
});

test('saved free-text restrictions are not duplicated when the client sends them back', async () => {
  const saved = prefs({ custom_restrictions: 'itchy seams' });
  const db = { from() { return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { preferences: saved } }), order() { return this; }, limit: async () => ({ data: [] }) }; } };
  const r = await graphRecommend(prefs({ custom_restrictions: 'itchy seams; wool' }), { db, userId: 'u1' });
  assert.deepEqual(r.results, []);
  assert.equal(activeFilters(prefs({ custom_restrictions: 'x' })).some((f) => f.id === 'custom_restrictions'), true);
});

test('diagnostics are counts only', async () => {
  const r = await graphRecommend(prefs({ needs: ['easy_dressing'], avoid_materials: ['wool'], notes: 'private note' }));
  const text = JSON.stringify(r.diagnostics);
  assert.ok(!text.includes('private note') && !text.includes('wool'));
  assert.equal(applyStages(demoCatalog, prefs({ needs: ['easy_dressing'] }), true).eligible.length, r.diagnostics.available - r.diagnostics.filters[0].excluded);
});
