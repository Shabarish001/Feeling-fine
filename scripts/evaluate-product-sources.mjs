import { readFile } from 'node:fs/promises';
import nextEnv from '@next/env';
import { AwinFeedAdapter, awinFromEnv } from '../lib/personal-shopping/sources/awin.mjs';
import { EbayBrowseAdapter, ebayFromEnv } from '../lib/personal-shopping/sources/ebay.mjs';
nextEnv.loadEnvConfig(process.cwd(), true, {info(){},error(){}});
const live=process.argv.includes('--live');
const queries=['adaptive magnetic shirt','sensory soft cotton','easy dressing trousers'];
const results=[];
function countFields(items) { return {products:items.length,titles:items.filter(x=>x.product.name).length,links:items.filter(x=>x.product.product_url).length,brands:items.filter(x=>x.product.brand).length,descriptions:items.filter(x=>x.product.description).length,prices:items.filter(x=>x.product.price!==null).length,images:items.filter(x=>x.product.image_urls.length).length,material_composition:items.filter(x=>x.product.materials.length).length,material_claim:items.filter(x=>x.product.source_evidence.some(e=>e.attribute==='material')).length,sizes:items.filter(x=>x.product.sizes.length).length,colors:items.filter(x=>x.product.colors.length).length,shipping:items.filter(x=>x.product.shipping_cost!==null).length,delivery:items.filter(x=>x.product.delivery_estimate!==null).length,availability:items.filter(x=>x.product.availability!=='unknown').length,features:items.filter(x=>x.product.accessibility_features.length).length}; }
async function run(provider,adapter,mode) {
 const observed=new Map(), errors=[];
 for(const query of queries) try {for(const x of await adapter.search({query,limit:3}))observed.set(x.source.source_item_id,x);}catch(e){errors.push({query,error:e.message});break;}
 const items=[...observed.values()];results.push({provider,mode,counts:countFields(items),errors});
}
if(!live) {
 const awin=await readFile(new URL('../tests/fixtures/product-sources/awin.jsonl',import.meta.url),'utf8');
 const ebay=JSON.parse(await readFile(new URL('../tests/fixtures/product-sources/ebay.json',import.meta.url),'utf8'));
 await run('awin',new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',fixture:true,fetchImpl:async()=>new Response(awin)}),'synthetic_fixture');
 await run('ebay',new EbayBrowseAdapter({accessToken:'fixture',fixture:true,fetchImpl:async url=>{const q=new URL(url).searchParams.get('q')||'';const terms=q.toLowerCase().split(/\s+/);return Response.json({itemSummaries:ebay.itemSummaries.filter(x=>terms.every(w=>x.title.toLowerCase().includes(w)))});}}),'synthetic_fixture');
} else {
 if(process.env.AWIN_API_TOKEN && process.env.AWIN_PUBLISHER_ID && process.env.AWIN_ADVERTISER_ID) await run('awin',awinFromEnv(),'live');
 else results.push({provider:'awin',mode:'unavailable',counts:countFields([]),errors:[{error:'Missing enhanced-feed credentials or approved advertiser.'}]});
 if(process.env.EBAY_ACCESS_TOKEN || (process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET)) {
   try {const adapter=ebayFromEnv();await run('ebay',adapter,adapter.environment==='production'?'live':'sandbox_not_live');}
   catch(e){results.push({provider:'ebay',mode:'unavailable',counts:countFields([]),errors:[{error:e.message}]});}
 } else results.push({provider:'ebay',mode:'unavailable',counts:countFields([]),errors:[{error:'Missing eBay credentials and production approval.'}]});
}
console.log(JSON.stringify({queries,results,note:'Fixture products are fictional. No Supabase reads or writes are performed.'},null,2));
