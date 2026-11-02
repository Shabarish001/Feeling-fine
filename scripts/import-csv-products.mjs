import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = new URL('../', import.meta.url);
const https = (s) => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const time = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const permitted = (a,field) => a?.field_approvals?.[field]?.status==='approved' && a.field_approvals[field].scope==='public_catalog' && https(a.field_approvals[field].reference_url);
const fresh = (v,now=Date.now()) => time(v) && Date.parse(v)<=now && now-Date.parse(v)<=7*86400000;
const priceReady = (p,a,now=Date.now()) => permitted(a,'price') && a?.price_verified===true && fresh(a?.price_checked_at,now) && https(a?.reference_url) && p.price!==null && p.price!==undefined && /^[A-Z]{3}$/.test(p.currency||'') && Number.isFinite(Number(p.price)) && Number(p.price)>=0 && String(a.price)===String(p.price) && a.currency===p.currency;
const imageReady = (p,a) => permitted(a,'image') && a?.image_matches_product===true && https(p.image_url) && a.image_url===p.image_url;
const featuresReady = (p,a) => permitted(a,'features') && a?.accessibility_verified===true && https(a.feature_evidence_url) && Array.isArray(p.features) && p.features.length>0;
const materialReady = (p,a) => permitted(a,'material') && a?.material_verified===true && https(a.material_evidence_url) && !!p.material;
const id = (s) => { const h = createHash('sha256').update(`feeling-find/csv/v1/${s}`).digest('hex').slice(0, 32).split(''); h[12] = '5'; h[16] = ((parseInt(h[16], 16) & 3) | 8).toString(16); const t=h.join(''); return `${t.slice(0,8)}-${t.slice(8,12)}-${t.slice(12,16)}-${t.slice(16,20)}-${t.slice(20)}`; };

// A review entry is a human attestation, not automatic verification by the program.
// No CSV value can grant itself rights or imply a source was checked.
export function eligibility(p, a, now = Date.now()) {
  const reasons = [];
  if (!p.name || !p.retailer || !https(p.product_url)) reasons.push('missing product identity or direct URL');
  if (!a || a.product_url!==p.product_url || a.url_verified!==true || !https(a.product_evidence_url)) reasons.push('direct product URL or identity not independently verified');
  if (!permitted(a,'metadata')) reasons.push('metadata use in public catalog not established');
  if (!fresh(a?.checked_at,now)) reasons.push('product review missing or older than seven days');
  return reasons;
}

export function buildPlan(p, a, now = Date.now()) {
  const productId = id(`product/${p.canonical_url || p.product_url}`), retailerId = id(`retailer/${p.retailer}`), offerId = id(`offer/${p.product_url}`);
  const hasPrice=priceReady(p,a,now), hasImage=imageReady(p,a), hasFeatures=featuresReady(p,a), hasMaterial=materialReady(p,a);
  const evidence = (hasFeatures?p.features:[]).map((f) => ({id:id(`evidence/${p.product_url}/${f}`),product_id:productId,attribute:f,value:true,evidence_type:'unverified_seller_claim',evidence_text_or_source:f,source_url:a.feature_evidence_url,checked_at:a.checked_at}));
  const attributes = evidence.map((e) => ({id:id(`attribute/${p.product_url}/${e.attribute}`),product_id:productId,attribute:e.attribute,value:true,evidence_id:e.id}));
  evidence.push({id:id(`identity-evidence/${p.product_url}`),product_id:productId,attribute:'product_identity',value:'source_checked',evidence_type:'unverified_seller_claim',evidence_text_or_source:`Product identity reviewed; metadata use basis: ${a.field_approvals.metadata.reference_url}`,source_url:a.product_evidence_url,checked_at:a.checked_at});
  const materialEvidence = hasMaterial ? {id:id(`material-evidence/${p.product_url}/${p.material}`),product_id:productId,attribute:'material',value:p.material,evidence_type:'unverified_seller_claim',evidence_text_or_source:p.material,source_url:a.material_evidence_url,checked_at:a.checked_at} : null;
  if (materialEvidence) evidence.push(materialEvidence);
  const website = new URL(p.product_url).origin;
  return {
    retailers:[{id:retailerId,name:p.retailer,website_url:website}],
    products:[{id:productId,title:p.name,brand:p.brand || null,category:p.category || 'unknown',images:[]}],
    product_variants:p.sku && a.variant_verified === true && a.sku === p.sku ? [{id:id(`variant/${p.product_url}/${p.sku}`),product_id:productId,sku:p.sku}] : [],
    product_offers:[{id:offerId,product_id:productId,source:'csv_approved_v1',source_item_id:p.product_url,retailer:p.retailer,retailer_id:retailerId,product_url:p.product_url,...(hasPrice?{price:Number(p.price),currency:p.currency,price_observed_at:a.price_checked_at}:{}),last_checked_at:a.checked_at,stock_status:'unknown'}],
    product_offer_prices:hasPrice?[{id:id(`price/${p.product_url}/${a.price_checked_at}`),offer_id:offerId,amount:Number(p.price),currency:p.currency,observed_at:a.price_checked_at,source_url:a.reference_url}]:[],
    product_images:hasImage?[{id:id(`image/${p.product_url}/${p.image_url}`),product_id:productId,image_url:p.image_url,source_url:a.product_evidence_url,license_note:`Approved source: ${a.field_approvals.image.reference_url}`,observed_at:a.checked_at}]:[],
    product_evidence:evidence,
    product_materials:materialEvidence?[{id:id(`material/${p.product_url}/${p.material}`),product_id:productId,material:p.material,evidence_id:materialEvidence.id}]:[],
    product_attributes:attributes,
  };
}

