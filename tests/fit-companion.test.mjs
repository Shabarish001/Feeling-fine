import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompanionSuggestion,mergeConfirmedSuggestions} from '../lib/personal-shopping/companion.mjs';
import {defaults} from '../lib/personal-shopping/schema.mjs';
import {passesRestrictions,scoreProduct} from '../lib/personal-shopping/matching.mjs';
import {graphRecommend} from '../lib/personal-shopping/graph.mjs';
import {fixtureDb,testRecord} from '../lib/personal-shopping/e2e-store.mjs';

test('AI suggestions are validated and cannot include diagnoses, invented fields or unknown values',()=>{
  const s=validateCompanionSuggestion({needs:['seated_fit','easy_fastening'],avoid_features:['magnetic_closure'],category:'trousers',colors:['black'],style:['casual']});
  assert.deepEqual(s.needs,['seated_fit','easy_fastening']);assert.deepEqual(s.avoid_features,['magnetic_closure']);
  assert.throws(()=>validateCompanionSuggestion({diagnosis:'invented'}));
  assert.throws(()=>validateCompanionSuggestion({needs:['diagnosis']}));
  assert.throws(()=>validateCompanionSuggestion({avoid_features:'magnetic_closure'}));
});
test('confirmed follow-up suggestions preserve prior needs and restrictions',()=>{
  const prior={...defaults,mode:'live',needs:['seated_fit'],category:'trousers',avoid_materials:['wool']};
  const next=mergeConfirmedSuggestions(prior,{avoid_features:['magnetic_closure']});
  assert.deepEqual(next.needs,['seated_fit']);assert.equal(next.category,'trousers');assert.deepEqual(next.avoid_materials,['wool']);assert.deepEqual(next.avoid_features,['magnetic_closure']);
});
test('fastening exclusions reject present and unknown features and require sourced absence',()=>{
  const base={features:[],evidence:[],offers:[{}],materials:[]};const p={...defaults,avoid_features:['magnetic_closure']};
  assert.equal(passesRestrictions(base,p),false);
  const absence={attribute:'magnetic_closure',value:'absent',evidence_type:'retailer_spec',source_url:'https://retailer.example/item',checked_at:'2026-11-03T00:00:00Z',evidence_text_or_source:'No magnets'};
  assert.equal(passesRestrictions({...base,evidence:[absence]},p),true);
  assert.equal(passesRestrictions({...base,features:['magnetic_zipper'],evidence:[absence]},p),false);
  assert.equal(passesRestrictions({...base,evidence:[absence,{attribute:'magnetic_closure',value:true}]},p),false);
  assert.equal(passesRestrictions({...base,evidence:[{...absence,source_url:null}]},p),false);
});
test('saved exclusions cannot be removed by a request and remain isolated between users',async()=>{
  testRecord('companion-alice').preferences={...defaults,mode:'live',avoid_features:['magnetic_closure']};
  testRecord('companion-bob').preferences={...defaults,mode:'live'};
  const input={...defaults,mode:'live',needs:['easy_fastening'],avoid_features:[]};
  const alice=await graphRecommend(input,{db:fixtureDb('companion-alice'),userId:'companion-alice'});
  const bob=await graphRecommend(input,{db:fixtureDb('companion-bob'),userId:'companion-bob'});
  assert.equal(alice.results.length,0);assert.equal(bob.results.length,1);
});
test('unsupported restrictions block confirmation instead of silently disappearing',()=>{
  const p=mergeConfirmedSuggestions(defaults,{requires_manual_review:true});
  assert.match(p.custom_restrictions,/manual review/);
  assert.equal(passesRestrictions({features:[],evidence:[],offers:[],materials:[]},p),false);
});
test('recommendations identify the actual matching evidence and keep users isolated',async()=>{
  const r=await graphRecommend({...defaults,mode:'live',needs:['easy_fastening']},{db:fixtureDb(null)});
  assert.equal(r.results.length,1);assert.equal(r.results[0].match_evidence[0].attribute,'easy_fastening');assert.match(r.results[0].match_evidence[0].source_url,/fixtures/);
  assert.ok(!r.results.some(p=>p.evidence.some(e=>e.evidence_type==='inferred')));
});
test('explicit feedback affects subsequent ranking',()=>{
  const p={...defaults};const product={id:'x',offers:[],evidence:[],features:[],materials:[]};
  assert.ok(scoreProduct(product,p,[{product_id:'x',feedback_type:'dismissed'}]).score<scoreProduct(product,p,[]).score);
});
