// Insert-only, resumable import of the user's undated research CSV. No images, prices or asserted stock.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const mode=process.argv[2]||'--dry-run';if(!['--dry-run','--apply'].includes(mode)||process.argv.length>3)throw Error('Use --dry-run or --apply');
const csv='data/imports/feeling_find_zalando_adaptive_catalog_22.csv';
const py="import csv,json,sys; f=open(sys.argv[1],encoding='utf-8-sig',newline=''); print(json.dumps(list(csv.DictReader(f)),ensure_ascii=True))";
const rows=JSON.parse(execFileSync('python',['-c',py,csv],{encoding:'utf8'}));
const fields=new Set(['adjustable_waist','pull_up_loop','wheelchair_friendly','magnetic_closure','low_front_high_back','wide_neck_opening','easy_grab_zip','cuff_openings','hook_loop_closure','hem_openings','side_closures','easy_remove_tag','one_handed_zip']);
const uid=s=>{const x=createHash('sha256').update('feeling-find-csv-research-v1:'+s).digest('hex');return `${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-8${x.slice(17,20)}-${x.slice(20,32)}`};
if(rows.length!==22)throw Error(`Expected 22 CSV records, got ${rows.length}`);
const seenSku=new Set(),seenUrl=new Set();
const plans=rows.map(r=>{
  const u=new URL(r.product_url);const sku=r.retailer_sku;
  if(!/^[A-Z0-9]{9}-[A-Z0-9]{3}$/.test(sku)||!['en.zalando.de','www.zalando.de'].includes(u.hostname)||u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!u.pathname.toLowerCase().endsWith(`-${sku.toLowerCase()}.html`)||r.source_url!==r.product_url||r.retailer!=='Zalando'||!r.title||!r.brand||!['shirts','trousers'].includes(r.category)||r.publication_status!=='research_demo_needs_review'||!['page_found','page_found_out_of_stock'].includes(r.verification_status)||r.images!=='[]')throw Error(`Invalid CSV row ${sku}`);
  if(seenSku.has(sku)||seenUrl.has(r.product_url))throw Error(`Duplicate in CSV: ${sku}`);seenSku.add(sku);seenUrl.add(r.product_url);
  const attrs=r.adaptive_features.split(';');if(!attrs.length||attrs.some(x=>!fields.has(x))||new Set(attrs).size!==attrs.length)throw Error(`Invalid features: ${sku}`);
  const productId=r.id;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId))throw Error(`Invalid product ID: ${sku}`);
  return {sku,products:[{id:productId,title:r.title,brand:r.brand,category:r.category,description:r.description}],product_offers:[{id:uid('offer:'+sku),product_id:productId,source:'zalando_research',source_item_id:sku,retailer:'Zalando',product_url:r.product_url,stock_status:'unknown',availability_note:r.verification_status==='page_found_out_of_stock'?'Research CSV previously reported out of stock; current availability unknown.':'Current availability unknown.'}],product_evidence:attrs.map(attribute=>({id:uid(`evidence:${sku}:${attribute}`),product_id:productId,attribute,value:true,evidence_type:'unverified_seller_claim',evidence_text_or_source:'Research CSV claim; original verification date not provided.',source_url:r.source_url,checked_at:null})),product_attributes:attrs.map(attribute=>({id:uid(`attribute:${sku}:${attribute}`),product_id:productId,attribute,value:true,evidence_id:uid(`evidence:${sku}:${attribute}`)}))};
});
console.log(JSON.stringify({mode,csvRecords:plans.length,categories:rows.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{}),undatedResearch:plans.length,urlsUnique:seenUrl.size},null,2));
if(mode==='--dry-run')process.exit(0);
const base=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;if(!base||new URL(base).hostname!=='aceopapwpgpwyypopofi.supabase.co'||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Expected project and server-side credential required');
const db=createClient(base,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:offers,error:offerError}=await db.from('product_offers').select('id,product_id,source,source_item_id,retailer,product_url').limit(1000);if(offerError)throw Error(offerError.message);
const skipped=[],pending=[];
for(const p of plans){const o=p.product_offers[0],matches=offers.filter(x=>x.product_url===o.product_url||(x.retailer==='Zalando'&&x.source_item_id===p.sku));
  if(matches.length>1)throw Error(`Duplicate existing offers: ${p.sku}`);
  if(matches.length&&matches[0].source!=='zalando_research'){if(matches[0].product_url!==o.product_url||matches[0].source_item_id!==p.sku)throw Error(`Conflicting existing offer: ${p.sku}`);skipped.push(p.sku);continue;}
  if(matches.length&&(matches[0].id!==o.id||matches[0].product_id!==o.product_id))throw Error(`Conflicting research offer: ${p.sku}`);
  pending.push(p);
}
console.log(JSON.stringify({preexisting:skipped.length,toProcess:pending.length}));
const journal=new URL('../artifacts/zalando-csv-research-journal.json',import.meta.url);let complete=[];try{complete=JSON.parse(await readFile(journal,'utf8')).completed||[]}catch(e){if(e.code!=='ENOENT')throw e}
const same=(a,b)=>Object.entries(b).every(([k,v])=>JSON.stringify(a[k])===JSON.stringify(v));
for(const p of pending){for(const table of ['products','product_offers','product_evidence','product_attributes']){
  const expected=p[table], ids=expected.map(x=>x.id);const before=await db.from(table).select('*').in('id',ids);if(before.error)throw Error(`Read ${p.sku} ${table}: ${before.error.message}`);
  for(const row of expected){const prior=before.data.find(x=>x.id===row.id);if(prior&&!same(prior,row))throw Error(`Conflict ${p.sku} ${table}; no overwrite`);}
  const missing=expected.filter(row=>!before.data.some(x=>x.id===row.id));if(missing.length){const result=await db.from(table).insert(missing);if(result.error)throw Error(`Insert ${p.sku} ${table}: ${result.error.message}. Earlier rows may exist; rerun after review.`);}
  const after=await db.from(table).select('*').in('id',ids);if(after.error||after.data.length!==expected.length||expected.some(row=>!after.data.some(a=>a.id===row.id&&same(a,row))))throw Error(`Read-back ${p.sku} ${table} failed; prior rows may exist.`);
 }
 if(!complete.includes(p.sku))complete.push(p.sku);await writeFile(journal,JSON.stringify({completed:complete,preexisting:skipped},null,2));console.log(`Read back ${p.sku}`);
}
console.log(JSON.stringify({readBack:pending.length,preexisting:skipped.length,totalCsvRepresented:pending.length+skipped.length}));
