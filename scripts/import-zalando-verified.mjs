// Server-only, insert-only and resumable. Never prints credentials or imports photos/prices.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const root=new URL('../',import.meta.url), artifact=new URL('../artifacts/zalando-verification.json',import.meta.url);
const mode=process.argv[2]||'--dry-run'; if(!['--dry-run','--apply'].includes(mode)||process.argv.length>3)throw Error('Use --dry-run or --apply');
const uid=s=>{const x=createHash('sha256').update('feeling-find-zalando-v1:'+s).digest('hex');return `${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-8${x.slice(17,20)}-${x.slice(20,32)}`};
const brands={'TO':'Tommy Hilfiger','PI':'Pier One by Zalando','AN':'Anna Field by Zalando','EV':'Even&Odd by Zalando','YO':'YOURTURN by Zalando'};
const verified=JSON.parse(await readFile(artifact,'utf8')).results.filter(x=>x.verified);
const plans=verified.map(x=>{
  const u=new URL(x.url);if(!['en.zalando.de','www.zalando.de'].includes(u.hostname)||!u.pathname.endsWith('.html')||!x.code||!x.title||!x.features||!Number.isFinite(Date.parse(x.checkedAt)))throw Error('Bad verification record');
  const brand=brands[x.code.slice(0,2)];if(!brand)throw Error(`Unknown brand: ${x.code}`);
  const title=x.title.replace(/ - Zalando$/,'').replace(new RegExp('^'+brand.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s+','i'),'').trim();
  const category=/trousers|bottom|jeans|pants/i.test(title)?'trousers':/t-shirt|top/i.test(title)?'tops':'shirts';
  const f=x.features.toLowerCase();const attrs=[];
  if(f.includes('magnetic closure'))attrs.push(['magnetic_closure','Magnetic fastening may make closures easier to handle.']);
  if(f.includes('hook & loop closure'))attrs.push(['hook_loop_fastening','Hook-and-loop fastening may make dressing easier.']);
  if(f.includes('low front, high back'))attrs.push(['high_back_waist','The lower front and higher back are designed for seated wear.']);
  if(f.includes('wide neck opening'))attrs.push(['wide_opening','A wider neckline may make dressing easier.']);
  if(!attrs.length)throw Error(`No supported sourced feature: ${x.code}`);
  const productId=uid('product:'+x.code), offerId=uid('offer:'+x.code);
  const description=attrs.map(a=>a[1]).join(' ');
  const evidence=attrs.map(([attribute])=>({id:uid('evidence:'+x.code+':'+attribute),product_id:productId,attribute,value:true,evidence_type:'retailer_spec',evidence_text_or_source:`Zalando lists ${attribute.replaceAll('_',' ')} for this article.`,source_url:x.url,checked_at:x.checkedAt}));
  return {code:x.code,products:[{id:productId,title,brand,category,description}],product_offers:[{id:offerId,product_id:productId,source:'zalando',source_item_id:x.code,retailer:'Zalando',product_url:x.url,stock_status:'unknown',last_checked_at:x.checkedAt}],product_evidence:evidence,product_attributes:attrs.map(([attribute])=>({id:uid('attribute:'+x.code+':'+attribute),product_id:productId,attribute,value:true,evidence_id:uid('evidence:'+x.code+':'+attribute)}))};
});
console.log(JSON.stringify({mode,verified:plans.length,excluded:18-plans.length,categories:plans.reduce((a,p)=>(a[p.products[0].category]=(a[p.products[0].category]||0)+1,a),{}),products:plans.map(p=>({code:p.code,...p.products[0],url:p.product_offers[0].product_url,features:p.product_evidence.map(e=>e.attribute)}))},null,2));
if(mode==='--dry-run')process.exit(0);
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!url||new URL(url).hostname!=='aceopapwpgpwyypopofi.supabase.co'||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Expected project and server-side credential required');
if(!plans.length)throw Error('No verified records');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const order=['products','product_offers','product_evidence','product_attributes'];
for(const p of plans){
  const offer=p.product_offers[0];
  const {data,error}=await db.from('product_offers').select('id,product_id').or(`product_url.eq.${offer.product_url},and(source.eq.zalando,source_item_id.eq.${p.code})`);
  if(error)throw Error(`Duplicate preflight ${p.code}: ${error.message}`);
  if(data.some(x=>x.id!==offer.id||x.product_id!==offer.product_id))throw Error(`An existing product or offer conflicts with ${p.code}; no changes made.`);
}
const journal=new URL('../artifacts/zalando-import-journal.json',import.meta.url);let completed=[];
try{completed=JSON.parse(await readFile(journal,'utf8')).completed||[]}catch(e){if(e.code!=='ENOENT')throw e}
const same=(actual,expected)=>Object.entries(expected).every(([k,v])=>k.endsWith('_at')?Date.parse(actual[k])===Date.parse(v):JSON.stringify(actual[k])===JSON.stringify(v));
for(const p of plans){
  for(const table of order)for(const row of p[table]){
    const {data:existing,error:readError}=await db.from(table).select('*').eq('id',row.id).maybeSingle();if(readError)throw Error(`Read ${table} ${p.code}: ${readError.message}`);
    if(existing){if(!same(existing,row))throw Error(`Conflicting existing ${table} row for ${p.code}; no overwrite`);continue;}
    const {error}=await db.from(table).insert(row);if(error)throw Error(`Insert ${table} ${p.code}: ${error.message}. Prior rows may exist; rerun after review.`);
    const result=await db.from(table).select('*').eq('id',row.id).single();if(result.error||!same(result.data,row))throw Error(`Read-back ${table} ${p.code} failed; rerun after review.`);
  }
  if(!completed.includes(p.code))completed.push(p.code);
  await writeFile(journal,JSON.stringify({completed},null,2));
  console.log(`Verified ${p.code}`);
}
console.log(`Completed and read back: ${completed.length}`);
