import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AwinFeedAdapter } from '../lib/personal-shopping/sources/awin.mjs';
import { EbayBrowseAdapter, ebayFromEnv } from '../lib/personal-shopping/sources/ebay.mjs';
import { makeObservation, safeHttps, parseMoney } from '../lib/personal-shopping/sources/normalize-source.mjs';
const clock=()=>new Date('2026-11-02T00:00:00Z');
const awinData=await readFile(new URL('./fixtures/product-sources/awin.jsonl',import.meta.url),'utf8');
const ebayData=JSON.parse(await readFile(new URL('./fixtures/product-sources/ebay.json',import.meta.url),'utf8'));
const queries=['adaptive magnetic shirt','sensory soft cotton','easy dressing trousers'];
test('Awin fixture search maps matching product, source provenance, price and feature',async()=>{
 const adapter=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',fixture:true,clock,fetchImpl:async()=>new Response(awinData)});
 const rows=await adapter.search({query:queries[0]});assert.equal(rows.length,1);const x=rows[0];assert.equal(x.source.fixture,true);assert.equal(x.product.price,49);assert.equal(x.product.currency,'EUR');assert.equal(x.product.shipping_cost,4);assert.equal(x.product.materials[0].percentage,100);assert.equal(x.product.accessibility_features[0].evidence_type,'unverified_seller_claim');assert.equal(x.product.verification_status,'seller_reported_unverified');
 assert.equal((await adapter.getDetails('fixture-a2')).product.materials.length,0);
});
test('Awin refuses partial feeds, unsafe configuration, and terminal errors',async()=>{
 assert.throws(()=>new AwinFeedAdapter({publisherId:'1/evil',advertiserId:'2'}));
 for(const text of ['{"id":"a"}\n{"error":500,"message":"incomplete"}','{"id":"a"}\n{"id":']){
  const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',fetchImpl:async()=>new Response(text)});await assert.rejects(a.search({query:'shirt'}),/partial feed/);
 }
 const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',maxBytes:1024,fetchImpl:async()=>new Response('x'.repeat(1025))});await assert.rejects(a.search({query:'shirt'}),/byte limit/);
});
test('eBay fixture search and item detail use documented endpoints',async()=>{
 const calls=[];const adapter=new EbayBrowseAdapter({accessToken:'fixture',fixture:true,clock,fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('item_summary')?ebayData:ebayData.itemSummaries[0]);}});
 const rows=await adapter.search({query:queries[0],limit:3});assert.equal(rows.length,3);assert.ok(calls[0].url.startsWith('https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?'));assert.equal(rows[0].source.fixture,true);assert.equal(rows[0].product.price,49);assert.equal(rows[0].product.shipping_cost,4);assert.equal(rows[0].product.materials[0].material,'cotton');assert.equal(rows[0].product.accessibility_features[0].evidence_type,'unverified_seller_claim');assert.equal((await adapter.getDetails('v1|100001|0')).product.name,'Fixture Adaptive Magnetic Shirt');
 await assert.rejects(adapter.getDetails('../evil'),/Invalid/);
});
test('eBay production requires approval and rejects untrusted listing hosts',()=>{assert.throws(()=>ebayFromEnv({EBAY_ENVIRONMENT:'production'}),/approval/);const a=new EbayBrowseAdapter({});assert.equal(a.map({...ebayData.itemSummaries[0],itemWebUrl:'https://evil.example/item/1'}),null);});
test('URLs, prices, missing composition and negated features are handled conservatively',()=>{
 assert.equal(safeHttps('https://user:pass@example.com/a'),null);assert.equal(safeHttps('http://example.com/a'),null);assert.deepEqual(parseMoney({value:null,currency:'EUR'}),{amount:null,currency:null});
 const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',fixture:true,clock});const x=a.map({id:'x',title:'Fixture Shirt',link:'https://fixture.example/products/x',product_type:'Shirts',material:'Cotton',product_detail:[{attribute_name:'Features',attribute_value:'Not tagless'}]});assert.deepEqual(x.product.materials,[]);assert.equal(x.product.source_evidence[0].evidence_text,'Cotton');assert.deepEqual(x.product.accessibility_features,[]);assert.equal(x.product.price,null);
 assert.equal(makeObservation({provider:'x',id:'1',title:'bad',url:'javascript:alert(1)',checkedAt:clock().toISOString()}),null);
});
test('all three fixture categories are returned independently from a single Awin feed read',async()=>{
 let calls=0;const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',fixture:true,clock,fetchImpl:async()=>{calls++;return new Response(awinData);}});
 for(const query of queries){const rows=await a.search({query});assert.equal(rows.length,1);assert.equal(rows[0].source.fixture,true);}
 assert.equal(calls,1);assert.equal((await a.getDetails('fixture-a1')).source.source_item_id,'2:fixture-a1');assert.equal((await a.getDetails('2:fixture-a1')).source.source_item_id,'2:fixture-a1');
});
test('eBay client credentials OAuth and sandbox labeling are explicit',async()=>{
 const calls=[];const a=new EbayBrowseAdapter({clientId:'fixture-client',clientSecret:'fixture-secret',clock,fetchImpl:async(url,opts)=>{calls.push({url,opts});if(url.includes('/identity/'))return Response.json({access_token:'fixture-token',expires_in:7200});return Response.json({itemSummaries:[{...ebayData.itemSummaries[0],itemWebUrl:'https://www.ebay.de/itm/123'}]});}});
 const rows=await a.search({query:'shirt'});assert.equal(calls.length,2);assert.match(calls[0].url,/identity\/v1\/oauth2\/token/);assert.equal(calls[1].opts.headers['X-EBAY-C-MARKETPLACE-ID'],'EBAY_DE');assert.equal(rows[0].source.environment,'sandbox');assert.equal(rows[0].source.rights_status,'sandbox_only');assert.match(rows[0].product.restrictions,/not a live listing/);
 assert.throws(()=>new EbayBrowseAdapter({environment:'production'}),/approval/);
});
test('Awin source identities are scoped to advertiser and cached observations retain their fetch time',async()=>{
 let time=new Date('2026-11-02T00:00:00Z');const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',token:'fixture',fixture:true,clock:()=>time,fetchImpl:async()=>new Response(awinData)});const first=await a.search({query:queries[0]});time=new Date('2026-11-03T00:00:00Z');const second=await a.search({query:queries[0]});assert.equal(second[0].product.last_checked_at,first[0].product.last_checked_at);assert.equal(first[0].source.source_item_id,'2:fixture-a1');
});

test('Awin sale prices and mismatched shipping destinations are not treated as verified',()=>{const a=new AwinFeedAdapter({publisherId:'1',advertiserId:'2',fixture:true,clock,shipToCountry:'DE'});const base={id:'x',title:'Fixture Shirt',link:'https://fixture.example/products/x',product_type:'Shirts',price:'49.00 EUR'};assert.equal(a.map({...base,sale_price:'30.00 EUR'}).product.price,null);assert.equal(a.map({...base,shipping:[{country:'US',price:'4.00 EUR'}]}).product.shipping_cost,null);});
