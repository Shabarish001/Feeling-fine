"""Read the supplied CSV files and produce a conservative, local-only review."""
import csv
import json
import re
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
INPUTS = [ROOT / 'data/imports/feeling_find_germany_product_candidates.csv', ROOT / 'data/imports/feeling_find_product_research.csv']


def canonical(raw, kind):
    """Keep ePages ObjectPath; discard Shopify collection/tracking and variant only for product grouping."""
    try:
        u = urlsplit(raw.strip())
        if u.scheme != 'https' or not u.hostname or u.username or u.password:
            return None
        host = u.hostname.lower()
        path = re.sub(r'/+', '/', u.path).rstrip('/')
        if '/products/' in path:
            path = '/products/' + path.split('/products/', 1)[1]
        q = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if k.lower() == 'objectpath']
        if kind == 'category_page' or not (('/products/' in path and path.split('/products/', 1)[1]) or any('/Products/' in v for _, v in q)):
            return None
        return urlunsplit(('https', host, path, urlencode(q), ''))
    except (ValueError, AttributeError):
        return None


def text_or_none(value):
    value = (value or '').strip()
    return value or None


def main():
    by_url = {}
    products = []
    columns = {}
    total = 0
    duplicates = []
    for path in INPUTS:
        with path.open(encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            columns[path.name] = reader.fieldnames
            for line, row in enumerate(reader, 2):
                if not any((v or '').strip() for v in row.values()):
                    continue
                total += 1
                raw_url = text_or_none(row.get('product_url') or row.get('source_url'))
                url = canonical(raw_url, row.get('url_type')) if raw_url else None
                price_raw = text_or_none(row.get('price_observed') or row.get('observed_price_eur'))
                try:
                    amount = Decimal(price_raw) if price_raw else None
                    price = str(amount) if amount is not None and amount.is_finite() and amount >= 0 else None
                except InvalidOperation:
                    price = None
                currency = text_or_none(row.get('currency'))
                if currency not in ('EUR', 'GBP', 'USD'):
                    currency = None
                feature_text = text_or_none(row.get('accessibility_features') or row.get('seller_claimed_features'))
                features = [x.strip() for x in feature_text.split(';') if x.strip()] if feature_text else []
                record = {
                    'name': text_or_none(row.get('product_name')), 'brand': text_or_none(row.get('brand')), 'retailer': text_or_none(row.get('retailer')),
                    'sku': text_or_none(row.get('retailer_sku_or_variant')),
                    'category': text_or_none(row.get('category')), 'product_url': raw_url if url else None, 'canonical_url': url, 'source_url': text_or_none(row.get('source_url')),
                    'raw_product_or_source_url': raw_url, 'price': price, 'currency': currency,
                    'price_observed_date': text_or_none(row.get('price_observed_date')), 'price_status': 'reported_unverified',
                    'image_url': text_or_none(row.get('product_image_url') or row.get('image_url')),
                    'image_permission': text_or_none(row.get('image_publication_permission') or row.get('image_usage_permission')),
                    'features': features, 'material': text_or_none(row.get('materials_seller_claim')),
                    'availability': text_or_none(row.get('availability')), 'delivery_to_germany': text_or_none(row.get('delivery_to_germany')),
                    'verification_status': 'unverified', 'import_status': 'review_only',
                    'review_reasons': ['source storage and display rights not established', 'product and source claims not independently verified'],
                    'source_rows': [{'file': path.name, 'row': line, 'original': row}],
                }
                for missing, reason in [(not url, 'missing direct product URL'), (not (price and currency), 'missing valid price or currency'), (not record['image_url'], 'missing product image'), (not record['category'], 'missing clothing category'), (not features, 'missing accessibility attributes'), (not record['price_observed_date'], 'missing price observation date')]:
                    if missing:
                        record['review_reasons'].append(reason)
                if any('\ufffd' in (v or '') for v in row.values()):
                    record['review_reasons'].append('source contains an encoding replacement character')
                if url and url in by_url:
                    existing = by_url[url]
                    existing['source_rows'].extend(record['source_rows'])
                    existing['review_reasons'].append('duplicate product URL: reconcile source fields and variants')
                    duplicates.append({'canonical_url': url, 'rows': [existing['source_rows'][0]['file'] + ':' + str(existing['source_rows'][0]['row']), path.name + ':' + str(line)]})
                else:
                    products.append(record)
                    if url:
                        by_url[url] = record
    counts = {'input_rows': total, 'unique_candidate_records': len(products), 'duplicate_rows': len(duplicates),
              'with_reported_price_and_currency': sum(bool(p['price'] and p['currency']) for p in products),
              'with_direct_format_url_unverified': sum(bool(p['product_url']) for p in products),
              'with_image_url': sum(bool(p['image_url']) for p in products),
              'with_reported_accessibility_attributes': sum(bool(p['features']) for p in products),
              'with_observation_date': sum(bool(p['price_observed_date']) for p in products),
              'requiring_review': len(products), 'approved_for_import': 0,
              'currencies': dict(Counter(p['currency'] or 'unknown' for p in products))}
    out = {'note': 'Local research preview only. Supplied claims, URL formats, prices, and permissions are not independently verified.', 'columns': columns, 'counts': counts, 'duplicates': duplicates, 'products': products}
    target = ROOT / 'artifacts/spreadsheet-import-preview.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(counts, indent=2))
    print('Preview:', target)


if __name__ == '__main__':
    main()
