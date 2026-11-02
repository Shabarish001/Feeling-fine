import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const requiredFields = ['name', 'brand', 'retailer', 'product_url', 'category', 'summary', 'features', 'evidence'];
const allowedGroups = new Set(['hand', 'sensory', 'wheelchair', 'easy_dressing', 'fabric']);
const httpsUrl = (value) => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const uuid = (value) => {
  const hex = createHash('sha256').update(`feeling-find/adaptive-catalog/v1/${value}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = ((parseInt(hex[16], 16) & 3) | 8).toString(16);
  const h = hex.join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export function validateCatalog(catalog) {
  if (!catalog || !Array.isArray(catalog.products)) throw new Error('Expected a products array');
  const seen = new Set();
  for (const p of catalog.products) {
    if (!httpsUrl(p.product_url) || new URL(p.product_url).search || new URL(p.product_url).hash || seen.has(p.product_url)) throw new Error('Invalid or duplicate canonical product URL');
    seen.add(p.product_url);
    if (!allowedGroups.has(p.group) || !['shirt', 'trousers', 'jacket', 'cardigan'].includes(p.category) || !p.name || (p.brand !== null && (typeof p.brand !== 'string' || !p.brand.trim())) || !p.retailer || !p.summary || !Array.isArray(p.features) || !p.features.length || p.features.some((f) => typeof f !== 'string' || !f.trim()) || new Set(p.features).size !== p.features.length) throw new Error(`Invalid product: ${p.product_url}`);
    if (!Array.isArray(p.evidence) || !p.evidence.some((e) => e.source_url === p.product_url && e.kind === 'seller_claim' && /^\d{4}-\d{2}-\d{2}$/.test(e.checked_at) && Number.isFinite(Date.parse(e.checked_at)))) throw new Error(`Missing seller evidence: ${p.product_url}`);
    if (!['review_only', 'approved', 'excluded'].includes(p.rights_status)) throw new Error('Invalid rights status');
    if (p.image_url !== null) throw new Error('Images are not supported by this importer');
    if (p.rights_status === 'approved' && (!httpsUrl(p.approval_reference) || !Array.isArray(p.approved_fields) || requiredFields.some((f) => !p.approved_fields.includes(f)))) throw new Error(`Approval and field-specific rights required: ${p.product_url}`);
  }
  return catalog.products.filter((p) => p.rights_status === 'approved');
}

export function mapProduct(p) {
  const productId = uuid(`product/${p.product_url}`);
  const offerId = uuid(`offer/${p.product_url}`);
  const source = p.evidence.find((e) => e.source_url === p.product_url && e.kind === 'seller_claim');
  const checked = `${source.checked_at}T00:00:00.000Z`;
  const product = { id: productId, title: p.name, brand: p.brand, category: p.category, description: p.summary, images: [] };
  const offer = { id: offerId, product_id: productId, source: 'adaptive_catalog_review', source_item_id: p.product_url, retailer: p.retailer, product_url: p.product_url, stock_status: 'unknown', last_checked_at: checked };
  const evidence = p.features.map((feature) => ({ id: uuid(`evidence/${p.product_url}/${feature}`), product_id: productId, attribute: feature, value: true, evidence_type: 'unverified_seller_claim', evidence_text_or_source: feature, source_url: p.product_url, checked_at: checked }));
  const attributes = evidence.map((e) => ({ id: uuid(`attribute/${p.product_url}/${e.attribute}`), product_id: productId, attribute: e.attribute, value: true, evidence_id: e.id }));
  return { product, offer, evidence, attributes };
}

async function run() {
  const { main } = await import('./import-csv-products.mjs');
  await main();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run().catch((e) => { console.error(e.message); process.exitCode = 1; });
