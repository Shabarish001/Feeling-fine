// Per-record import blockers from the importer's own preview data. Writes artifacts/import-blockers.{json,md}.
// Invents nothing: it only lists what each CSV record lacks against the importer's eligibility rules.
import { readFileSync, writeFileSync } from 'node:fs';
const preview = JSON.parse(readFileSync('artifacts/spreadsheet-import-preview.json', 'utf8'));
const https = (s) => { try { return new URL(s).protocol === 'https:'; } catch { return false; } };
const records = preview.products.map((p) => {
  const data = [];       // facts missing from the CSV itself
  if (!p.category) data.push('clothing category');
  if (!https(p.product_url)) data.push('direct https product URL');
  if (!https(p.image_url)) data.push('product image URL');
  if (!p.price_observed_date) data.push('price observation date');
  if (p.material) data.push('(material is present, so material_verified + material_evidence_url are required)');
  // Human attestations required by the importer for EVERY record (no approvals file exists).
  const attestations = ['reference_url (price source)', 'feature_evidence_url', 'rights_reference_url (image rights)', 'url_verified=true', 'image_matches_product=true', 'accessibility_verified=true', 'storage_and_display_approved=true', 'image_display_approved=true', 'checked_at within 7 days', 'price/currency/image_url matching the CSV row'];
  if (p.material) attestations.push('material_verified=true', 'material_evidence_url');
  return { name: p.name, retailer: p.retailer, product_url: p.product_url, price: `${p.currency} ${p.price}`, image_permission: p.image_permission, missing_in_csv: data, missing_attestations: attestations, importer_review_reasons: p.review_reasons };
});
writeFileSync('artifacts/import-blockers.json', JSON.stringify({ generated_for: 'data/imports/*.csv', total: records.length, eligible: 0, records }, null, 2));
const tally = (key) => records.reduce((m, r) => { for (const x of r[key]) m[x] = (m[x] || 0) + 1; return m; }, {});
const lines = ['# Import blockers (generated)', '', `Records: ${records.length}. Eligible for import: **0**.`, '', '## Missing in the CSV data', ...Object.entries(tally('missing_in_csv')).map(([k, v]) => `- ${k}: ${v} of ${records.length}`), '', '## Required by the importer for every record (no approvals file exists)', ...records[0].missing_attestations.map((x) => `- ${x}`), '', '## Per record', '', '| Product | Retailer | Missing in CSV |', '|---|---|---|', ...records.map((r) => `| ${r.name} | ${r.retailer} | ${r.missing_in_csv.filter((x) => !x.startsWith('(')).join('; ') || 'nothing beyond attestations'} |`)];
writeFileSync('artifacts/import-blockers.md', lines.join('\n') + '\n');
console.log(lines.slice(0, 12).join('\n'));
