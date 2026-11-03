"""Build a local-only diverse shortlist; leave the separate sensory pool untouched."""
import csv
import hashlib
import html
import importlib.util
import json
import re
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlunsplit

ROOT=Path(__file__).resolve().parents[1]
FEED=ROOT/'data/imports/datafeed_3143018.csv'
POOL=ROOT/'artifacts/awin-feed-review.json'
OUTPUT=ROOT/'artifacts/awin-diverse-review.json'
csv.field_size_limit(20_000_000)
spec=importlib.util.spec_from_file_location('review_awin_feed',ROOT/'scripts/review-awin-feed.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)


def stable(kind,value):
    raw=bytearray(hashlib.sha256(('feeling-find/awin/v1/'+kind+'/'+value).encode()).digest()[:16])
    raw[6]=(raw[6]&15)|80;raw[8]=(raw[8]&63)|128
    return str(uuid.UUID(bytes=bytes(raw)))


def main():
    pool=json.loads(POOL.read_text(encoding='utf-8'))
    with FEED.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
    if pool.get('sha256')!=digest: raise ValueError('Sensory pool was generated from a different feed; refresh it first')
    found={}; scanned=0; conflicted=set()
    with FEED.open(encoding='utf-8-sig',newline='') as f:
        for x in csv.DictReader(f):
            scanned+=1
            if x['merchant_id']!='131023' or x['in_stock']!='1' or x['is_for_sale']!='1':continue
            name=x['product_name']; text=html.unescape(re.sub(r'<[^>]*>',' ',x['description']))
            source=name+' '+text; category=None; claim=None; evidence=None
            if re.search(r't[ -]?shirts?',name,re.I):
                evidence=re.search(r'100\s*%\s*(?:baumwolle|cotton)',text,re.I)
                if evidence and re.fullmatch(r'\s*(?:Baumwolle|Katoen|Cotton)\s*',x['specifications'],re.I):category='shirts';claim='seller-reported 100% cotton'; evidence=evidence.group(0)
                elif evidence and re.search(r'\d+\s*%',x['specifications']):conflicted.add(urlsplit(x['merchant_deep_link']).path)
            elif re.search(r'legging',name,re.I):
                evidence=re.search(r'nahtlos(?:e[nmrs]?)?',source,re.I)
                if evidence:category='trousers';claim='seller-reported seamless leggings; verify construction and fit';evidence=evidence.group(0)
            elif re.search(r'boxershorts|unterhose|\bslip\b',name,re.I):
                evidence=re.search(r'nahtlos(?:e[nrs]?)?\s+(?:signature[ -]?)?bund|nahtlose[ns]?\s+design|boxershorts\s+nahtlos',source,re.I)
                if evidence:category='underwear';claim='seller-reported seamless garment or waistband; verify scope';evidence=evidence.group(0)
            if not category:continue
            url=x['merchant_deep_link'];image=x['merchant_image_url'];tracking=x['aw_deep_link']
            if not base.safe_url(url,{'socken-online.de','www.socken-online.de'}) or not base.safe_url(image,{'socken-online.de','www.socken-online.de'}) or not base.safe_url(tracking,{'www.awin1.com','awin1.com'}):continue
            q=parse_qs(urlsplit(tracking).query)
            if q.get('m')!=[x['merchant_id']] or q.get('p')!=[x['aw_product_id']] or len(q.get('a',[]))!=1 or not q['a'][0].isdigit():continue
            u=urlsplit(url);canonical=urlunsplit((u.scheme,u.netloc,u.path,'',''))
            item={'merchant_id':x['merchant_id'],'retailer':x['merchant_name'],'merchant_product_id':x['merchant_product_id'],'awin_product_id':x['aw_product_id'],'canonical_product_url':canonical,'name':name,'brand':x['brand_name'] or None,'feed_category':x['category_name'],'merchant_url':url,'image_url':image,'awin_affiliate_url':tracking,'feed_price':x['search_price'],'currency':x['currency'],'feed_size':x['Fashion:size'] or None,'seller_composition':x['specifications'] or None,'seller_description_local_only':x['description'] or None,'feed_last_updated':x['last_updated'] or None,'claim':claim,'claim_evidence_local_only':evidence,'claim_status':'unverified_seller_claim','price_status':'feed_reported_not_currently_verified','rights_status':'unverified','approved_for_import':False,'review_warnings':['Verify exact variant and image association','Verify current price and program rights']}
            key=(category,canonical)
            if key not in found or (item['feed_last_updated'] or '')>(found[key]['feed_last_updated'] or ''):found[key]=item
    # Preserve scope: do not synthesize missing categories or imply a balanced feed.
    extras=sorted(found.values(),key=lambda x:(x['feed_last_updated'] or ''),reverse=True)
    existing={x['canonical_product_url'] for x in extras}
    hosiery=[x for x in pool['candidates'] if x['proposed_mapping']['products']['category']=='hosiery' and x['canonical_product_url'] not in existing][:3]
    socks=[x for x in pool['candidates'] if x['proposed_mapping']['products']['category']=='socks' and x['canonical_product_url'] not in existing][:24]
    products=extras+hosiery+socks
    for x in products:
        x['raw_seller_composition']=x.get('seller_composition')
        if (x.get('seller_composition') or '').strip().lower() in ('staub','fabric','textil','unknown'):
            x['seller_composition']=None
            x.setdefault('review_warnings',[]).append('Feed composition is not a usable material declaration')
        if re.search(r'\bschwarz\b',x['name'],re.I) and re.search(r'(?:^|-)marine(?:-|$)',x['merchant_product_id'],re.I):
            x.setdefault('review_warnings',[]).append('Possible title and variant color mismatch; verify exact SKU')
        title_size=re.search(r'[–—-]\s*(XXL|XL|S|M|L)\s*$',x['name'],re.I)
        sku_size=re.search(r'-(XXL|XL|S|M|L)$',x['merchant_product_id'],re.I)
        if title_size and sku_size and title_size.group(1).upper()!=sku_size.group(1).upper():
            x.setdefault('review_warnings',[]).append('Possible title and SKU size mismatch; verify exact variant')
        if 'proposed_mapping' not in x:
            kind='shirt' if x['claim'].startswith('seller-reported 100%') else ('legging' if x in extras and 'leggings' in x['claim'] else 'underwear')
            product_id=stable('product',x['merchant_id']+'/'+x['canonical_product_url'])
            x['proposed_mapping']={'products':{'id':product_id,'category':{'shirt':'shirts','legging':'trousers','underwear':'underwear'}[kind]},'retailers':{'id':stable('retailer',x['merchant_id'])},'product_offers':{'id':stable('offer',x['merchant_id']+'/'+x['awin_product_id']),'product_id':product_id,'source':'awin','source_item_id':x['merchant_id']+'/'+x['awin_product_id']}}
    result={'source_file':str(FEED.relative_to(ROOT)),'sha256':digest,'records_examined':scanned,'selected':len(products),'categories':dict(Counter(x['proposed_mapping']['products']['category'] for x in products)),'advertisers':dict(Counter(x['retailer'] for x in products)),'conflicting_cotton_product_paths_excluded':len(conflicted),'approved':0,'candidates':products}
    OUTPUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='candidates'}))


if __name__=='__main__':main()
