// Offline plan only. This module never calls Supabase or treats feed access as approval.
import { createHash } from 'node:crypto';
const id=(kind,key)=>{const h=createHash('sha256').update(`feeling-find/awin/v1/${kind}/${key}`).digest('hex').slice(0,32).split('');h[12]='5';h[16]=((parseInt(h[16],16)&3)|8).toString(16);const s=h.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;};
const https=(s,host)=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&(!host||u.hostname===host)&&(!u.port||u.port==='443');}catch{return false;}};
const recent=(t,now)=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&Date.parse(t)<=now&&now-Date.parse(t)<=7*86400000;

export function validateAwinReview(p,r,now=Date.now()) {
  const errors=[];
  if(!p || p.merchant_id!=='131023'||!p.merchant_product_id||!p.awin_product_id||!p.name||!p.retailer||!['socks','hosiery','shirts','trousers','underwear'].includes(p.proposed_mapping?.products?.category)||!https(p.merchant_url,'socken-online.de')||!https(p.image_url,'socken-online.de')||!https(p.awin_affiliate_url,'www.awin1.com')||!/(nahtlos|flache\s+naht|keine\s+sp.rbare\s+zehennaht|handgekettelt|100\s*%\s*(?:baumwolle|cotton))/i.test(p.claim_evidence_local_only||'')) errors.push('Invalid advertiser, product, image, tracking URL or documented feature.');
  if(p&&https(p.merchant_url,'socken-online.de')){const u=new URL(p.merchant_url);u.search='';u.hash='';if(u.href!==p.canonical_product_url)errors.push('Canonical product identity does not match merchant URL.');}
  if(p&&https(p.awin_affiliate_url,'www.awin1.com')){const u=new URL(p.awin_affiliate_url),q=u.searchParams;if(u.pathname!=='/pclick.php'||q.getAll('m').length!==1||q.getAll('p').length!==1||q.getAll('a').length!==1||q.get('m')!==p.merchant_id||q.get('p')!==p.awin_product_id||!/^\d+$/.test(q.get('a')||''))errors.push('Tracking identity does not match the feed.');}
  if(!r || r.advertiser_id!==p?.merchant_id || r.membership!=='joined' || r.site_approved!==true || r.feed_use_approved!==true || r.image_use_approved!==true || r.tracking_use_approved!==true || !https(r.terms_url)) errors.push('Advertiser membership and applicable program, image and tracking terms require review.');
  if(!r || !recent(r.checked_at,now)||r.item_url!==p?.merchant_url||r.image_url!==p?.image_url||r.image_matches_product!==true||r.feature_confirmed!==true||!p?.feed_price||r.price===null||r.price===undefined||r.price===''||!Number.isFinite(Number(p.feed_price))||Number(p.feed_price)<0||Number(r.price)!==Number(p.feed_price)||r.currency!==p?.currency||!['EUR','GBP','USD'].includes(p?.currency)) errors.push('Fresh identity, feature, image, price and currency verification required.');
  return errors;
}

export function buildAwinCatalogPlan(p,r,now=Date.now()) {
  const errors=validateAwinReview(p,r,now);if(errors.length)throw Error(errors.join(' '));
  const base=`${p.merchant_id}/${p.canonical_product_url}`,product=id('product',base),retailer=id('retailer',p.merchant_id),offer=id('offer',`${p.merchant_id}/${p.awin_product_id}`);
  const type=/100\s*%/i.test(p.claim_evidence_local_only)?'cotton_content_claim':/bund/i.test(p.claim_evidence_local_only)?'seamless_waistband':/flache\s+naht/i.test(p.claim_evidence_local_only)?'flat_seams':/nahtlos/i.test(p.claim_evidence_local_only)?'seamless_construction':/handgekettelt/i.test(p.claim_evidence_local_only)?'hand_linked_seam':'smooth_toe_seam';
  const evidence=id('evidence',`${base}/${type}`),material=id('material-evidence',base);
  const ev={id:evidence,product_id:product,attribute:type,value:true,evidence_type:'unverified_seller_claim',evidence_text_or_source:`Awin advertiser feed: ${type}`,source_url:p.merchant_url,checked_at:r.checked_at};
  const m=p.seller_composition && r.material_confirmed===true?{id:material,product_id:product,attribute:'material',value:p.seller_composition,evidence_type:'unverified_seller_claim',evidence_text_or_source:'Seller-declared composition',source_url:p.merchant_url,checked_at:r.checked_at}:null;
  return {
    retailers:[{id:retailer,name:p.retailer,website_url:'https://socken-online.de'}],
    products:[{id:product,title:p.name,brand:p.brand||null,category:p.proposed_mapping.products.category,images:[]}],product_variants:[],
    product_offers:[{id:offer,product_id:product,source:'awin',source_item_id:`${p.merchant_id}/${p.awin_product_id}`,retailer:p.retailer,retailer_id:retailer,product_url:p.awin_affiliate_url,price:Number(p.feed_price),currency:p.currency,price_observed_at:r.checked_at,last_checked_at:r.checked_at,stock_status:'unknown'}],
    product_offer_prices:[{id:id('price',`${offer}/${r.checked_at}`),offer_id:offer,amount:Number(p.feed_price),currency:p.currency,observed_at:r.checked_at,source_url:p.merchant_url}],
    product_images:[{id:id('image',`${base}/${p.image_url}`),product_id:product,image_url:p.image_url,source_url:p.merchant_url,license_note:`Approved source: ${r.terms_url}`,observed_at:r.checked_at}],
    product_evidence:m?[ev,m]:[ev],product_materials:m?[{id:id('material',base),product_id:product,material:p.seller_composition,evidence_id:material}]:[],
    product_attributes:[{id:id('attribute',`${base}/${type}`),product_id:product,attribute:type,value:true,evidence_id:evidence}],
  };
}
