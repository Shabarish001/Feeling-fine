import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { validatePreferences } from './schema.mjs';
import { demoCatalog } from './demo-catalog.mjs';

import { union, https, trusted, passesRestrictions, scoreProduct, diagnose } from './matching.mjs';
export { passesRestrictions, scoreProduct };

const State=Annotation.Root({input:Annotation(),preferences:Annotation(),feedback:Annotation(),products:Annotation(),pool:Annotation(),eligible:Annotation(),diagnostics:Annotation(),ranked:Annotation(),result:Annotation()});

// Maps one Supabase `products` row (with embedded relations) to the product shape the matching engine and UI use.
// Nothing is invented: a missing image, price, link or evidence stays null/absent, and prices keep their own currency.
const when=(o)=>Date.parse(o.price_observed_at||o.last_checked_at||o.observed_at||'')||0;
export function adaptCatalog(row) {
  const evidence=row.product_evidence||[];
  const attributes=(row.product_attributes||[]).filter(a=>evidence.some(e=>e.id===a.evidence_id && e.product_id===row.id));
  const approvedImage=(row.product_images||[]).filter(i=>https(i.image_url)&&i.license_note?.startsWith('Approved source: ')&&https(i.license_note.slice('Approved source: '.length))).sort((a,b)=>(a.position||0)-(b.position||0))[0];
  // Offers with a direct link and a price first, then the most recently observed.
  const offers=(row.product_offers||[]).map(o=>{const {retailers,...rest}=o;return {...rest,retailer:o.retailer||retailers?.name||null,price:o.price===null||o.price===undefined?null:Number(o.price),product_url:https(o.product_url)?o.product_url:null,verified_at:o.price_observed_at||null};})
    .sort((a,b)=>(Number(!!b.product_url)+Number(b.price!==null))-(Number(!!a.product_url)+Number(a.price!==null))||when(b)-when(a));
  return {id:row.id,title:row.title,brand:row.brand,category:row.category,description:row.description,
    image_url:approvedImage?.image_url||null,image_source_url:approvedImage?.source_url||null,
    materials:(row.product_materials||[]).filter(m=>evidence.some(e=>e.id===m.evidence_id && e.product_id===row.id && trusted(e,false))).map(m=>m.material),
    evidence:evidence.filter(e=>!e.variant_id&&!e.offer_id), features:[...new Set(attributes.map(a=>a.attribute))], style:[],fit:null,variants:row.product_variants||[],
    offers};
}

export function createShoppingGraph({db=null,userId=null,fixtures=demoCatalog}={}) {
  return new StateGraph(State)
    .addNode('loadUserPreferences',async s=>{
      let saved=null, feedback=[];
      if(userId && db) {
        const pref=await db.from('shopping_preferences').select('preferences').eq('user_id',userId).maybeSingle();
        const fb=await db.from('product_feedback').select('product_id,feedback_type').eq('user_id',userId).order('created_at',{ascending:false}).limit(200);
        if(pref.error||fb.error) throw new Error('Could not load your saved preferences or feedback.');
        saved=pref.data?.preferences ? validatePreferences(pref.data.preferences) : null; feedback=fb.data||[];
      }
      const incoming=validatePreferences(s.input);
      const merged=saved?validatePreferences({...saved,...incoming,avoid_materials:union(saved.avoid_materials,incoming.avoid_materials),required_features:union(saved.required_features,incoming.required_features),custom_restrictions:[...new Set([saved.custom_restrictions,incoming.custom_restrictions].flatMap(x=>String(x||'').split(';').map(t=>t.trim()).filter(Boolean)))].join('; ').slice(0,300)}):incoming;
      return {preferences:merged,feedback};
    })
    .addNode('interpretClothingNeeds',s=>({preferences:s.preferences}))
    .addNode('retrieveProducts',async s=>{
      const category=s.preferences.category;
      if(s.preferences.mode==='demo') return {products:category==='all'?fixtures:fixtures.filter(p=>p.category===category),pool:fixtures};
      if(!db) return {products:[],pool:[]};
      const singular={tops:'top',shirts:'shirt',trousers:'trousers',dresses:'dress',jackets:'jacket',shoes:'shoe'};
      let query=db.from('products').select('id,title,brand,category,description,product_offers(*,retailers(name,website_url)),product_variants(*),product_images(*),product_materials(*),product_attributes(*),product_evidence(*)');
      if(category!=='all') query=query.in('category',union([category],[singular[category]]));
      const {data,error}=await query.limit(100);
      if(error) throw new Error('Could not read the product catalog.');
      const products=(data||[]).map(adaptCatalog);
      return {products,pool:products};
    })
    .addNode('verifyRestrictions',s=>{
      const demo=s.preferences.mode==='demo';
      // Live rows are already category-filtered by the database (which may use singular names), so diagnose them as one pool.
      // Live mode never falls back to sample data, and "other categories" hints exist only for the sample catalog.
      const {eligible,diagnostics}=demo?diagnose(s.pool,s.preferences,true):diagnose(s.products,{...s.preferences,category:'all'},false);
      return {eligible,diagnostics:{...diagnostics,category:s.preferences.category,mode:demo?'demo':'live'}};
    })
    .addNode('rankProducts',s=>({ranked:s.eligible.map(p=>({product:p,...scoreProduct(p,s.preferences,s.feedback,s.preferences.mode==='demo')})).sort((a,b)=>b.score-a.score||a.product.title.localeCompare(b.product.title))}))
    .addNode('explainRecommendations',s=>{
      const demo=s.preferences.mode==='demo';
      return {result:{mode:demo?'demo':'live',source_status:demo?'sample_data':'catalog',summary:demo?'Illustrative sample matches.':'Recommendations from the product catalog.',results:s.ranked.slice(0,20).map(({product,score,breakdown,matched,claimed=[]})=>({...product,match_score:score,score_breakdown:breakdown,match_reasons:[...matched.map(x=>`${demo?'Sample':'Documented'} feature: ${x.replaceAll('_',' ')}.`),...claimed.map(x=>`Seller-claimed feature (not independently verified): ${x.replaceAll('_',' ')}.`)],unknowns:[...(!product.materials?.length?['Material composition not documented']:[]),...(product.offers?.[0]?.price == null?['Price not documented']:[])],verification_status:demo?'sample_data':product.evidence?.some(e=>trusted(e,false))?'source_evidence':'unverified',safety_status:demo?'sample_data':'not_assessed'})),diagnostics:{...s.diagnostics,returned:Math.min(s.ranked.length,20)},needs_verification:[],warnings:demo?['Demo data: products and prices are illustrative and not for sale.']:[],generated_at:new Date().toISOString()}};
    })
    .addEdge(START,'loadUserPreferences').addEdge('loadUserPreferences','interpretClothingNeeds').addEdge('interpretClothingNeeds','retrieveProducts').addEdge('retrieveProducts','verifyRestrictions').addEdge('verifyRestrictions','rankProducts').addEdge('rankProducts','explainRecommendations').addEdge('explainRecommendations',END).compile();
}
export async function graphRecommend(input,context={}) {
  const graph=createShoppingGraph(context);
  if(!Array.isArray(context.trace)) return (await graph.invoke({input})).result;
  let result;
  for await (const update of await graph.stream({input},{streamMode:'updates'})) {
    for (const [node,value] of Object.entries(update)) { context.trace.push(node); if(node==='explainRecommendations') result=value.result; }
  }
  return result;
}
