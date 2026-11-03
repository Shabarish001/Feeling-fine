import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
test('feed review checks hosts and only accepts specific seam claims',()=>{
  const code=`import importlib.util\ns=importlib.util.spec_from_file_location('review','scripts/review-awin-feed.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\na={'socken-online.de'}\nassert m.safe_url('https://socken-online.de/product',a)\nassert not m.safe_url('https://socken-online.de.evil.test/p',a)\nassert not m.safe_url('https://socken-online.de:444/p',a)\nassert not m.safe_url('https://evil@socken-online.de/p',a)\nassert m.CLAIM.search('Flache Naht für druckfreien Zehenbereich')\nassert not m.CLAIM.search('magnetic necklace')\n`;
  const r=spawnSync(process.platform==='win32'?'python':'python3',['-c',code],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
});
test('local diverse shortlist keeps products unique and permissions unresolved',{skip:!existsSync('data/imports/datafeed_3143018.csv')||!existsSync('artifacts/awin-feed-review.json')},()=>{
  const result=spawnSync(process.platform==='win32'?'python':'python3',['scripts/review-awin-diverse.py'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const p=JSON.parse(readFileSync('artifacts/awin-diverse-review.json','utf8'));
  assert.ok(p.selected>=30&&p.selected<=50);
  assert.equal(new Set(p.candidates.map(x=>x.canonical_product_url)).size,p.selected);
  assert.ok(p.candidates.every(x=>x.approved_for_import===false&&x.rights_status==='unverified'));
  assert.ok(p.candidates.some(x=>x.proposed_mapping.products.category==='shirts'));
  assert.ok(p.candidates.some(x=>x.proposed_mapping.products.category==='trousers'));
});
