import test from 'node:test';
import assert from 'node:assert/strict';
import { eligibility, buildPlan } from '../scripts/import-csv-products.mjs';
const p={name:'Fixture',retailer:'Merchant',category:'shirt',product_url:'https://example.test/products/one',price:'10.00',currency:'EUR',image_url:'https://example.test/one.jpg',features:['magnetic fastening'],material:'cotton'};
const grant=()=>({status:'approved',scope:'public_catalog',reference_url:'https://example.test/rights'});
const now=Date.parse('2026-11-02T13:00:00Z');
const r={product_url:p.product_url,product_evidence_url:p.product_url,url_verified:true,checked_at:'2026-11-02T12:00:00Z',field_approvals:{metadata:grant()},price:p.price,currency:p.currency};
test('independent metadata approval permits an image-free plan, without inventing optional facts',()=>{
 assert.deepEqual(eligibility(p,r,now),[]);
 const plan=buildPlan(p,r,now);
 assert.equal(plan.product_images.length,0);assert.equal(plan.product_offer_prices.length,0);assert.equal(plan.product_attributes.length,0);assert.equal(plan.product_materials.length,0);
 assert.equal(plan.product_offers[0].price,undefined);
});
test('metadata remains blocked without a documented field-level public-use basis and verified URL',()=>{
 assert.ok(eligibility(p,undefined,now).length);assert.ok(eligibility(p,{...r,field_approvals:{}},now).length);
 assert.ok(eligibility(p,{...r,url_verified:false},now).length);assert.ok(eligibility(p,r,now+8*86400000).length);
});
test('approved fields map independently with provenance and matching observed values',()=>{
 const x={...r,price_verified:true,price_checked_at:r.checked_at,reference_url:p.product_url,image_matches_product:true,image_url:p.image_url,accessibility_verified:true,feature_evidence_url:p.product_url,material_verified:true,material_evidence_url:p.product_url,field_approvals:{metadata:grant(),price:grant(),image:grant(),features:grant(),material:grant()}};
 const plan=buildPlan(p,x,now);assert.deepEqual(plan,buildPlan(p,x,now));
 assert.equal(plan.product_offer_prices[0].amount,10);assert.equal(plan.product_images[0].image_url,p.image_url);
 assert.equal(plan.product_attributes[0].evidence_id,plan.product_evidence[0].id);assert.equal(plan.product_materials[0].evidence_id,plan.product_evidence.at(-1).id);
 const noImage=buildPlan(p,{...x,image_matches_product:false},now);assert.equal(noImage.product_images.length,0);assert.equal(noImage.product_offer_prices.length,1);
 const stale=buildPlan(p,{...x,price_checked_at:'2020-01-01T00:00:00Z'},now);assert.equal(stale.product_offer_prices.length,0);
});
