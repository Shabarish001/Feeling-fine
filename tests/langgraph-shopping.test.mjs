import test from 'node:test';
import assert from 'node:assert/strict';
import {graphRecommend,passesRestrictions,scoreProduct} from '../lib/personal-shopping/graph.mjs';
import {defaults} from '../lib/personal-shopping/schema.mjs';
import {demoCatalog} from '../lib/personal-shopping/demo-catalog.mjs';

const preferences=(x={})=>({...defaults,...x});
test('two profiles rank the same clothing category differently',async()=>{
  const hand=await graphRecommend(preferences({category:'shirts',needs:['limited_dexterity']}));
  const sensory=await graphRecommend(preferences({category:'shirts',needs:['sensory_softness']}));
  assert.match(hand.results[0].title,/Easy Close/); assert.match(sensory.results[0].title,/Soft Seam/);
  assert.equal(hand.mode,'demo');
});
test('hard restrictions reject unknown, excluded, wrong size, budget and features',()=>{
  const product=demoCatalog.find(x=>x.id==='sample-s01');
  assert.equal(passesRestrictions(product,preferences({avoid_materials:['wool']}),true),true);
  assert.equal(passesRestrictions(product,preferences({avoid_materials:['polyester']}),true),false);
  assert.equal(passesRestrictions({...product,materials:['100% polyester']},preferences({avoid_materials:['polyester']}),true),false);
  assert.equal(passesRestrictions(product,preferences({required_features:['tag_free']}),true),false);
  assert.equal(passesRestrictions(product,preferences({size:'M'}),true),false);
  assert.equal(passesRestrictions(product,preferences({max_price:1}),true),false);
  assert.equal(passesRestrictions(product,preferences({custom_restrictions:'sensitive'}),true),false);
});
test('explicit feedback changes ranking without changing restrictions',()=>{
  const p=preferences({category:'shirts'}); const [a,b]=demoCatalog.filter(x=>x.category==='shirts');
  assert.ok(scoreProduct(b,p,[{product_id:b.id,feedback_type:'helpful'}],true).score>scoreProduct(a,p,[],true).score);
  assert.equal(passesRestrictions(b,preferences({avoid_materials:['latex']}),true),false);
});
test('empty live catalog and empty fixtures are safe',async()=>{
  const r=await graphRecommend(preferences({mode:'live'})); assert.deepEqual(r.results,[]);
  const demo=await graphRecommend(preferences(),{fixtures:[]}); assert.deepEqual(demo.results,[]);
});
test('saved restrictions are isolated by authenticated owner and cannot be relaxed',async()=>{
  const seen=[];
  const db={from(table){return {select(){return this},eq(k,v){seen.push([table,k,v]);return this},maybeSingle:async()=>({data:{preferences:preferences({category:'shirts',avoid_materials:['latex']})}}),order(){return this},limit:async()=>({data:[]})}}};
  const r=await graphRecommend(preferences({category:'shirts',avoid_materials:[]}),{db,userId:'user-one'});
  assert.ok(seen.every(x=>x[1]==='user_id'&&x[2]==='user-one'));
  assert.ok(r.results.every(x=>x.evidence.some(e=>e.attribute==='latex'&&e.value==='absent')));
});
test('saved feedback changes the next graph result without crossing users',async()=>{
  const db={from(table){let owner;return {select(){return this},eq(k,v){owner=v;return this},maybeSingle:async()=>({data:null}),order(){return this},limit:async()=>({data:owner==='user-two'?[{product_id:'sample-s02',feedback_type:'helpful'}]:[]})}}};
  const input=preferences({category:'shirts'});
  const one=await graphRecommend(input,{db,userId:'user-one'});
  const two=await graphRecommend(input,{db,userId:'user-two'});
  assert.equal(one.results[0].id,'sample-s01');
  assert.equal(two.results[0].id,'sample-s02');
});
