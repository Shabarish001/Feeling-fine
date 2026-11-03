import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAwinReview,buildAwinCatalogPlan} from '../lib/personal-shopping/sources/awin-csv-plan.mjs';
const now=Date.parse('2026-11-03T10:00:00Z');
const fixture={merchant_id:'131023',merchant_product_id:'fixture-1',awin_product_id:'11',canonical_product_url:'https://socken-online.de/test',merchant_url:'https://socken-online.de/test',image_url:'https://socken-online.de/image.jpg',awin_affiliate_url:'https://www.awin1.com/pclick.php?a=99&m=131023&p=11',name:'Fixture socks',retailer:'Fixture retailer',brand:null,feed_price:'3.95',currency:'EUR',seller_composition:'80% cotton',claim_evidence_local_only:'Flache Naht',proposed_mapping:{products:{category:'socks'}}};
const review={advertiser_id:'131023',membership:'joined',site_approved:true,feed_use_approved:true,image_use_approved:true,tracking_use_approved:true,terms_url:'https://example.test/terms',checked_at:'2026-11-03T09:00:00Z',item_url:fixture.merchant_url,image_url:fixture.image_url,image_matches_product:true,feature_confirmed:true,price:'3.95',currency:'EUR'};
test('Awin plan fails closed without advertiser and field approvals',()=>{
  assert.ok(validateAwinReview(fixture,null,now).length);
  assert.throws(()=>buildAwinCatalogPlan(fixture,{...review,membership:'not joined'},now));
  assert.throws(()=>buildAwinCatalogPlan(fixture,{...review,image_use_approved:false},now));
  assert.throws(()=>buildAwinCatalogPlan(fixture,{...review,price:'4.95'},now));
  assert.throws(()=>buildAwinCatalogPlan(fixture,review,now+8*86400000));
  assert.throws(()=>buildAwinCatalogPlan({...fixture,awin_affiliate_url:fixture.awin_affiliate_url.replace('p=11','p=12')},review,now));
});
test('Awin plan has stable keys, tracked offer and explicitly labeled claims',()=>{
  const p=buildAwinCatalogPlan(fixture,review,now);assert.deepEqual(p,buildAwinCatalogPlan(fixture,review,now));
  assert.equal(p.product_offers[0].product_url,fixture.awin_affiliate_url);
  assert.equal(p.product_images[0].source_url,fixture.merchant_url);
  assert.equal(p.product_evidence[0].evidence_type,'unverified_seller_claim');
  assert.equal(p.product_attributes[0].evidence_id,p.product_evidence[0].id);
  assert.equal(p.product_offer_prices[0].currency,'EUR');
});
test('diverse garment claims retain their actual scope',()=>{
  const underwear={...fixture,claim_evidence_local_only:'nahtlosen Signature-Bund',proposed_mapping:{products:{category:'underwear'}}};
  assert.equal(buildAwinCatalogPlan(underwear,review,now).product_attributes[0].attribute,'seamless_waistband');
  const shirt={...fixture,claim_evidence_local_only:'100% Baumwolle',proposed_mapping:{products:{category:'shirts'}}};
  assert.equal(buildAwinCatalogPlan(shirt,review,now).product_attributes[0].attribute,'cotton_content_claim');
  assert.equal(buildAwinCatalogPlan(shirt,review,now).product_materials.length,0);
});
