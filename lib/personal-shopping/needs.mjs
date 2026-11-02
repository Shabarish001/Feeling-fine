// Onboarding vocabulary and catalog availability. Every count here comes from the same matching engine the API uses,
// so the UI can only advertise what a search would actually return.
import { applyStages } from './matching.mjs';
import { defaults } from './schema.mjs';

// Primary needs. Each maps to documented product features (see REQUESTED in matching.mjs for how they are evidenced).
export const NEED_GROUPS = [
  { id: 'easy_dressing', title: 'Easy dressing and fastenings', blurb: 'Pull-on styles, easy closures and wider openings.', needs: ['easy_dressing', 'easy_fastening', 'limited_dexterity', 'adjustable_openings'] },
  { id: 'sensory', title: 'Sensory-friendly and soft', blurb: 'Soft fabrics, flat seams and no scratchy labels.', needs: ['sensory_softness', 'flat_seams', 'tag_free'] },
  { id: 'seated', title: 'Seated comfort and accessible fit', blurb: 'Cuts made for sitting, such as a higher back rise.', needs: ['seated_fit'] },
];

export const CATEGORY_LABELS = { all: 'Explore all compatible clothing', tops: 'Tops', shirts: 'Shirts', trousers: 'Trousers', dresses: 'Dresses', jackets: 'Jackets', shoes: 'Shoes' };
export const categoryLabel = (c) => CATEGORY_LABELS[c] || c;

export const groupSelected = (needs, group) => group.needs.every((n) => needs.includes(n));
export const toggleGroup = (needs, group) => (groupSelected(needs, group) ? needs.filter((n) => !group.needs.includes(n)) : [...new Set([...needs, ...group.needs])]);

const prefsWith = (p) => ({ ...defaults, ...p });

// How many products (and which categories) document at least one feature of a need group.
export function groupCoverage(catalog, group) {
  const { eligible } = applyStages(catalog, { ...defaults, needs: group.needs }, true);
  const categories = [...new Set(eligible.map((x) => x.category))];
  return { total: eligible.length, categories };
}

// Compatible products per category for the answers so far (needs plus any saved hard restrictions).
export function categoryCounts(catalog, p, categories) {
  const base = prefsWith(p);
  const counts = {};
  for (const category of categories) {
    const pool = category === 'all' ? catalog : catalog.filter((x) => x.category === category);
    counts[category] = applyStages(pool, { ...base, category }, true).eligible.length;
  }
  return counts;
}

// How many products declare a material as absent (the only thing that can verify an "avoid" request).
export function materialCoverage(catalog, material) {
  return catalog.filter((x) => x.evidence?.some((e) => e.attribute === material && e.value === 'absent')).length;
}

// Full-engine preview for the review line in the last step.
export function previewCount(catalog, p) {
  return applyStages(p.category === 'all' ? catalog : catalog.filter((x) => x.category === p.category), prefsWith(p), true).eligible.length;
}
