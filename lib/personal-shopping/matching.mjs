// Pure matching rules for personal shopping (no LangGraph, no I/O), shared by the API graph and the onboarding UI.
// Hard rules decide WHETHER a product may be shown. Soft rules only decide ORDER.
//   Hard: relevance to chosen needs, avoided materials, required features, size, budget, free-text restrictions.
//   Soft: preferred materials, style, fit, feedback.
// Unknown is never treated as compatible: a hard rule needs positive evidence.

export const union = (a = [], b = []) => [...new Set([...a, ...b])];
export const normalized = (x) => String(x || '').trim().toLowerCase().replaceAll(' ', '_');
export const https = (s) => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
export const trusted = (e, demo) => e && (demo ? e.evidence_type === 'sample_data' : ['retailer_spec', 'manufacturer_spec'].includes(e.evidence_type) && https(e.source_url) && Number.isFinite(Date.parse(e.checked_at)) && !!e.evidence_text_or_source);
// Retailer feature wording -> the onboarding vocabulary. Deliberately conservative: only close, literal equivalents.
// An alias lets a documented "magnetic_closure" count as "easy_fastening"; it never creates evidence that is not there.
export const FEATURE_ALIASES = {
  easy_fastening: ['magnetic_closure', 'magnetic_zipper', 'magnetic_leg_openings', 'velcro_fastening', 'hook_loop_fastening', 'side_zippers', 'four_zip_system', 'waist_to_knee_side_zips', 'inseam_zip', 'full_length_side_zip'],
  limited_dexterity: ['one_hand_dressing', 'easy_grip'],
  easy_dressing: ['assisted_dressing', 'wide_opening', 'one_hand_dressing', 'pullover'],
  adjustable_openings: ['wide_opening', 'magnetic_leg_openings'],
  seated_fit: ['high_back_waist'],
  sensory_softness: ['sensory_friendly', 'soft_seams', 'seamless', 'soft', 'soft_fleece'],
  flat_seams: ['soft_seams', 'seamless'],
  tag_free: ['tagless'],
};
const namesFor = (attribute, value) => (value === true ? [normalized(attribute), ...(FEATURE_ALIASES[normalized(attribute)] || [])] : [normalized(attribute)]);
const scoped = (e, offer) => (!e.variant_id || e.variant_id === offer?.variant_id) && (!e.offer_id || e.offer_id === offer?.id);

// VERIFIED evidence: needed for every hard restriction (avoid material, required feature).
export const evidenceFor = (product, attribute, value, demo, offer) => {
  const names = namesFor(attribute, value);
  return !!product.evidence?.some((e) => names.includes(normalized(e.attribute)) && e.value === value && trusted(e, demo) && scoped(e, offer));
};
export const evidenceForMatch = (product, attribute, demo, offer) => {
  const names=namesFor(attribute,true);
  return product.evidence?.find(e=>names.includes(normalized(e.attribute))&&e.value===true&&trusted(e,demo)&&scoped(e,offer)) || null;
};
// SELLER CLAIM: a sourced but unverified assertion. It can be explained only after a documented feature qualifies the item.
export const claimedFor = (product, attribute, offer) => {
  const names = namesFor(attribute, true);
  return !!product.evidence?.some((e) => e.evidence_type === 'unverified_seller_claim' && e.value === true && https(e.source_url) && Number.isFinite(Date.parse(e.checked_at)) && !!e.evidence_text_or_source && names.includes(normalized(e.attribute)) && scoped(e, offer));
};

// A chosen need counts as met when ANY of these documented features is evidenced.
export const REQUESTED = {
  limited_dexterity: ['limited_dexterity', 'easy_fastening'],
  sensory_softness: ['sensory_softness', 'flat_seams', 'tag_free'],
  seated_fit: ['seated_fit'],
  easy_dressing: ['easy_dressing', 'easy_fastening'],
};
const expand = (needs) => [...new Set(needs.flatMap((x) => REQUESTED[x] || [x]))];

