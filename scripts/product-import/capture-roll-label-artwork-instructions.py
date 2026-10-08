"""Bounded public modal capture through the existing WMD reader.

Raw responses are evidence only. An absent material echo never establishes a
material-specific rule. This script has no account/cart/order or write client.
"""
import argparse, copy, gzip, hashlib, importlib.util, json, pathlib, re
from urllib.parse import urlencode, urlsplit, parse_qs

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'docs/roll-labels-2026-09-30'
OUT = ROOT / 'output/supplier-imports/roll-labels-catalogue-2026-10-06/artwork-modals'

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def text_value(value):
    import html
    return re.sub(r'\s+', ' ', html.unescape(value)).strip()

def modal_url(query):
    allowed = {'ajax_call', 'c', 'sid', 'info', 'bu', 'menge', 'auflage', 'sorte', 'auflageid', 'bookCategoryFlag'}
    if set(query) != allowed or query['ajax_call'] != 'details' or query['info'] != 'druckdaten':
        raise ValueError('Only the public print-data details read is allowed')
    if query['bu'] != '' or query['bookCategoryFlag'] not in ('0', '1'):
        raise ValueError('Unsupported modal context')
    if not re.fullmatch(r'\d+', query['c']) or not re.fullmatch(r'\d+', query['menge']):
        raise ValueError('Invalid article or quantity')
    if not re.fullmatch(r'[a-fA-F0-9]{16,128}', query['sid']) or not query['sorte']:
        raise ValueError('Missing fresh session or material')
    return 'https://www.wir-machen-druck.de/product_detail_info.htm?' + urlencode(query)

def read_modal(api, query):
    url = modal_url(query)
    parsed = urlsplit(url)
    if parsed.path != '/product_detail_info.htm' or parse_qs(parsed.query)['ajax_call'] != ['details']:
        raise ValueError('Unexpected endpoint')
    raw = api.request(url)
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError('Modal exceeds bounded response size')
    return raw

def load_reader():
    spec = importlib.util.spec_from_file_location('existing_wmd_reader', SOURCE / 'extract-prices-and-templates.py')
    api = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    return api

