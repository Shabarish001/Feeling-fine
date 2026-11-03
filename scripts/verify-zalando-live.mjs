// Read-only verification using the same public client and graph as the app.
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {graphRecommend} from '../lib/personal-shopping/graph.mjs';
import {defaults} from '../lib/personal-shopping/schema.mjs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.equal(new URL(url).hostname,'aceopapwpgpwyypopofi.supabase.co');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const run=(extra={})=>graphRecommend({...defaults,mode:'live',...extra},{db});
const all=await run(), easy=await run({needs:['limited_dexterity']}), seated=await run({needs:['seated_fit']}), pants=await run({needs:['seated_fit'],category:'trousers'}), excluded=await run({avoid_materials:['wool']});
assert.ok(all.results.length>0);assert.ok(easy.results.length>0);assert.ok(seated.results.length>0);assert.ok(pants.results.length>0);assert.equal(excluded.results.length,0);
for(const p of all.results){assert.equal(p.offers[0].retailer,'Zalando');assert.equal(p.offers[0].price,null);assert.equal(p.offers[0].stock_status,'unknown');assert.equal(p.image_url,null);assert.ok(new URL(p.offers[0].product_url).hostname.endsWith('.zalando.de'));assert.ok(p.match_reasons.length===0);}
for(const p of [...easy.results,...seated.results])assert.ok(p.match_reasons.length>0);
console.log(JSON.stringify({remoteProducts:all.diagnostics.available,returnedProducts:all.results.length,easyFastening:easy.results.length,seatedFit:seated.results.length,seatedTrousers:pants.results.length,unverifiedMaterialExclusion:excluded.results.length,returnedLinksValid:true,pricesUnknown:true,availabilityUnknown:true,imagesNone:true}));
