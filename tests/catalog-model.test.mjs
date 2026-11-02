import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_TABLES, isDocumentedAbsence } from '../lib/personal-shopping/catalog-model.mjs';
const claim={product_id:'product-1',variant_id:'variant-1',attribute:'wool',value:'absent',evidence_type:'manufacturer_spec',evidence_text_or_source:'Composition declaration',source_url:'https://example.org/spec',checked_at:'2026-11-02T12:00:00Z'};
const context={productId:'product-1',variantId:'variant-1',attribute:'wool'};
test('catalog table names match the proposed schema',()=>{assert.equal(CATALOG_TABLES.variants,'product_variants');assert.equal(CATALOG_TABLES.feedback,'product_feedback');});
test('documented absence requires a matching product, variant and attribute',()=>{assert.equal(isDocumentedAbsence(claim,context),true);assert.equal(isDocumentedAbsence(claim,{...context,variantId:'other'}),false);assert.equal(isDocumentedAbsence(claim,{...context,productId:'other'}),false);assert.equal(isDocumentedAbsence(claim,{...context,attribute:'latex'}),false);});
test('inference, missing provenance and unsafe URLs cannot establish absence',()=>{for(const change of [{evidence_type:'inferred'},{evidence_type:'unverified_seller_claim'},{source_url:null},{source_url:'http://example.org'},{source_url:'https://user:pass@example.org'},{checked_at:null},{value:'unknown'}]) assert.equal(isDocumentedAbsence({...claim,...change},context),false);});

test('offer-specific evidence requires the same offer',()=>{const offerClaim={...claim,offer_id:'offer-1'};assert.equal(isDocumentedAbsence(offerClaim,context),false);assert.equal(isDocumentedAbsence(offerClaim,{...context,offerId:'offer-1'}),true);});
