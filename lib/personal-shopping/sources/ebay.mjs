import { ProductSourceAdapter } from './adapter.mjs';
import { makeObservation, extractFeatures, safeHttps, parseMoney } from './normalize-source.mjs';

// eBay Browse API: keyword search returns summaries; getDetails loads a listing.
// No credentials or live listings are written to the filesystem or database.
export class EbayBrowseAdapter extends ProductSourceAdapter {
  constructor({clientId,clientSecret,accessToken,environment='sandbox',productionApproved=false,marketplace='EBAY_DE',fetchImpl=fetch,clock=()=>new Date(),fixture=false}={}) {
    super();
    if(!['sandbox','production'].includes(environment) || !/^EBAY_[A-Z]{2}$/.test(marketplace))throw new Error('Invalid eBay environment or marketplace.');
    if(environment==='production' && productionApproved!==true)throw new Error('Explicit eBay production approval is required.');
    this.clientId=clientId;this.clientSecret=clientSecret;this.accessToken=accessToken;this.environment=environment;this.marketplace=marketplace;this.fetch=fetchImpl;this.clock=clock;this.fixture=fixture;
    this.base=environment==='production'?'https://api.ebay.com':'https://api.sandbox.ebay.com';
    this.tokenExpires=accessToken?Infinity:0;
  }
  async token() {
    if(this.accessToken && Date.now()<this.tokenExpires)return this.accessToken;
    if(!this.clientId || !this.clientSecret)throw new Error('eBay application credentials are not configured.');
    const res=await this.fetch(`${this.base}/identity/v1/oauth2/token`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded','Authorization':`Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`},body:new URLSearchParams({grant_type:'client_credentials',scope:'https://api.ebay.com/oauth/api_scope'}).toString(),signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error(`eBay token request failed (${res.status}).`);
    const data=await res.json();if(typeof data.access_token!=='string'||!data.access_token)throw new Error('Invalid eBay token response.');
    this.accessToken=data.access_token;this.tokenExpires=Date.now()+Math.max(0,(Number(data.expires_in)||0)-60)*1000;return this.accessToken;
  }
  async request(path) {
    const res=await this.fetch(`${this.base}${path}`,{headers:{Authorization:`Bearer ${await this.token()}`,'X-EBAY-C-MARKETPLACE-ID':this.marketplace,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!res.ok)throw new Error(`eBay Browse request failed (${res.status}); verify access and approval.`);
    return res.json();
  }
  map(item) {
    const aspects=Array.isArray(item.localizedAspects)?item.localizedAspects:[];
    const get=(names)=>{const match=aspects.find(a=>names.includes(String(a.name||'').toLowerCase()));return match?.value || null;};
    const details=aspects.map(a=>({name:a.name,value:a.value}));
    const imageUrls=[item.image?.imageUrl,...(item.additionalImages||[]).map(x=>x.imageUrl)].filter(Boolean);
    const shipping=Array.isArray(item.shippingOptions)&&item.shippingOptions.length===1?item.shippingOptions[0]:null;
    const ship=parseMoney(shipping?.shippingCost), price=parseMoney(item.price);
    const shipCost=shipping?.shippingCostType==='FIXED' && ship.amount!==null && ship.currency===price.currency?ship.amount:null;
    const delivery=shipping?.minEstimatedDeliveryDate && shipping?.maxEstimatedDeliveryDate?`${shipping.minEstimatedDeliveryDate} / ${shipping.maxEstimatedDeliveryDate}`:null;
    const availability=item.estimatedAvailabilities?.length===1?item.estimatedAvailabilities[0]?.estimatedAvailabilityStatus:null;
    const url=safeHttps(item.itemWebUrl);if(!url)return null;
    const host=new URL(url).hostname.toLowerCase();
    if(!this.fixture && !/(^|\.)ebay\.(?:com|de|co\.uk|fr|it|es|at|com\.au)$/.test(host))return null;
    const observation=makeObservation({provider:'ebay',id:typeof item.itemId==='string'?item.itemId:'',title:item.title,url,brand:item.brand || get(['brand','marke']),retailer:host,categoryText: item.categoryPath || item.categories?.map(c=>c.categoryName).join(' ') || '',description:item.shortDescription || item.description,imageUrls,price:item.price,shippingCost:shipCost,delivery,availability:availability==='IN_STOCK'?'in_stock':availability==='OUT_OF_STOCK'?'out_of_stock':'unknown',sizes:[get(['size','größe','groesse'])].filter(Boolean),colors:[get(['color','colour','farbe'])].filter(Boolean),material:get(['material','fabric type','materialzusammensetzung']),features:extractFeatures(details),checkedAt:this.clock().toISOString(),fixture:this.fixture});
    if(observation) { observation.source.environment=this.environment; if(this.environment==='sandbox' && !this.fixture){observation.source.rights_status='sandbox_only';observation.product.restrictions='eBay sandbox data is not a live listing.';} }
    return observation;
  }
  async search(plan={}) {
    const q=typeof plan.query==='string'?plan.query.trim():Array.isArray(plan.queries)?String(plan.queries[0]||'').trim():'';
    const limit=Number(plan.limit??5); if(!q||q.length>200||!Number.isInteger(limit)||limit<1||limit>10)throw new Error('Invalid eBay search query or limit.');
    const params=new URLSearchParams({q,limit:String(limit)});const data=await this.request(`/buy/browse/v1/item_summary/search?${params}`);
    return (data.itemSummaries||[]).map(x=>this.map(x)).filter(Boolean);
  }
  async getDetails(id) {
    if(typeof id!=='string'||!/^v1\|[0-9]+\|[0-9]+$/.test(id))throw new Error('Invalid eBay item ID.');
    return this.map(await this.request(`/buy/browse/v1/item/${encodeURIComponent(id)}`));
  }
}
export function ebayFromEnv(env=process.env) {
  const environment=env.EBAY_ENVIRONMENT || 'sandbox';
  if(environment==='production' && env.EBAY_PRODUCTION_APPROVED!=='true')throw new Error('Explicit eBay production approval is required.');
  return new EbayBrowseAdapter({clientId:env.EBAY_CLIENT_ID,clientSecret:env.EBAY_CLIENT_SECRET,accessToken:env.EBAY_ACCESS_TOKEN,environment,productionApproved:env.EBAY_PRODUCTION_APPROVED==='true',marketplace:env.EBAY_MARKETPLACE || 'EBAY_DE'});
}
