#!/usr/bin/env python3
"""Read-only WMD Gulvfolie quote/document adapter. No bank/product writes."""
import argparse, hashlib, importlib.util, json, math, re, sys, threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from curl_cffi import requests

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('guarded_scrapling', HERE / 'scrapling/extract.py')
bridge = importlib.util.module_from_spec(spec); sys.modules[spec.name] = bridge; spec.loader.exec_module(bridge)
HOSTS = {'www.wir-machen-druck.de'}
ENDPOINT = 'https://www.wir-machen-druck.de/wmdrest/article/get-price'


def redact(value):
    if isinstance(value, dict):
        return {key: '[redacted]' if key.lower() in {'token', '_token', 'keyword', 'stichwort'} else redact(item) for key, item in value.items()}
    if isinstance(value, list): return [redact(item) for item in value]
    return value


def parse_inputs(html):
    # Parse HTML without running supplier scripts.
    from scrapling.parser import Selector
    doc = Selector(html)
    def value(name):
        item = doc.css(f'input[name="{name}"]')
        return item[0].attrib.get('value', '') if item else ''
    article = value('c')
    if not article.isdigit(): raise ValueError('Missing exact article ID')
    quantity = doc.css('#menge_input')[0]
    variants = [{ 'id': x.attrib['value'], 'label': bridge.normalize_text(x.get_all_text(separator=' ', strip=True)) } for x in doc.css('#sorten option')]
    base = {'token': value('_token'), 'categoryId': value('categoryId'), 'shopId': value('shopId') or '0', 'userId': '0', 'articleId': article, 'keyword': value('stichwort'), 'isIndividualQuantity': False, 'ownPrintData': '1', 'articleOptions': [8], 'deliveryOption': 'STANDARD_PRODUCTION', 'forwardingShipment': '', 'remarks': '', 'referenceTxt': '', 'voucherCode': '', 'additionalUpsells': {}}
    return base, {'articleId': article, 'minimumQuantity': int(quantity.attrib.get('min', 1)), 'maximumQuantity': int(quantity.attrib['max']), 'variants': variants}


def validated_quote(response, width, height, quantity):
    result = response.get('data', {}).get('response', {})
    info = response.get('data', {}).get('info')
    if response.get('code') != 200 or result.get('currency') != 'EUR': raise ValueError('Missing EUR quote')
    if float(result.get('quantity', -1)) != quantity: raise ValueError('Supplier changed quantity')
    dim = result.get('dimension') or {}
    if float(dim.get('width', -1)) != width or float(dim.get('height', -1)) != height: raise ValueError('Supplier changed dimensions')
    if float(result.get('price', 0)) <= 0 or float(result.get('discount', 0)) != 0 or float(result.get('articleDiscount', 0)) != 0: raise ValueError('Invalid or discounted quote')
    if info: raise ValueError('Supplier returned configuration warning: ' + str(info))
    return {'supplierPriceEurNet': float(result['price']), 'basePriceEur': float(result['basePrice']), 'setupEur': float(result.get('articleOptions', {}).get('option08_jn', 0)), 'vatState': 'excluded', 'currency': 'EUR'}


