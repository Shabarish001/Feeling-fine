import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import nextEnv from '@next/env';
import { QUERIES, validDomain, productUrl, deduplicateCandidates, normalizeExtracted, robotsAllows, validateNormalizedProduct } from '../lib/product-discovery/normalize.mjs';
nextEnv.loadEnvConfig(process.cwd(), true, {info(){},error(){}});
const key=process.env.TAVILY_API_KEY;
const maxCredits=Number(process.env.TAVILY_MAX_CREDITS || 14);
const maxResults=Number(process.env.TAVILY_MAX_RESULTS || 5);
const maxRequests=Number(process.env.TAVILY_MAX_REQUESTS || 13);
const minInterval=Number(process.env.TAVILY_MIN_INTERVAL_MS || 300);
const maxExtract=Number(process.env.TAVILY_MAX_EXTRACT_PAGES || 5);
const domains=(process.env.TAVILY_DOMAINS || 'zalando.de,primark.com,adaptawear.com').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
if(!key) throw new Error('TAVILY_API_KEY is not configured.');
if(!Number.isInteger(maxCredits)||maxCredits<1||maxCredits>50||!Number.isInteger(maxResults)||maxResults<1||maxResults>10||!Number.isInteger(maxExtract)||maxExtract<0||maxExtract>5||!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>30||!Number.isInteger(minInterval)||minInterval<0||minInterval>10000||domains.length<1||domains.length>10||domains.some(d=>!validDomain(d))) throw new Error('Invalid budget, limits, or domain configuration.');
const policies=JSON.parse((await readFile(new URL('../lib/product-discovery/source-policies.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const output=resolve(process.cwd(), 'artifacts/tavily-discovery.json');
let extractedPages=0;
const report={generated_at:new Date().toISOString(),mode:'local_research_only',limits:{max_credits:maxCredits,max_results:maxResults,max_extract_pages:maxExtract,max_requests:maxRequests,min_interval_ms:minInterval},credit_usage:{reported:0,reported_unknown:false,reserved_upper_bound:0},requests:[],candidates:[],products:[],errors:[],source_restrictions:{},summary:{}};
let remaining=maxCredits; let lastRequestAt=0;
async function api(endpoint,body,reserve) {
 if(remaining<reserve) throw new Error('credit_budget_exhausted');
 if(report.requests.length>=maxRequests) throw new Error('request_limit_exhausted');
 const wait=Math.max(0,minInterval-(Date.now()-lastRequestAt)); if(wait)await new Promise(r=>setTimeout(r,wait)); lastRequestAt=Date.now();
 remaining-=reserve;report.credit_usage.reserved_upper_bound+=reserve;
 const started=Date.now();let response;
 try {response=await fetch('https://api.tavily.com/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({...body,include_usage:true}),signal:AbortSignal.timeout(40000)});}catch {report.requests.push({endpoint,status:'network_error',reserved_credits:reserve});throw new Error('network_error');}
 if(!response.ok){report.requests.push({endpoint,status:response.status,reserved_credits:reserve});throw new Error(`http_${response.status}`);}
 let data;try{data=await response.json();}catch{report.requests.push({endpoint,status:'invalid_response',reserved_credits:reserve});throw new Error('invalid_response');}
 const credits=data.usage?.credits;
 if(typeof credits==='number'&&Number.isFinite(credits)&&credits>=0){report.credit_usage.reported+=credits;}else report.credit_usage.reported_unknown=true;
 report.requests.push({endpoint,status:response.status,reported_credits:typeof credits==='number'?credits:null,reserved_credits:reserve,elapsed_ms:Date.now()-started});
 return data;
}
async function checkRobots(url) {
 const u=new URL(url);let r;
 try {r=await fetch(`${u.origin}/robots.txt`,{headers:{'User-Agent':'FeelingFindResearch/1.0'},redirect:'error',signal:AbortSignal.timeout(10000)});}catch{return {allowed:false,reason:'robots_unavailable_or_redirect'};}
 if(!r.ok)return {allowed:false,reason:`robots_http_${r.status}`};
 const txt=(await r.text()).slice(0,200000);
 if(!robotsAllows(txt,u.pathname+u.search))return {allowed:false,reason:'robots_disallow'};
 return {allowed:true,reason:'no_matching_disallow_conservative'};
}
try {
 for(const domain of domains){
  const policy=policies[domain];report.source_restrictions[domain]=policy || {extract_for_research:false,reason:'No source access review; extraction disabled.'};
  const queries=domain==='adaptawear.com'?[QUERIES[1],QUERIES[3]]:QUERIES;
  for(const query of queries){
   if(remaining<1 || report.requests.length>=maxRequests){report.errors.push({domain,query,error:remaining<1?'credit_budget_exhausted':'request_limit_exhausted'});break;}
   try{const data=await api('search',{query,search_depth:'basic',auto_parameters:false,max_results:maxResults,include_domains:[domain],include_raw_content:false,include_images:false},1);Object.assign(report.requests[report.requests.length-1],{domain,query,results_returned:Array.isArray(data.results)?data.results.length:0});for(const hit of data.results || []){const url=productUrl(hit.url,[domain]);if(url)report.candidates.push({url,title:typeof hit.title==='string'?hit.title.slice(0,200):null,domain,queries:[query],status:'unverified_search_candidate'});}}
   catch(e){report.errors.push({domain,query,error:e.message});if(e.message==='http_401'||e.message==='http_403')break;}
  }
 }
 report.candidates=deduplicateCandidates(report.candidates);
 const candidates=[];
 for(const c of report.candidates){const p=policies[c.domain];if(!p?.extract_for_research || !p?.terms_url || !p?.reviewed_at)continue;const robots=await checkRobots(c.url);if(robots.allowed)candidates.push(c);else report.errors.push({url:c.url,error:robots.reason});if(candidates.length>=maxExtract)break;}
 if(candidates.length && maxExtract && remaining>=1 && report.requests.length<maxRequests){
  try{const data=await api('extract',{urls:candidates.map(c=>c.url),extract_depth:'basic',include_images:false,format:'markdown'},1);
   const expected=new Map(candidates.map(c=>[c.url,c]));
   extractedPages=Array.isArray(data.results)?data.results.length:0;
   for(const item of data.results||[]){const url=productUrl(item.url,domains);if(!url||!expected.has(url)){report.errors.push({error:'extract_url_mismatch'});continue;}const r=normalizeExtracted({url,content:item.raw_content,checkedAt:new Date().toISOString(),retailer:expected.get(url).domain});if(r.product && validateNormalizedProduct(r.product))report.products.push(r.product);else report.errors.push({url,error:r.error || 'normalized_validation_failed'});}
   for(const e of data.failed_results||[])report.errors.push({url:productUrl(e.url,domains),error:'extraction_failed'});
  }catch(e){report.errors.push({error:e.message,stage:'extract'});}
 }
 report.summary={search_requests:report.requests.filter(x=>x.endpoint==='search').length,extract_requests:report.requests.filter(x=>x.endpoint==='extract').length,discovered_product_candidates:report.candidates.length,extracted_pages_successfully:extractedPages,valid_products:report.products.length,products_with_verified_images:0,products_with_price:report.products.filter(p=>p.price!==null).length,products_with_composition:report.products.filter(p=>p.materials.length).length,products_with_features:report.products.filter(p=>p.accessibility_features.length).length};
} finally {await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',mode:0o600});}
console.log(JSON.stringify({artifact:output,summary:report.summary,credit_usage:report.credit_usage,errors:report.errors.map(e=>({domain:e.domain,error:e.error,stage:e.stage}))},null,2));
