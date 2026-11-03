// Plain-language explanations of what filters are active and why a search came back empty.
// Pure functions over the preferences and the counts-only `diagnostics` returned by the API.
import { defaults } from './schema.mjs';
import { categoryLabel } from './needs.mjs';

export const humanize = (s) => String(s).replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const list = (a) => a.map(humanize).join(', ');

// Every filter currently shaping the results. `hard` ones can exclude products; `reset` (when present) removes an optional one.
export function activeFilters(p) {
  const out = [];
  if (p.needs.length) out.push({ id: 'needs', hard: true, text: `Needs: ${list(p.needs)}` });
  if (p.category !== 'all') out.push({ id: 'category', hard: true, text: `Category: ${categoryLabel(p.category)}`, reset: { category: 'all' } });
  if (p.avoid_materials.length) out.push({ id: 'avoid_materials', hard: true, locked: true, text: `Must avoid: ${list(p.avoid_materials)}` });
  if (p.avoid_features?.length) out.push({ id: 'avoid_features', hard: true, locked: true, text: `Avoid fastenings: ${list(p.avoid_features)}` });
  if (p.required_features.length) out.push({ id: 'required_features', hard: true, locked: true, text: `Required: ${list(p.required_features)}` });
  if (p.custom_restrictions.trim()) out.push({ id: 'custom_restrictions', hard: true, locked: true, text: 'Other restriction (needs manual check)' });
  if (p.max_price !== null) out.push({ id: 'max_price', hard: true, text: `Budget: ${p.currency} ${p.max_price}`, reset: { max_price: null } });
  if (p.size) out.push({ id: 'size', hard: true, text: `Size: ${p.size}`, reset: { size: '' } });
  if (p.style.length) out.push({ id: 'style', hard: false, text: `Style: ${list(p.style)}`, reset: { style: [] } });
  if (p.colors.length) out.push({ id: 'colors', hard: false, text: `Colors: ${list(p.colors)}`, reset: { colors: [] } });
  if (p.fit) out.push({ id: 'fit', hard: false, text: `Fit: ${humanize(p.fit)}`, reset: { fit: '' } });
  if (p.mode !== 'demo') out.push({ id: 'mode', hard: true, text: 'Source: live catalog' });
  return out;
}

// Optional refinements that limit results and may have been saved earlier (shown so they are never a surprise).
export function savedRefinements(p) {
  return activeFilters(p).filter((f) => ['max_price', 'size'].includes(f.id));
}

export const optionalDefaults = { max_price: defaults.max_price, size: defaults.size, style: [], colors: [], fit: '' };

// Explain an empty result. Returns reasons (what actually happened) and actions (safe things to try).
// Actions never relax allergies, required features or other restrictions.
export function explainEmpty(diagnostics, p) {
  const reasons = [];
  const actions = [];
  const d = diagnostics;
  if (!d) return { reasons: ['No products matched the answers you gave.'], actions };

  if (d.available === 0) {
    reasons.push(d.mode === 'live'
      ? 'The live catalog does not have any products for this search yet. We never substitute sample products for live results.'
      : `The sample catalog has no products in ${categoryLabel(p.category)}.`);
  }
  const decisive = d.available > 0 ? d.filters.find((f) => f.remaining === 0) : null;
  const reached = decisive ? decisive.excluded : 0;
  if (decisive) {
    const n = reached;
    const out = {
      needs: `None of the ${d.available} products in this category document the needs you chose, so none are relevant.`,
      custom_restrictions: 'You added a restriction in your own words. We cannot verify free text automatically, so nothing can be confirmed safe.',
      avoid_materials: `${n} product${n === 1 ? '' : 's'} could not be confirmed free of the materials you must avoid. We treat undocumented as unknown, not safe.`,
      avoid_features: `${n} product${n === 1 ? '' : 's'} could not be confirmed free of the fastenings you want to avoid.`,
      required_features: `${n} product${n === 1 ? '' : 's'} had no documented evidence for the accessibility features you marked as required.`,
      size: 'Size filtering needs verified stock and size data, which this catalog does not provide yet.',
      max_price: `${n} product${n === 1 ? '' : 's'} cost more than your budget (or have no price in ${p.currency}).`,
    }[decisive.filter];
    if (out) reasons.push(out);
    if (decisive.filter === 'max_price') actions.push({ id: 'drop-budget', label: 'Remove budget limit', patch: { max_price: null } });
    if (decisive.filter === 'size') actions.push({ id: 'drop-size', label: 'Remove size', patch: { size: '' } });
  }
  if (p.category !== 'all' && d.alternatives?.length) {
    const alt = d.alternatives.map((a) => `${categoryLabel(a.category)} (${a.count})`).join(', ');
    reasons.push(`Compatible sample garments do exist in other categories: ${alt}.`);
    actions.push({ id: 'all-categories', label: 'Explore all compatible clothing', patch: { category: 'all' } });
  }
  if (!reasons.length) reasons.push('No products matched the combination of answers you gave.');
  return { reasons, actions };
}