def continuation_samples(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 100:
        raise ValueError('Continuation must contain 1-100 samples')
    for sample in value:
        if not isinstance(sample, list) or len(sample) != 3 or any(isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or n <= 0 for n in sample) or not float(sample[2]).is_integer():
            raise ValueError('Invalid continuation dimensions or count')
    return value


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--plan', default='output/gulvfolie-2026-09-30/presentation-plan.json'); parser.add_argument('--output', default='output/supplier-imports/wmd-gulvfolie-2026-09-30'); parser.add_argument('--probe', action='store_true'); parser.add_argument('--holdout', action='store_true')
    # Bounded continuation captures reuse the exact adapter and leave the original package intact.
    parser.add_argument('--samples', help='JSON file of [width cm, height cm, quantity] requests')
    parser.add_argument('--shapes', nargs='+', help='Exact plan shape IDs to capture')
    parser.add_argument('--materials', nargs='+', help='Exact plan material IDs to capture')
    args = parser.parse_args()
    plan_path = Path(args.plan).resolve(); plan = json.loads(plan_path.read_text()); root = Path(args.output).resolve()
    for folder in ['raw/pages', 'raw/quotes', 'documents/source', 'review']: (root/folder).mkdir(parents=True, exist_ok=True)
    jobs = {}
    if args.shapes and not set(args.shapes).issubset({s['id'] for s in plan['shapes']}):
        raise ValueError('Unknown continuation shape')
    if args.materials and not set(args.materials).issubset({m['id'] for m in plan['materials']}):
        raise ValueError('Unknown continuation material')
    for shape in plan['shapes']:
        if args.shapes and shape['id'] not in args.shapes: continue
        for binding in shape['bindings']:
            if args.materials and binding['materialId'] not in args.materials: continue
            url = bridge.validate_url(binding['sourceUrl'], HOSTS)
            jobs.setdefault(url, []).append({'shapeId': shape['id'], **binding})
    if len(jobs) > 68: raise ValueError('Product scope exceeds 68 confirmed pages')
    if args.probe: jobs = dict(list(jobs.items())[:1])
    if args.holdout: jobs = dict(list(jobs.items())[:2])
    bridge.check_robots(ENDPOINT, HOSTS, 30, 8*1024*1024)
    bridge.assert_public_dns('www.wir-machen-druck.de')
    rows, pages, errors, documents = [], [], [], []
    lock = threading.Lock()
    # Every variant gets first/middle/last quantity samples and separate size samples.
    samples = [(50,50,q) for q in [1,10,100,1000,10000]] + [(10,10,1),(100,100,1)]
    if args.holdout: samples = [(13,17,1),(37,61,1),(80,60,1)]
    if args.samples:
        samples = continuation_samples(json.loads(Path(args.samples).read_text()))
    def worker(job):
        url, bindings = job; session = requests.Session(impersonate='chrome')
        try:
            bridge.check_robots(url, HOSTS, 30, 8*1024*1024)
            response = session.get(url, timeout=30, allow_redirects=False)
            if response.status_code != 200 or len(response.content) > 8*1024*1024: raise ValueError('Source response refused')
            base, config = parse_inputs(response.text)
            source_ids = {v['id'] for v in config['variants']}
            if any(b['sourceOptionValue'] not in source_ids for b in bindings): raise ValueError('Source variants changed')
            key = urlsplit(url).path.strip('/').removesuffix('.html')
            # Tokens remain in memory only; preserve the rest of the source HTML.
            safe_html = re.sub(r'(<input[^>]*name="_token"[^>]*value=")[^"]*', r'\1[redacted]', response.text)
            (root/f'raw/pages/{key}.html').write_text(safe_html)
            from scrapling.parser import Selector
            doc = Selector(response.text)
            doc_urls = [u for u in bridge.safe_resource_urls(doc,url,'a::attr(href)',HOSTS) if '.pdf' in u.lower()]
            for u in doc_urls:
                bridge.assert_public_dns(urlsplit(u).hostname)
                pdf = session.get(u, timeout=30, allow_redirects=False)
                if pdf.status_code != 200 or not pdf.content.startswith(b'%PDF-') or len(pdf.content)>16*1024*1024: raise ValueError('Invalid PDF response')
                digest=hashlib.sha256(pdf.content).hexdigest(); file=f'documents/source/{digest}.pdf'; (root/file).write_bytes(pdf.content)
                with lock: documents.append({'sourceUrl':u,'productUrl':url,'path':file,'sha256':digest})
            with lock: pages.append({'url':url, **config, 'sourceSha256':hashlib.sha256(safe_html.encode()).hexdigest(), 'documentUrls':doc_urls})
            for binding in bindings:
                for width,height,quantity in samples:
                    if quantity>config['maximumQuantity']: continue
                    identity=f"{binding['shapeId']}--{binding['materialId']}--{binding['colourId']}--{width}x{height}--{quantity}"
                    file=root/f'raw/quotes/{identity}.json'
                    if file.exists():
                        previous=json.loads(file.read_text())
                        if previous.get('sourceUrl')==url and previous.get('sourceOptionValue')==binding['sourceOptionValue']:
                            with lock: rows.append(previous)
                            continue
                    body={**base,'quantity':str(quantity),'substrateId':binding['sourceOptionValue'],'width':str(width),'height':str(height)}
                    quote=session.post(ENDPOINT,json=body,timeout=30,allow_redirects=False)
                    if quote.status_code!=200 or len(quote.content)>2*1024*1024: raise ValueError('Quote HTTP refused')
                    data=quote.json()
                    try:
                        validated=validated_quote(data,width,height,quantity)
                        row={'sourceUrl':url,'sourceArticleId':base['articleId'],'sourceOptionValue':binding['sourceOptionValue'],'shapeId':binding['shapeId'],'materialId':binding['materialId'],'colourId':binding['colourId'],'widthCm':width,'heightCm':height,'quantity':quantity,'areaM2':width*height/10000,**validated,'request':redact(body),'response':redact(data)}
                        file.write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n')
                        with lock: rows.append(row)
                    except ValueError as error:
                        with lock: errors.append({'identity':identity,'sourceUrl':url,'reason':str(error),'response':redact(data)})
            print(f"Captured {key}",flush=True)
        except Exception as error:
            with lock: errors.append({'sourceUrl':url,'reason':str(error)})
        finally: session.close()
    with ThreadPoolExecutor(max_workers=2) as executor: list(executor.map(worker,jobs.items()))
    result={'schemaVersion':1,'capturedAt':datetime.now(timezone.utc).isoformat(),'planSha256':hashlib.sha256(plan_path.read_bytes()).hexdigest(),'scope':{'allowedHosts':sorted(HOSTS),'expectedPages':len(jobs),'expectedBindings':sum(map(len,jobs.values())),'probeOnly':args.probe},'samples':samples,'pages':sorted(pages,key=lambda x:x['url']),'rows':sorted(rows,key=lambda x:(x['shapeId'],x['materialId'],x['colourId'],x['widthCm'],x['heightCm'],x['quantity'])),'documents':sorted(documents,key=lambda x:x['productUrl']),'quarantined':errors,'writes':{'database':False,'storage':False,'pricing':False,'publishing':False}}
    (root/('raw/holdout-source.json' if args.holdout else 'raw/pricing-source.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pages':len(pages),'quotes':len(rows),'documents':len(documents),'quarantined':len(errors),'probeOnly':args.probe}))
    if errors: sys.exit(1)

if __name__=='__main__': main()
