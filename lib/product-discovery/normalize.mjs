import { createHash } from 'node:crypto';
export const QUERIES = [
  'adaptive clothing disability easy dressing',
  'adaptive shirt magnetic buttons magnetic closure',
  'sensory friendly soft cotton tagless clothing',
  'elastic waist trousers easy dressing adaptive',
  'sensitive skin clothing fabric composition cotton',
];
export function validDomain(value) {
  return typeof value === 'string' && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);
}
export function productUrl(input, allowedDomains) {
  try {
    const u=new URL(input); const host=u.hostname.toLowerCase();
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !allowedDomains.some(d=>host===d || host.endsWith('.'+d))) return null;
    if (!(/\/products?\//i.test(u.pathname) || /\/p\//i.test(u.pathname) || /\/shop\/[^/]+\/[^/]+\/?$/i.test(u.pathname) || (host.endsWith('zalando.de') && /-[a-z0-9]{6,}-[a-z0-9]{3,}\.html$/i.test(u.pathname)))) return null;
    u.hash=''; for(const k of [...u.searchParams.keys()]) if (/^(utm_.+|gclid|fbclid|ref|referrer)$/i.test(k)) u.searchParams.delete(k);
    return u.toString();
  } catch { return null; }
}
export function deduplicateCandidates(items) {
  const found=new Map();
  for(const item of items) { const key=item.url.replace(/\/$/,''); if(!found.has(key)) found.set(key,item); else found.get(key).queries=[...new Set([...found.get(key).queries,...item.queries])]; }
  return [...found.values()];
}
export function normalizeExtracted({url,content,checkedAt,retailer}) {
  if(typeof content!=='string'||content.length<100) return {error:'empty_or_short_extraction'};
  const rawLines=content.split(/\r?\n/);
  const headingIndex=rawLines.findIndex(x=>/^#\s+\S/.test(x.trim()));
  const heading=headingIndex<0?null:rawLines[headingIndex].trim();
  const productSection=headingIndex<0?[]:rawLines.slice(headingIndex);
  const relatedIndex=productSection.findIndex(x=>/^#{1,3}\s*(?:you may also like|related products|recommendations|similar products|you might also like)/i.test(x.trim()));
  const lines=(relatedIndex>=0?productSection.slice(0,relatedIndex):productSection).map(s=>s.replace(/^\s*[-*#]+\s*/, '').trim()).filter(Boolean);
  const title=heading?.replace(/^#\s+/, '').trim();
  if(!title || title.length>180 || /^(home|shop|search|access denied|page not found)$/i.test(title)) return {error:'product_title_not_verified'};
  const clothing=/\b(shirt|shirts|trouser|trousers|pants|t-shirt|t shirt|blouse|tee|top|clothing|hemd|hose|tshirt|kleidung)\b/i;
  if (!clothing.test(title)) return {error:'not_a_clothing_product_title'};
  const relevant = lines.filter(l => l.length<=240 && !/\b(no|not|without|kein|nicht)\b.{0,24}\b(magnet|tagless|tag.free|elastic)/i.test(l));
  const matched = [];
  for(const [feature,pattern] of [['magnetic_closure',/\bmagnetic (?:buttons?|clos(?:ure|ures)|fasten(?:ing|ings))\b/i],['elastic_waist',/\belastic(?:ated)?[- ]waist(?:band)?\b/i],['tag_free',/\b(?:tag[- ]free|tagless|label[- ]free)\b/i],['flat_seams',/\bflat[- ]seams?\b/i]]) {
    const line=relevant.find(l=>pattern.test(l)); if(line) matched.push({attribute:feature,value:true,evidence_type:'unverified_seller_claim',evidence_text:line.slice(0,200),source_url:url,checked_at:checkedAt});
  }
  const material=lines.find(l=>/\b(material|composition|fabric|materialzusammensetzung)\b/i.test(l) && /\b\d{1,3}(?:\.\d+)?\s*%\s*(cotton|polyester|wool|linen|viscose|elastane|baumwolle)\b/i.test(l));
  const composition=material? [...material.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*%\s*(cotton|polyester|wool|linen|viscose|elastane|baumwolle)\b/gi)].map(x=>({material:x[2].toLowerCase(),percentage:Number(x[1])})).filter(x=>x.percentage<=100):[];
  // Restrict values to explicitly labelled single-line fields. Ambiguous prices,
  // sale ranges, site navigation, and related products stay unknown.
  const field=(...names)=>lines.map(l=>l.match(new RegExp(`^(?:${names.join('|')})\\s*[:|]\\s*(.+)$`,'i'))).find(Boolean)?.[1]?.trim() || null;
  const labelPrice=field('price','preis');
  const priceMatch=labelPrice?.match(/^(EUR|GBP|USD|\u20ac|\u00a3|\$)\s*(\d{1,6}(?:[.,]\d{1,2})?)$/i);
  const currencies={'\u20ac':'EUR','\u00a3':'GBP','$':'USD'};
  const currency=priceMatch?(currencies[priceMatch[1]] || priceMatch[1].toUpperCase()):null;
  const price=priceMatch?Number(priceMatch[2].replace(',','.')):null;
  const sizeText=field('sizes','size options','sizes available');
  const sizes=sizeText ? [...new Set((sizeText.match(/\b(?:XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)\b/g)||[]))] : [];
  const colorText=field('colou?r','colou?rs');
  const colors=colorText && /^[a-zA-Z ,/-]{1,80}$/.test(colorText) && !/select|choose/i.test(colorText)?colorText.split(/[,/]/).map(x=>x.trim()).filter(Boolean):[];
  const sellerBrand=field('brand','marke');
  const brand=sellerBrand && sellerBrand.length<=80 ? sellerBrand : null;
  const descriptionField=field('description','beschreibung');
  const description=descriptionField && descriptionField.length<=240 ? descriptionField : null;
  const rawAvailability=field('availability','stock status');
  const availability=rawAvailability && /^in stock$/i.test(rawAvailability)?'in_stock':rawAvailability && /^out of stock$/i.test(rawAvailability)?'out_of_stock':'unknown';
  const deliveryText=field('delivery estimate','estimated delivery');
  const delivery_estimate=deliveryText && deliveryText.length<=100?deliveryText:null;
  const source_evidence=[];
  const evidenceFor=(attribute,text)=>source_evidence.push({attribute,evidence_type:'unverified_seller_claim',evidence_text:text.slice(0,200),source_url:url,checked_at:checkedAt});
  if(material)evidenceFor('composition',material);
  if(priceMatch)evidenceFor('price',labelPrice);
  if(sizes.length)evidenceFor('sizes',sizeText);
  if(colors.length)evidenceFor('colors',colorText);
  if(availability!=='unknown')evidenceFor('availability',rawAvailability);
  if(delivery_estimate)evidenceFor('delivery_estimate',deliveryText);
  const product={id:createHash('sha256').update(url).digest('hex').slice(0,32),product_url:url,name:title,brand,category:/\b(trouser|trousers|pants|hose)\b/i.test(title)?'trousers':/\b(shirt|hemd|blouse)\b/i.test(title)?'shirts':'tops',description,image_urls:[],price,currency,retailer,sizes,colors,materials:composition,accessibility_features:matched,shipping_cost:null,delivery_estimate,availability,source_evidence,verification_status:'seller_reported_unverified',last_checked_at:checkedAt,completeness:{title:true,price:price!==null,image:false,composition:composition.length>0,accessibility_features:matched.length>0},restrictions:'Local feasibility evaluation only; reuse rights not established.'};
  return {product};
}

/** Conservative robots gate: any matching wildcard/Tavily disallow blocks.
 * Allow overrides are intentionally not used, so this can reject permitted URLs. */
export function robotsAllows(text, path) {
  if (typeof text !== 'string' || typeof path !== 'string') return false;
  const groups=[]; let agents=[],rules=[],seenRule=false;
  function flush(){ if(agents.length)groups.push({agents,rules}); agents=[];rules=[];seenRule=false; }
  for(const raw of text.split(/\r?\n/)){
    const line=raw.split('#')[0].trim(),m=line.match(/^([^:]+):\s*(.*)$/); if(!m)continue;
    const key=m[1].trim().toLowerCase(),val=m[2].trim();
    if(key==='user-agent'){if(seenRule)flush();agents.push(val.toLowerCase());}
    else if(key==='disallow'){seenRule=true;if(val)rules.push(val);}
    else if(key==='allow')seenRule=true;
  }
  flush();
  if(!groups.length)return false;
  for(const group of groups.filter(g=>g.agents.some(a=>a==='*'||a.includes('tavily'))))for(const rule of group.rules){
    const end=rule.endsWith('$'); const pattern=end?rule.slice(0,-1):rule;
    const re=new RegExp('^'+pattern.split('*').map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':''));
    if(re.test(path))return false;
  }
  return true;
}
export function validateNormalizedProduct(p) {
  if (!p || typeof p !== 'object' || !/^[a-f0-9]{32}$/.test(p.id || '') || typeof p.name !== 'string' || !p.name.trim() || !['tops','shirts','trousers'].includes(p.category) || !validDomain(p.retailer) || !productUrl(p.product_url,[p.retailer])) return false;
  if (p.verification_status !== 'seller_reported_unverified' || !Number.isFinite(Date.parse(p.last_checked_at)) || !Array.isArray(p.image_urls) || p.image_urls.length !== 0) return false;
  if ((p.price === null) !== (p.currency === null) || (p.price !== null && (!Number.isFinite(p.price) || p.price < 0 || !['EUR','GBP','USD'].includes(p.currency)))) return false;
  if (!Array.isArray(p.materials) || p.materials.some(m=>typeof m.material!=='string'||!Number.isFinite(m.percentage)||m.percentage<0||m.percentage>100)) return false;
  if (!Array.isArray(p.sizes)||!Array.isArray(p.colors)||!Array.isArray(p.source_evidence)||!Array.isArray(p.accessibility_features)) return false;
  return [...p.source_evidence,...p.accessibility_features].every(e=>e.evidence_type==='unverified_seller_claim' && e.source_url===p.product_url && typeof e.evidence_text==='string' && e.evidence_text.length<=200);
}
