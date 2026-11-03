"""Read-only, streaming review of the supplied Awin CSV. Never imports or fetches URLs."""
import csv
import hashlib
import html
import json
import re
import uuid
from collections import Counter
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / 'data/imports/datafeed_3143018.csv'
OUTPUT = ROOT / 'artifacts/awin-feed-review.json'
csv.field_size_limit(20_000_000)
CLAIM = re.compile(r'nahtlos(?:en|er|es|e)?(?:\s+[\w-]+){0,4}\s+(?:zehen|zehennaht|verarbeitung|konstruktion|socken|str.mpfe)|(?:socken|str.mpfe|zehenbereich|zehennaht)(?:\s+[\w-]+){0,4}\s+nahtlos|flache\s+naht|keine\s+sp.rbare\s+zehennaht|nahtlose\s+verarbeitung\s+an\s+den\s+zehen|handgekettelt(?:e)?\s+naht', re.I)


def safe_url(raw, allowed):
    try:
        u = urlsplit(raw)
        return u.scheme == 'https' and u.hostname in allowed and u.port in (None, 443) and not u.username and not u.password
    except ValueError:
        return False


def main():
    merchants, categories, populated = Counter(), Counter(), Counter()
    candidates, counts, columns = {}, Counter(), []
    with FEED.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        columns = reader.fieldnames or []
        for row in reader:
            counts['examined'] += 1
            merchants[(row['merchant_name'], row['merchant_id'])] += 1
            categories[row['category_name']] += 1
            for field in ['merchant_image_url','merchant_deep_link','aw_deep_link','search_price','currency','Fashion:size','last_updated']:
                if row.get(field, '').strip(): populated[field] += 1
            if row['merchant_id'] != '131023' or row['in_stock'] != '1' or row['is_for_sale'] != '1':
                continue
            if not re.search(r'sock|str.mpf', row['product_name'], re.I) or re.search(r'baby|kinder|m.dchen', row['product_name'], re.I):
                continue
            text = html.unescape(re.sub(r'<[^>]*>', ' ', row['description']))
            match = CLAIM.search(text)
            if not match: continue
            counts['matching_feed_rows'] += 1
            url = row['merchant_deep_link']
            if not safe_url(url, {'socken-online.de', 'www.socken-online.de'}):
                counts['invalid_product_url'] += 1
                continue
            parsed = urlsplit(url)
            canonical = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', ''))
            image = row['merchant_image_url']
            affiliate = row['aw_deep_link']
            tracking = parse_qs(urlsplit(affiliate).query) if safe_url(affiliate, {'www.awin1.com','awin1.com'}) else {}
            affiliate_matches = tracking.get('m') == [row['merchant_id']] and tracking.get('p') == [row['aw_product_id']] and len(tracking.get('a', [])) == 1 and tracking['a'][0].isdigit()
            candidate = {
                'merchant_id':row['merchant_id'], 'retailer':row['merchant_name'], 'merchant_product_id':row['merchant_product_id'],
                'awin_product_id':row['aw_product_id'], 'canonical_product_url':canonical,
                'name':row['product_name'], 'brand':row['brand_name'] or None, 'feed_category':row['category_name'],
                'merchant_url':url, 'image_url':image if safe_url(image, {'socken-online.de','www.socken-online.de'}) else None,
                'awin_link_present':affiliate_matches,
                'awin_affiliate_url':affiliate if affiliate_matches else None,
                'feed_price':row['search_price'], 'currency':row['currency'], 'feed_size':row['Fashion:size'] or None,
                'seller_composition':row['specifications'] or None, 'seller_description_local_only':row['description'] or None, 'delivery_cost':row['delivery_cost'] or None,
                'delivery_time':row['delivery_time'] or None,
                'feed_last_updated':row['last_updated'] or None, 'feed_stock_claim':'in_stock',
                'claim':'seller-reported seam or seamless construction; confirm scope and location', 'claim_evidence_local_only':match.group(0),
                'claim_status':'unverified_seller_claim', 'price_status':'feed_reported_not_currently_verified',
                'url_status':'https_syntax_only', 'image_status':'https_syntax_only',
                'rights_status':'unverified', 'approved_for_import':False,
            }
            # Stable proposed keys; no database writes and no implied approval.
            def stable(kind, value):
                raw=bytearray(hashlib.sha256(('feeling-find/awin/v1/'+kind+'/'+value).encode()).digest()[:16])
                raw[6]=(raw[6]&15)|80
                raw[8]=(raw[8]&63)|128
                return str(uuid.UUID(bytes=bytes(raw)))
            product_id=stable('product',row['merchant_id']+'/'+canonical)
            offer_id=stable('offer',row['merchant_id']+'/'+row['aw_product_id'])
            candidate['proposed_mapping']={
                'products':{'id':product_id,'title':row['product_name'],'brand':row['brand_name'] or None,'category':'hosiery' if re.search(r'strumpfhose|panty',row['product_name'],re.I) else 'socks'},
                'retailers':{'id':stable('retailer',row['merchant_id']),'name':row['merchant_name']},
                'product_offers':{'id':offer_id,'product_id':product_id,'source':'awin','source_item_id':row['merchant_id']+'/'+row['aw_product_id'],'affiliate_url_local_only':candidate['awin_affiliate_url'],'merchant_url':url,'currency':row['currency'],'price':row['search_price'],'price_status':'unverified'},
                'product_offer_prices':'Omit until a verified price observation and timestamp exist.',
                'product_images':{'product_id':product_id,'image_url':candidate['image_url'],'status':'rights and association unverified'},
                'product_materials':{'product_id':product_id,'seller_composition':candidate['seller_composition'],'status':'seller claim'},
                'product_attributes':{'product_id':product_id,'attribute':'seam_construction','status':'seller claim'},
                'product_evidence':{'product_id':product_id,'source_url':url,'evidence_type':'unverified_seller_claim'},
            }
            def rank(x):
                return (sum(bool(x.get(k)) for k in ('name','brand','image_url','awin_affiliate_url','feed_price','currency','seller_composition','feed_size')), x.get('feed_last_updated') or '')
            if canonical not in candidates or rank(candidate)>rank(candidates[canonical]): candidates[canonical] = candidate
    result = {'source_file':str(FEED.relative_to(ROOT)), 'sha256':hashlib.file_digest(FEED.open('rb'), 'sha256').hexdigest(),
              'columns':columns, 'counts':dict(counts), 'merchants':[{'name':k[0],'id':k[1],'rows':v} for k,v in merchants.most_common()],
              'category_counts':dict(categories), 'populated_columns':dict(populated),
              'relevant_unique_candidates':len(candidates), 'approved':0,
              'limitations':['Review-only feed claims; do not infer medical safety.', 'No current price, item, image or license has been verified.', 'All proposed candidates are hosiery, not adaptive shirts or seated trousers.'],
              'candidates':sorted(candidates.values(),key=lambda x:(bool(x['seller_composition']),x['feed_last_updated'] or ''),reverse=True)[:50]}
    OUTPUT.parent.mkdir(exist_ok=True)
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'examined':counts['examined'],'matching_rows':counts['matching_feed_rows'], 'unique_candidates':len(candidates),'approved':0, 'preview':str(OUTPUT.relative_to(ROOT))}))


if __name__ == '__main__': main()
