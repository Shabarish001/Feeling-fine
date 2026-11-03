// Safe by default. No function deployment and no remote calls in --dry-run.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildAwinCatalogPlan, validateAwinReview } from '../lib/personal-shopping/sources/awin-csv-plan.mjs';

async function main(){
  const mode=process.argv[2]||'--dry-run';
  if(process.argv.length>3||!['--dry-run','--apply'].includes(mode)) throw Error('Usage: node --env-file=.env scripts/import-awin-shortlist.mjs [--dry-run|--apply]');
  const preview=JSON.parse(await readFile(new URL('../artifacts/awin-diverse-review.json',import.meta.url),'utf8'));
  const feed=await readFile(new URL('../data/imports/datafeed_3143018.csv',import.meta.url));
  if(createHash('sha256').update(feed).digest('hex')!==preview.sha256)throw Error('Feed changed since the shortlist was generated; regenerate and review it.');
  let reviews={};try{reviews=JSON.parse(await readFile(new URL('../data/imports/awin-approvals.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw Error('Cannot read approvals file.');}
  if(!reviews||typeof reviews!=='object'||Array.isArray(reviews))throw Error('Approvals must be keyed by exact product URL.');
  const checked=preview.candidates.map(p=>({p,r:reviews[p.merchant_url],errors:validateAwinReview(p,reviews[p.merchant_url])}));
  const ready=checked.filter(x=>x.errors.length===0);
  console.log(JSON.stringify({mode,selected:checked.length,ready:ready.length,blocked:checked.length-ready.length,blocked_reasons:checked.filter(x=>x.errors.length).map(x=>({name:x.p.name,reasons:x.errors}))},null,2));
  if(mode==='--dry-run'||!ready.length)return;
  const u=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,token=process.env.AWIN_API_TOKEN;
  if(!u||new URL(u).hostname!=='aceopapwpgpwyypopofi.supabase.co'||new URL(u).protocol!=='https:'||new URL(u).pathname!=='/'||new URL(u).username||new URL(u).password||new URL(u).search||new URL(u).hash||!key||!token)throw Error('Expected Supabase project, server key and Awin API token are required.');
  const publishers=new Set(ready.map(x=>new URL(x.p.awin_affiliate_url).searchParams.get('a')));
  if(publishers.size!==1)throw Error('Selected rows do not share a single publisher account.');
  const publisher=[...publishers][0];
  const api=await fetch(`https://api.awin.com/publishers/${publisher}/programmedetails?advertiserId=131023&relationship=any`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(!api.ok)throw Error(`Awin membership verification failed: HTTP ${api.status}.`);
  const info=(await api.json()).programmeInfo;
  if(String(info?.membershipStatus||'').toLowerCase()!=='joined'||info.id!==131023)throw Error('Awin does not confirm joined membership for advertiser 131023; import stopped.');
  const db=createClient(u,key,{auth:{persistSession:false,autoRefreshToken:false}});
  let completed=0;
  for(const item of ready){
    const plan=buildAwinCatalogPlan(item.p,item.r);
    const {error}=await db.rpc('feeling_find_import_csv_product',{p:plan});
    if(error)throw Error(`Atomic import failed (${error.code||'database error'}); ${completed} prior products may already be committed. Inspect before retry.`);
    for(const [table,rows] of Object.entries(plan)){
      if(!rows.length)continue;
      const result=await db.from(table).select('*').in('id',rows.map(x=>x.id));
      const equal=(actual,expected)=>Object.entries(expected).every(([k,v])=>k.endsWith('_at')?Date.parse(actual[k])===Date.parse(v):typeof v==='number'?Number(actual[k])===v:JSON.stringify(actual[k])===JSON.stringify(v));
      if(result.error||result.data.length!==rows.length||rows.some(row=>!result.data.some(x=>equal(x,row))))throw Error(`Read-back failed in ${table}; inspect the current product and ${completed} prior products before retry.`);
    }
    completed++;
  }
  console.log(`Independently verified imported products: ${completed}`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
