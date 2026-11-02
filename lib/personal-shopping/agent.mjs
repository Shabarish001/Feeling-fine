import { validatePreferences } from './schema.mjs';
import { planProductSearch } from './plan.mjs';
import { DemoAdapter } from './sources/demo.mjs';
const permittedEvidence = new Set(['retailer_spec','manufacturer_spec']);
export function evaluateProductEvidence(product, p, demo = false) {
  let unknown = Boolean(p.custom_restrictions.trim());
  for (const material of p.avoid_materials) {
    if (product.materials?.includes(material)) return 'excluded';
    const claim = product.evidence?.find(e => e.attribute === material && e.value === 'absent' && (permittedEvidence.has(e.evidence_type) || (demo && e.evidence_type === 'sample_data')));
    if (!claim) unknown = true;
  }
  return unknown ? 'needs_verification' : 'matched';
}
const featureCandidates = {limited_dexterity:['easy_fastening','easy_dressing'], sensory_softness:['sensory_softness','flat_seams','tag_free'], seated_fit:['seated_fit'], easy_dressing:['easy_dressing','easy_fastening']};
function desiredFeatures(p) { return [...new Set([...p.needs,...p.required_features].flatMap(n=>featureCandidates[n] || [n]))]; }
export function scoreProduct(product,p) {
  const wanted = desiredFeatures(p);
  return wanted.filter(n=>product.features.includes(n)).length * 3 + p.prefer_materials.filter(m=>product.materials?.includes(m)).length + p.style.filter(s=>product.style.includes(s)).length + (p.colors.includes(product.color) ? 1 : 0);
}
export function deduplicate(products) {
  const seen = new Set();
  return products.filter(p => { const key = p.offers?.[0]?.product_url || `${p.offers?.[0]?.source}:${p.offers?.[0]?.source_item_id}` || p.id; if(seen.has(key)) return false; seen.add(key); return true; });
}
export function mapProduct(product,p,status) {
  const requested = desiredFeatures(p);
  const matched = requested.filter(n=>product.features.includes(n));
  const unknowns = [];
  if (!product.materials) unknowns.push('Material composition not declared');
  if (!product.confirmed_absent.includes('nickel_hardware')) unknowns.push('Hardware composition not declared');
  if (p.size && !product.sizes) unknowns.push('Size availability not declared');
  if (p.custom_restrictions.trim()) unknowns.push('Custom restriction requires manual review');
  for (const material of p.avoid_materials) if (!product.evidence.some(e=>e.attribute===material && e.value==='absent' && ['sample_data','retailer_spec','manufacturer_spec'].includes(e.evidence_type))) unknowns.push(`${material.replaceAll('_',' ')} exclusion not documented`);
  return {...product,matched_features:matched.map(name=>({name,evidence:product.evidence.find(e=>e.attribute===name) || null})),match_reasons:matched.map(n=>`Sample specification includes ${n.replaceAll('_',' ')}.`),unknowns:[...new Set(unknowns)],safety_status:status};
}
export async function recommend(input) {
  const p = validatePreferences(input);
  const plan = planProductSearch(p);
  if (p.mode !== 'demo') return {mode:p.mode,source_status:'unavailable',summary:'Live product sources are not configured.',search_plan:plan,results:[],needs_verification:[],warnings:['Choose demo mode to view illustrative samples.'],generated_at:new Date().toISOString()};
  const products = deduplicate(await new DemoAdapter().search(plan)).filter(product => {
    const offer = product.offers[0];
    return p.max_price === null || (offer.currency === p.currency && offer.price != null && offer.price <= p.max_price);
  }).sort((a,b)=>scoreProduct(b,p)-scoreProduct(a,p));
  const results=[], needs_verification=[];
  for(const product of products) {
    const status=evaluateProductEvidence(product,p,true);
    if(status==='excluded') continue;
    (status==='matched'?results:needs_verification).push(mapProduct(product,p,status));
  }
  return {mode:'demo',source_status:'sample_data',summary:`Sample ${p.category} selected for your edit.`,search_plan:plan,results:results.slice(0,20),needs_verification:needs_verification.slice(0,20),warnings:['Demo catalog: sample listings, prices and claims are illustrative and not purchasable.','Incomplete declarations cannot establish safety.'],generated_at:new Date().toISOString()};
}