// Ordered hard filters. Only filters the user actually set are returned, so diagnostics list real constraints.
export function restrictionStages(p, demo = false) {
  const stages = [];
  const offerOf = (product) => product.offers?.[0];
  if (p.needs?.length) {
    stages.push({ id: 'needs', test: (product) => expand(p.needs).some((f) => evidenceFor(product, f, true, demo, offerOf(product))) });
  }
  if (p.custom_restrictions.trim()) {
    // Free text cannot be verified automatically, so nothing can be confirmed as compatible.
    stages.push({ id: 'custom_restrictions', test: () => false });
  }
  if (p.avoid_materials.length) {
    stages.push({
      id: 'avoid_materials',
      test: (product) => p.avoid_materials.every((material) =>
        !product.materials?.some((m) => normalized(m).includes(normalized(material))) && evidenceFor(product, material, 'absent', demo, offerOf(product))),
    });
  }
  if (p.avoid_features?.length) {
    const related = { magnetic_closure: ['magnetic_closure','magnetic_zipper','magnetic_leg_openings'], hook_loop_fastening: ['hook_loop_fastening','hook_loop_closure','velcro_fastening'], zipper: ['zipper','easy_grip','easy_grab_zip','side_zippers','one_handed_zip','magnetic_zipper'] };
    stages.push({ id: 'avoid_features', test: (product) => p.avoid_features.every((feature) =>
      !product.features?.some((f) => (related[feature] || [feature]).includes(normalized(f))) &&
      !product.evidence?.some((e) => e.value === true && (related[feature] || [feature]).includes(normalized(e.attribute))) &&
      evidenceFor(product, feature, 'absent', demo, offerOf(product))) });
  }
  if (p.required_features.length) {
    stages.push({ id: 'required_features', test: (product) => p.required_features.every((f) => evidenceFor(product, f, true, demo, offerOf(product))) });
  }
  if (p.size) {
    stages.push({
      id: 'size',
      test: (product) => { const offer = offerOf(product); return !!(offer?.stock_status === 'in_stock' && offer?.variant_id && product.variants?.some((v) => v.id === offer.variant_id && normalized(v.size_label) === normalized(p.size))); },
    });
  }
  if (p.max_price !== null) {
    stages.push({
      id: 'max_price',
      test: (product) => { const offer = offerOf(product); return !!(offer && offer.currency === p.currency && typeof offer.price === 'number' && Number.isFinite(offer.price) && offer.price >= 0 && offer.price <= p.max_price); },
    });
  }
  return stages;
}

// Waterfall: apply each filter in order and record how many products it removed. Counts only, no profile values.
export function applyStages(products, p, demo = false) {
  let remaining = products;
  const filters = [];
  for (const stage of restrictionStages(p, demo)) {
    const next = remaining.filter(stage.test);
    filters.push({ filter: stage.id, excluded: remaining.length - next.length, remaining: next.length });
    remaining = next;
  }
  return { eligible: remaining, filters };
}

export function passesRestrictions(product, p, demo = false) {
  return restrictionStages(p, demo).every((s) => s.test(product));
}

export function scoreProduct(product, p, feedback = [], demo = false) {
  const offer = product.offers?.[0];
  const wanted = union(union(p.needs, p.required_features),[...(p.prefer_features || []),...(p.dressing_mode === 'assisted' ? ['assisted_dressing'] : [])]).flatMap((x) => REQUESTED[x] || [x]);
  const matched = [...new Set(wanted)].filter((x) => evidenceFor(product, x, true, demo, offer));
  // Seller-claimed features add relevance but score lower than verified ones.
  const claimed = demo ? [] : [...new Set(wanted)].filter((x) => !matched.includes(x) && claimedFor(product, x, offer));
  const material = p.prefer_materials.filter((m) => product.materials?.some((x) => normalized(x) === normalized(m))).length;
  const style = p.style.filter((s) => product.style?.includes(s)).length + (p.fit && product.fit === p.fit ? 1 : 0) + (product.color && p.colors?.includes(product.color) ? 1 : 0);
  const budget = p.max_price !== null && offer?.currency === p.currency && Number.isFinite(offer?.price) && offer.price <= p.max_price ? 1 : 0;
  const explicit = feedback.filter((f) => f.product_id === product.id).reduce((sum, f) => sum + ({ saved: 2, helpful: 3, not_helpful: -3, dismissed: -4 }[f.feedback_type] || 0), 0);
  const breakdown = { accessibility: matched.length * 3 + claimed.length, material, style_fit: style, budget, feedback: Math.max(-10, Math.min(10, explicit)) };
  const matchedEvidence=matched.map(need=>({need,...evidenceForMatch(product,need,demo,offer)}));
  return { score: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown, matched, claimed, matchedEvidence };
}

// Full diagnosis for one search over a product pool. `pool` is every product the source could return (for "other categories" hints).
export function diagnose(pool, p, demo = false) {
  const inCategory = p.category === 'all' ? pool : pool.filter((x) => x.category === p.category);
  const { eligible, filters } = applyStages(inCategory, p, demo);
  let alternatives = [];
  if (p.category !== 'all') {
    const others = applyStages(pool.filter((x) => x.category !== p.category), p, demo).eligible;
    const counts = {};
    for (const x of others) counts[x.category] = (counts[x.category] || 0) + 1;
    alternatives = Object.entries(counts).map(([category, count]) => ({ category, count }));
  }
  return { eligible, diagnostics: { category: p.category, available: inCategory.length, filters, eligible: eligible.length, alternatives } };
}
