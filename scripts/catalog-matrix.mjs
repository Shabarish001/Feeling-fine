// Prints the demo-catalog compatibility matrix (Markdown) from the real fixtures and the real matching engine.
import { demoCatalog } from '../lib/personal-shopping/demo-catalog.mjs';
import { NEED_GROUPS } from '../lib/personal-shopping/needs.mjs';
import { applyStages } from '../lib/personal-shopping/matching.mjs';
import { defaults } from '../lib/personal-shopping/schema.mjs';
const h = (s) => s.replaceAll('_', ' ');
const rows = demoCatalog.map((p) => {
  const feats = p.evidence.filter((e) => e.value === true).map((e) => e.attribute);
  const absent = p.evidence.filter((e) => e.value === 'absent').map((e) => e.attribute);
  const groups = NEED_GROUPS.filter((g) => applyStages([p], { ...defaults, needs: g.needs }, true).eligible.length).map((g) => g.id);
  const missing = [];
  if (!p.materials?.length) missing.push('materials');
  missing.push('sizes/variants', 'stock', 'image');
  return `| ${p.id.replace('sample-', '')} | ${p.category} | ${feats.map(h).join(', ') || 'none'} | ${p.materials?.join(', ') || 'undocumented'} | ${absent.map(h).join(', ') || 'none'} | ${groups.join(', ') || 'none'} | ${missing.join(', ')} |`;
});
console.log('| ID | Category | Documented features | Documented materials | Declared absent | Supports need groups | Missing attributes |');
console.log('|---|---|---|---|---|---|---|');
console.log(rows.join('\n'));
