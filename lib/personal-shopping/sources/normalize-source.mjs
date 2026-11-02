import { createHash } from 'node:crypto';

export function safeHttps(value) {
  if(typeof value!=='string') return null;
  try {
    const u=new URL(value); const host=u.hostname.toLowerCase();
    if(u.protocol!=='https:' || u.username || u.password || u.port || !host.includes('.') || host==='localhost' || /^(?:\d+\.){3}\d+$/.test(host) || /(?:^|\.)(?:localhost|local|internal)$/.test(host))return null;
    return u.toString();
  } catch { return null; }
}
export function parseMoney(input) {
  const value=typeof input==='string' ? input.match(/^\s*(\d+(?:\.\d{1,2})?)\s+([A-Z]{3})\s*$/) : null;
  const amount=value?Number(value[1]):Number(input?.value); const currency=value?value[2]:input?.currency;
  if((!value && (input?.value===undefined || input?.value===null || String(input.value).trim()===''))||!Number.isFinite(amount)||amount<0||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))return {amount:null,currency:null};
  return {amount,currency};
}
export function category(value) {
  const s=typeof value==='string'?value.toLowerCase():'';
  if(/\b(shirts?|blouses?|hemden?)\b/.test(s))return 'shirts';
  if(/\b(trousers?|pants|hosen?)\b/.test(s))return 'trousers';
  if(/\b(tops?|tees?|t-shirts?|tshirts?)\b/.test(s))return 'tops';
  return 'unknown';
}
export function evidence(attribute,text,url,checkedAt) {
  if(typeof text!=='string'||!text.trim())return null;
  return {attribute,evidence_type:'unverified_seller_claim',evidence_text:text.trim().slice(0,200),source_url:url,checked_at:checkedAt};
}
export function makeObservation({provider,id,title,url,brand,retailer,categoryText,description,imageUrls=[],price,shippingCost,delivery,availability,sizes=[],colors=[],material,features=[],checkedAt,fixture=false}) {
  const canonical=safeHttps(url);
  if(!canonical || typeof id!=='string' || !id.trim() || typeof title!=='string' || !title.trim() || !Number.isFinite(Date.parse(checkedAt)))return null;
  const currentPrice=parseMoney(price);
  const safeImages=[...new Set(imageUrls.map(safeHttps).filter(Boolean))];
  const materialText=typeof material==='string'?material.trim():'';
  const parts=[...materialText.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*([a-zA-Z]+)\b/g)].map(m=>({material:m[2].toLowerCase(),percentage:Number(m[1])})).filter(x=>x.percentage<=100);
  const claims=features.map(x=>evidence(x.attribute,x.text,canonical,checkedAt)).filter(Boolean).map(e=>({...e,value:true}));
  const materialEvidence=evidence('material',materialText,canonical,checkedAt);
  const source_evidence=materialEvidence?[materialEvidence]:[];
  const product={id:createHash('sha256').update(`${provider}:${id}`).digest('hex').slice(0,32),product_url:canonical,name:title.trim().slice(0,200),brand:typeof brand==='string'&&brand.trim()?brand.trim():null,category:category(categoryText),description:typeof description==='string'&&description.trim()?description.trim():null,image_urls:safeImages,price:currentPrice.amount,currency:currentPrice.currency,retailer:retailer || provider,sizes:sizes.filter(x=>typeof x==='string'&&x.trim()),colors:colors.filter(x=>typeof x==='string'&&x.trim()),materials:parts,accessibility_features:claims,shipping_cost:Number.isFinite(shippingCost)&&shippingCost>=0?shippingCost:null,delivery_estimate:typeof delivery==='string'?delivery:null,availability:['in_stock','out_of_stock'].includes(availability)?availability:'unknown',source_evidence,verification_status:'seller_reported_unverified',last_checked_at:checkedAt,completeness:{title:true,price:currentPrice.amount!==null,image:safeImages.length>0,composition:parts.length>0,accessibility_features:claims.length>0},restrictions:fixture?'Synthetic fixture; not a real product.':'Source terms, display rights, and freshness must be verified before use.'};
  return {product,source:{provider,source_item_id:id,source_url:canonical,checked_at:checkedAt,fixture,rights_status:fixture?'fixture_only':'review_required'}};
}
export function extractFeatures(details) {
  if(!Array.isArray(details))return [];
  const accepted=/^(features?|closure(?: type)?|fastening|accessibility(?: features)?|sensory features)$/i;
  return details.filter(x=>x && typeof x.name==='string' && accepted.test(x.name) && typeof x.value==='string' && /\b(magnetic|hook.and.loop|elastic(?:ated)? waist|tag.?free|tagless|flat seams?|easy.?dressing)\b/i.test(x.value) && !/\b(?:not|no|without)\b/i.test(x.value)).map(x=>({attribute:x.name.toLowerCase().replace(/\s+/g,'_'),text:x.value}));
}