export async function main(args = process.argv.slice(2)) {
  const mode = args[0] || '--dry-run';
  if (args.length > 1 || !['--dry-run','--validate','--approved-import'].includes(mode)) throw Error('Usage: node --env-file=.env scripts/import-csv-products.mjs [--dry-run|--validate|--approved-import]');
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const generated = spawnSync(python, ['scripts/preview-imports.py'], { cwd: root, encoding:'utf8' });
  if (generated.error || generated.status !== 0) throw Error('CSV preview generation failed');
  const data = JSON.parse(await readFile(new URL('../artifacts/spreadsheet-import-preview.json',import.meta.url),'utf8'));
  let reviews = {};
  try { reviews = JSON.parse(await readFile(new URL('../data/imports/product-approvals.json',import.meta.url),'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw Error('Cannot parse product approvals'); }
  if (!reviews || typeof reviews !== 'object' || Array.isArray(reviews)) throw Error('Approvals must be an object keyed by canonical URL');
  const results = data.products.map((p) => { const review=reviews[p.product_url]; const reasons=eligibility(p,review); return { product_url:p.product_url, name:p.name, reasons, field_status:{metadata:permitted(review,'metadata'),price:priceReady(p,review),image:imageReady(p,review),features:featuresReady(p,review),material:materialReady(p,review)}, shopping_display_complete:!reasons.length&&priceReady(p,review)&&imageReady(p,review)&&featuresReady(p,review), plan:reasons.length?null:buildPlan(p,review) }; });
  const approved=results.filter((r)=>r.plan);
  console.log(JSON.stringify({ mode, source_counts:data.counts, eligible:approved.length, needs_review:results.length-approved.length, products:results },null,2));
  if (mode !== '--approved-import' || !approved.length) return;
  const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!https(url) || new URL(url).hostname !== 'aceopapwpgpwyypopofi.supabase.co' || new URL(url).pathname !== '/' || !key) throw Error('Expected project URL and server-side service key required');
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  for (const r of approved) {
    const {error}=await db.rpc('feeling_find_import_csv_product',{p:r.plan});
    if (error) throw Error(`Atomic import failed for ${r.name}: ${error.code || 'database error'}. Check transaction outcome before retry.`);
    for (const [table, rows] of Object.entries(r.plan)) {
      if (!rows.length) continue;
      const check=await db.from(table).select('*').in('id',rows.map((x)=>x.id));
      const matches=(actual,expected)=>Object.entries(expected).every(([k,v])=>k.endsWith('_at') ? Date.parse(actual[k])===Date.parse(v) : (typeof v==='number' ? Number(actual[k])===v : JSON.stringify(actual[k])===JSON.stringify(v)));
      if(check.error || check.data.length!==rows.length || rows.some((row)=>!check.data.some((x)=>matches(x,row)))) throw Error(`Read-back mismatch for ${r.name} in ${table}; inspect remote state before retry.`);
    }
    console.log(`Verified import: ${r.name}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e)=>{console.error(e.message);process.exitCode=1;});