def capture_article(api, article, profiles):
    aid = article['supplier_article_id']
    directory = OUT / 'articles' / aid
    directory.mkdir(parents=True, exist_ok=True)
    raw = api.request(article['source_url'])
    tree, selects, current = api.parse_page(raw)
    if current['articleId'] != aid:
        raise ValueError('Fresh page article changed')
    script = re.search(r'\$\.get\(\s*"product_detail_info\.htm"\s*,\s*\{([^}]+)\}', raw.decode())
    if not script or "'ajax_call':'details'" not in script[1] or 'info:"druckdaten"' not in script[1]:
        raise ValueError('Fresh source does not establish the modal contract')
    sid = re.search(r"sid:'([a-fA-F0-9]+)'", script[1])
    flag = re.search(r"bookCategoryFlag:'([01])'", script[1])
    if not sid or not flag:
        raise ValueError('Fresh modal context absent')
    pagepath = directory / (sha(raw) + '.page.html.gz')
    if not pagepath.exists():
        pagepath.write_bytes(gzip.compress(raw))
    materials = {option['value']: option for field in selects if field['name'] == 'sorten' for option in api.valid_options(field)}
    results = []
    for profile in profiles:
        target = directory / (profile['sourceMaterialId'] + '.json')
        if target.exists():
            cached = json.loads(target.read_text())
            bodypath = ROOT / cached['modalPath'] if cached.get('modalPath') else None
            if cached['sourceMaterialSha256'] != profile['sourceEvidenceSha256'] or (bodypath and sha(bodypath.read_bytes()) != cached['modalSha256']):
                raise ValueError('Stale or changed cached modal')
            results.append(cached)
            continue
        source = SOURCE / profile['sourceEvidencePath']
        record = {'profileKey': profile['key'], 'articleId': aid, 'sourceMaterialId': profile['sourceMaterialId'],
                  'sourceMaterialSha256': sha(source.read_bytes()), 'sourcePageSha256': sha(raw),
                  'sourcePagePath': str(pagepath.relative_to(ROOT)), 'capturedAt': api.stamp(),
                  'databaseWrites': False, 'productionLayerApproval': False, 'onlineDesignerVerified': False}
        try:
            if record['sourceMaterialSha256'] != profile['sourceEvidenceSha256']:
                raise ValueError('Saved material changed')
            saved = json.loads(source.read_text())
            material = materials.get(profile['sourceMaterialId'])
            if not material or text_value(material['label']) != text_value(saved['material']['label']):
                raise ValueError('Fresh material inventory or label changed')
            request = copy.deepcopy(saved['quotes'][0]['evidence']['request'])
            if request['articleId'] != aid or request['substrateId'] != profile['sourceMaterialId']:
                raise ValueError('Foreign quote request')
            request['token'] = current['token']
            evidence = api.api('get-price', request)
            quote = api.response(evidence)
            checks = {'quantity': int(quote['quantity']) == int(request['quantity']),
                      'positiveEUR': quote['currency'] == 'EUR' and float(quote['price']) > 0,
                      'materialInQuote': text_value(material['label']) in text_value(quote.get('articleDescription', '')),
                      'options': all(any(text_value(v.get('value', '')) == text_value(chosen['value']) for v in quote.get('additionalUpsells', {}).get(field, [])) for field, chosen in request['additionalUpsells'].items())}
            for axis in ('width', 'height'):
                if axis in request:
                    checks[axis] = float(quote.get('dimension', {}).get(axis, 0)) == float(request[axis])
            if request.get('priceScaleId'):
                checks['priceScale'] = str(quote['priceScaleId']) == str(request['priceScaleId'])
            record.update(quoteEvidence=evidence, contextChecks=checks)
            if not all(checks.values()):
                raise ValueError('Fresh exact quote context failed')
            row = next((r for r in saved['price_rows'] if str(r['id']) == str(quote['priceScaleId']) and int(r['wert']) == int(quote['quantity']) and str(r['artikel_sorten__id']) == profile['sourceMaterialId']), None)
            # The source has no listed Auflage label for individual dimensions.
            # Keep that absence explicit; never manufacture a net-price label.
            query = {'ajax_call': 'details', 'c': aid, 'sid': sid[1], 'info': 'druckdaten', 'bu': '',
                     'menge': str(quote['quantity']), 'auflage': row['bezeichnung'] if row else '',
                     'sorte': material['label'], 'auflageid': str(quote['priceScaleId']), 'bookCategoryFlag': flag[1]}
            body = read_modal(api, query)
            bodypath = directory / (profile['sourceMaterialId'] + '.' + sha(body) + '.html')
            bodypath.write_bytes(body)
            text = text_value(api.html.fromstring(body).text_content())
            echoed = text_value(material['label']) in text
            record.update(modalSha256=sha(body), modalPath=str(bodypath.relative_to(ROOT)), textOriginal=text,
                          query={k: v for k, v in query.items() if k != 'sid'}, sessionSha256=sha(sid[1].encode()),
                          materialEchoInModal=echoed, sourceAuflageLabelAvailable=row is not None,
                          status='material_echo_verified' if echoed else 'unbound_modal_material_echo_absent')
        except Exception as error:
            record.update(status='quarantined', error=str(error))
        api.save(target, record)
        results.append(record)
        print(json.dumps({'profileKey': record['profileKey'], 'status': record['status']}), flush=True)
    return results

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture', action='store_true')
    parser.add_argument('--profiles', nargs='+', required=True)
    args = parser.parse_args()
    inventory = [json.loads(line) for line in (OUT.parent / 'normalized/article-material-profiles.jsonl').read_text().splitlines()]
    selected = [p for p in inventory if p['key'] in args.profiles]
    if len(selected) != len(set(args.profiles)) or len(selected) > 200:
        raise ValueError('Unknown profile or capture exceeds 200-profile bound')
    print(json.dumps({'profiles': len(selected), 'networkEnabled': args.capture, 'databaseWrites': False}), flush=True)
    if not args.capture:
        return
    api = load_reader()
    articles = json.loads((SOURCE / 'catalogue.normalized.json').read_text())['articles']
    results = []
    for article in articles:
        profiles = [p for p in selected if p['articleId'] == article['supplier_article_id']]
        if profiles:
            results.extend(capture_article(api, article, profiles))
    receipt = {'capturedAt': api.stamp(), 'profiles': len(results), 'databaseWrites': False,
               'statuses': {status: sum(r['status'] == status for r in results) for status in {r['status'] for r in results}}}
    api.save(OUT / ('capture-' + sha('\n'.join(sorted(args.profiles)).encode())[:16] + '.json'), receipt)
    print(json.dumps(receipt), flush=True)

if __name__ == '__main__':
    main()
