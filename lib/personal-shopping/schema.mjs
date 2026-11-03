export const OPTIONS = {
  needs: ['easy_fastening','limited_dexterity','seated_fit','sensory_softness','flat_seams','tag_free','adjustable_openings','easy_dressing','temperature_comfort'],
  materials: ['wool','latex','nickel_hardware','polyester'],
  preferred: ['cotton','linen','viscose','polyester'],
  avoidFeatures: ['magnetic_closure','hook_loop_fastening','zipper'],
  categories: ['all','tops','shirts','trousers','dresses','jackets','shoes'],  // 'all' = explore every compatible category
  styles: ['minimal','streetwear','classic','sporty','elegant','casual'],
  fits: ['regular','relaxed','close'],
  colors: ['black','white','blue','green','pink','beige'],
  delivery: ['standard','fast'],
};
export const defaults = {category:'all',size:'',fit:'',dressing_mode:'unspecified',needs:[],required_features:[],avoid_materials:[],avoid_features:[],prefer_features:[],prefer_materials:[],style:[],colors:[],max_price:null,currency:'EUR',country:'DE',delivery:'',notes:'',custom_restrictions:'',mode:'demo'};
export function validatePreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Preferences must be an object.');
  const allowed = Object.keys(defaults);
  if (Object.keys(input).some(k => !allowed.includes(k))) throw new Error('Unknown preference field.');
  const p = {...defaults,...input};
  const arrays = {needs:OPTIONS.needs,required_features:OPTIONS.needs,avoid_materials:OPTIONS.materials,avoid_features:OPTIONS.avoidFeatures,prefer_features:OPTIONS.avoidFeatures,prefer_materials:OPTIONS.preferred,style:OPTIONS.styles,colors:OPTIONS.colors};
  for (const [key,values] of Object.entries(arrays)) {
    if (!Array.isArray(p[key]) || p[key].length > values.length || p[key].some(v => typeof v !== 'string' || !values.includes(v))) throw new Error(`Invalid ${key}.`);
    p[key] = [...new Set(p[key])];
  }
  if (!OPTIONS.categories.includes(p.category)) throw new Error('Invalid category.');
  if (!['demo','live','cached_live'].includes(p.mode)) throw new Error('Invalid mode.');
  if (!['unspecified','independent','assisted'].includes(p.dressing_mode)) throw new Error('Invalid dressing preference.');
  for (const key of ['size','notes','custom_restrictions']) if (typeof p[key] !== 'string' || p[key].length > (key === 'size' ? 30 : 300)) throw new Error(`Invalid ${key}.`);
  if (typeof p.fit !== 'string' || (p.fit && !OPTIONS.fits.includes(p.fit))) throw new Error('Invalid fit.');
  if (typeof p.delivery !== 'string' || (p.delivery && !OPTIONS.delivery.includes(p.delivery))) throw new Error('Invalid delivery preference.');
  if (typeof p.country !== 'string' || !/^[A-Z]{2}$/.test(p.country) || typeof p.currency !== 'string' || !/^[A-Z]{3}$/.test(p.currency)) throw new Error('Use a two-letter country and three-letter currency code.');
  if (p.max_price !== null && (typeof p.max_price !== 'number' || !Number.isFinite(p.max_price) || p.max_price < 0 || p.max_price > 100000)) throw new Error('Invalid maximum price.');
  return p;
}
export function validateSaveRequest(body) {
  if (!body || body.consent !== true) throw new Error('Explicit consent is required to save preferences.');
  return validatePreferences(body.preferences);
}
