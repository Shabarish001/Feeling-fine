import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, mapProduct } from '../scripts/import-adaptive-catalog.mjs';

const catalog = JSON.parse(await readFile(new URL('../artifacts/adaptive-catalog-candidates.json', import.meta.url)));
test('research candidates are unique, evidenced and review-only', () => {
  assert.equal(catalog.products.length, 30);
  assert.equal(validateCatalog(catalog).length, 0);
  assert.equal(new Set(catalog.products.map((p) => p.product_url)).size, 30);
  for (const group of ['hand', 'sensory', 'wheelchair', 'easy_dressing', 'fabric']) assert.equal(catalog.products.filter((p) => p.group === group).length, 6);
});
test('approval requires a reference and permission for each imported field', () => {
  const p = structuredClone(catalog.products[0]); p.rights_status = 'approved';
  assert.throws(() => validateCatalog({ products: [p] }), /field-specific rights/);
  p.approval_reference = 'https://example.org/license';
  p.approved_fields = ['name', 'brand', 'retailer', 'product_url', 'category', 'summary', 'features', 'evidence'];
  assert.equal(validateCatalog({ products: [p] }).length, 1);
  assert.deepEqual(mapProduct(p), mapProduct(p));
  assert.notEqual(mapProduct(p).product.id, mapProduct(p).offer.id);
});
test('refuses duplicate URLs, missing evidence, and images', () => {
  const p = structuredClone(catalog.products[0]);
  assert.throws(() => validateCatalog({ products: [p, p] }), /duplicate/);
  p.evidence = []; assert.throws(() => validateCatalog({ products: [p] }), /evidence/);
  p.evidence = structuredClone(catalog.products[0].evidence); p.image_url = 'https://example.org/image.jpg';
  assert.throws(() => validateCatalog({ products: [p] }), /Images/);
});
