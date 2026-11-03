import { ProductSourceAdapter } from './adapter.mjs';
import { makeObservation, extractFeatures, parseMoney } from './normalize-source.mjs';

// Awin's documented enhanced feed is JSONL, not the separate legacy CSV feed.
// Results are held until the full response is read so a terminal error is not missed.
export class AwinFeedAdapter extends ProductSourceAdapter {
  constructor({publisherId,advertiserId,token,locale='de_DE',shipToCountry='DE',fetchImpl=fetch,clock=()=>new Date(),maxBytes=8*1024*1024,fixture=false}={}) {
    super();
    if(!/^\d+$/.test(String(publisherId||''))||!/^\d+$/.test(String(advertiserId||''))||!/^[a-z]{2}_[A-Z]{2}$/.test(locale)||!/^[A-Z]{2}$/.test(shipToCountry)||!Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>64*1024*1024)throw new Error('Invalid Awin feed configuration.');
    this.publisherId=String(publisherId);this.advertiserId=String(advertiserId);this.token=token;this.locale=locale;this.shipToCountry=shipToCountry;this.fetch=fetchImpl;this.clock=clock;this.maxBytes=maxBytes;this.fixture=fixture;this.inFlight=false;this.lastRequestAt=0;this.rows=null;this.feedCheckedAt=null;
  }
  async loadFeed() {
    if(!this.token)throw new Error('Awin enhanced-feed token is not configured.');
    if(this.inFlight)throw new Error('Awin feed request already in progress.');
    this.inFlight=true;this.rows=null;this.feedCheckedAt=null;
    try {
      const wait=Math.max(0,12000-(Date.now()-this.lastRequestAt));if(wait)await new Promise(r=>setTimeout(r,wait));this.lastRequestAt=Date.now();
      const url=`https://api.awin.com/publishers/${this.publisherId}/awinfeeds/download/${this.advertiserId}-retail-${this.locale}.jsonl`;
      const response=await this.fetch(url,{headers:{Authorization:`Bearer ${this.token}`,Accept:'*/*'},redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`Awin feed request failed (${response.status}); check publisher access and advertiser approval.`);
      if(!response.body)throw new Error('Awin feed response has no body.');
      const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let size=0,content='';
      try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>this.maxBytes){await reader.cancel();throw new Error('Awin feed exceeds the configured byte limit; no partial feed was used.');}content+=decoder.decode(value,{stream:true});}content+=decoder.decode();}finally{reader.releaseLock();}
      const rows=[];
      for(const line of content.split(/\r?\n/)){
        if(!line.trim())continue;let item;try{item=JSON.parse(line);}catch{throw new Error('Awin feed contains invalid or incomplete JSONL; no partial feed was used.');}
        if(!item || typeof item!=='object'||Array.isArray(item) || Object.hasOwn(item,'error'))throw new Error('Awin feed reported an error or invalid row; no partial feed was used.');
        rows.push(item);
      }
      this.rows=rows;this.feedCheckedAt=this.clock().toISOString();return rows;
    } finally {this.inFlight=false;}
  }
  map(row) {
    // The documentation gives both flat Google-format rows and product_basic sections.
    const item=row.product_basic && typeof row.product_basic==='object'?{...row,...row.product_basic}:row;
    // A sale price may have an effective interval; leave the current amount
    // unknown until its validity can be established rather than reporting list price.
    const url=item.link;const effectivePrice=item.sale_price ? null : item.price;const amount=parseMoney(effectivePrice);
    const eligibleShipping=Array.isArray(item.shipping)?item.shipping.filter(x=>x.country===this.shipToCountry):[];
    const shipping=eligibleShipping.length===1?parseMoney(eligibleShipping[0].price):{amount:null,currency:null};
    const details=Array.isArray(item.product_detail)?item.product_detail.map(x=>({name:x.attribute_name,value:x.attribute_value})):[];
    return makeObservation({provider:'awin',id:item.id==null?'':`${this.advertiserId}:${String(item.id)}`,title:item.title,url,brand:item.brand,retailer:row.meta?.advertiser_name || item.brand || 'Awin advertiser',categoryText:item.product_type || item.google_product_category || '',description:item.description,imageUrls:[item.image_link,...(Array.isArray(item.additional_image_link)?item.additional_image_link:[])].filter(Boolean),price:effectivePrice,shippingCost:shipping.currency===amount.currency?shipping.amount:null,delivery:null,availability:item.availability==='in_stock'?'in_stock':item.availability==='out_of_stock'?'out_of_stock':'unknown',sizes:typeof item.size==='string'?[item.size]:[],colors:typeof item.color==='string'?[item.color]:[],material:typeof item.material==='string'?item.material:null,features:extractFeatures(details),checkedAt:this.feedCheckedAt || this.clock().toISOString(),fixture:this.fixture});
  }
  async search(plan={}) {
    const query=typeof plan.query==='string'?plan.query.trim():Array.isArray(plan.queries)?String(plan.queries[0]||'').trim():'';
    const limit=Number(plan.limit??5);if(!query||query.length>200||!Number.isInteger(limit)||limit<1||limit>10)throw new Error('Invalid Awin query or limit.');
    const rows=this.rows || await this.loadFeed();const words=query.toLowerCase().split(/\s+/).filter(w=>w.length>2);
    return rows.map(row=>this.map(row)).filter(Boolean).filter(x=>words.every(w=>`${x.product.name} ${x.product.description || ''} ${x.product.category}`.toLowerCase().includes(w))).slice(0,limit);
  }
  async getDetails(id) {
    if(typeof id!=='string'||!id.trim())throw new Error('Invalid Awin product ID.');
    const rows=this.rows || await this.loadFeed();const prefix=`${this.advertiserId}:`;const rawId=id.startsWith(prefix)?id.slice(prefix.length):id;const row=rows.find(r=>String(r.product_basic?.id ?? r.id ?? '')===rawId);return row?this.map(row):null;
  }
}
export function awinFromEnv(env=process.env) {
  return new AwinFeedAdapter({publisherId:env.AWIN_PUBLISHER_ID,advertiserId:env.AWIN_ADVERTISER_ID,token:env.AWIN_API_TOKEN,locale:env.AWIN_FEED_LOCALE || 'de_DE',shipToCountry:env.AWIN_SHIP_TO_COUNTRY || 'DE'});
}
