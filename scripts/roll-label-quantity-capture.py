"""Resume exact public configurator quotes through the existing guarded reader.

Writes only this continuation's local evidence. API request tokens are omitted
from the serialized request evidence; the public source page is archived intact.
Existing ledgers, imports, products and sealed observer evidence are immutable.
"""
import argparse, concurrent.futures, copy, glob, gzip, hashlib, importlib.util
import json, os, pathlib, sys, time

# Reuse the already installed, ABI-compatible supplier reader dependencies.
for dependency in ('curl_cffi', 'certifi', 'cffi', 'pycparser', 'lxml'):
    for location in glob.glob(str(pathlib.Path.home()/'.cache/uv/archive-v0/*'/dependency)):
        sys.path.insert(0, os.path.dirname(location))

ROOT = pathlib.Path.cwd()
OUT = ROOT/'output/qa/roll-labels-2026-10-07/quantity-integration-025'
spec = importlib.util.spec_from_file_location('guarded_wmd_reader', ROOT/'docs/roll-labels-2026-09-30/extract-prices-and-templates.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def identity(job):
    return digest(json.dumps(job, sort_keys=True, separators=(',', ':')).encode())

def endpoint(name, payload, target):
    raw = api.request(api.HOST+'/wmdrest/article/'+name, payload)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(raw)
    return {'captured_at': api.stamp(), 'endpoint': '/wmdrest/article/'+name,
            'request': {k:v for k,v in payload.items() if k != 'token'},
            'response': json.loads(raw), 'response_sha256': digest(raw),
            'rawPath': str(target.relative_to(ROOT))}

def capture_article(jobs):
    article = str(jobs[0]['request']['articleId'])
    directory = OUT/'capture'/article
    directory.mkdir(parents=True, exist_ok=True)
    fresh = api.request(jobs[0]['sourceUrl'])
    page_path = directory/('page-'+digest(fresh)+'.html.gz')
    if not page_path.exists():
        page_path.write_bytes(gzip.compress(fresh))
    tree, selects, page_request = api.parse_page(fresh)
    if str(page_request['articleId']) != article:
        raise ValueError('Fresh source article changed')
    materials = {o['value'] for s in selects if s['name']=='sorten' for o in api.valid_options(s)}
    ranges = tree.xpath('//input[@name="menge"]')
    prepared = set()
    passed = cached = failed = consecutive_failures = 0
    for job in jobs:
        key = identity(job)
        record_path = directory/'quotes'/(key+'.json')
        if record_path.exists():
            prior = json.loads(record_path.read_text())
            if prior.get('job') != job:
                raise ValueError('Saved job identity changed')
            if prior.get('status') == 'passed':
                evidence = prior['evidence']
                if digest((ROOT/evidence['rawPath']).read_bytes()) != evidence['response_sha256']:
                    raise ValueError('Saved quote bytes changed')
                cached += 1
                continue
        p = copy.deepcopy(job['request'])
        p['token'] = page_request['token']
        record = {'job':job, 'sourcePageSha256':digest(fresh),
                  'sourcePagePath':str(page_path.relative_to(ROOT)), 'status':'pending'}
        try:
            if str(p['substrateId']) not in materials:
                raise ValueError('Material no longer present on public source page')
            quantity = job['selection']['quantity']
            if job['mode'] == 'range':
                if len(ranges) != 1 or not int(ranges[0].get('min','1')) <= quantity <= int(ranges[0].get('max','0')):
                    raise ValueError('Quantity outside fresh native rule')
            context = digest(json.dumps({k:v for k,v in job['request'].items() if k not in ('quantity','priceScaleId')}, sort_keys=True).encode())
            if context not in prepared:
                options = endpoint('get-options',p,directory/'options'/(context+'.json'))
                api.response(options)
                api.save(directory/'options'/(context+'-evidence.json'),options)
                prepared.add(context)
            evidence = endpoint('get-price',p,directory/'raw'/(key+'.json'))
            q = api.response(evidence)
            checks = {'positive_eur':q.get('currency')=='EUR' and float(q.get('price',0))>0,
                      'exact_quantity':int(q.get('quantity',0))==quantity,
                      'exact_options':all(any(v.get('value')==selected['value'] for v in q.get('additionalUpsells',{}).get(field,[]))
                          for field,selected in p['additionalUpsells'].items())}
            for dimension in ('width','height'):
                if dimension in p:
                    checks['exact_'+dimension] = float(q.get('dimension',{}).get(dimension,0)) == float(p[dimension])
            if not all(checks.values()):
                raise ValueError('Quote did not echo exact quantity/dimensions/options: '+json.dumps(checks))
            record.update(status='passed',checks=checks,evidence=evidence)
            passed += 1
            consecutive_failures = 0
        except Exception as error:
            record.update(status='quarantined',error=str(error))
            failed += 1
            consecutive_failures += 1
        api.save(record_path,record)
        if (passed+failed)%20 == 0 or record['status']!='passed':
            print(json.dumps({'article':article,'passed':passed,'cached':cached,'quarantined':failed,'of':len(jobs)}),flush=True)
        if consecutive_failures >= 3:
            raise ValueError('Three consecutive supplier failures; capture stopped for '+article)
        time.sleep(0.3)
    return {'article':article,'passed':passed,'cached':cached,'quarantined':failed,'jobs':len(jobs)}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--family', required=True)
    args = parser.parse_args()
    jobs = [json.loads(line) for line in (OUT/'quote-jobs.jsonl').read_text().splitlines() if line]
    jobs = [job for job in jobs if job['familyId']==args.family]
    groups = {}
    for job in jobs:
        groups.setdefault(str(job['request']['articleId']),[]).append(job)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for result in pool.map(capture_article,groups.values()):
            results.append(result)
    report = OUT/('capture-family-'+args.family+'.json')
    if report.exists():
        report = OUT/('capture-resume-'+args.family+'-'+str(time.time_ns())+'.json')
    api.save(report,{'familyId':args.family,'results':results,
             'readOnlySupplier':True,'remoteWrites':False,'fullCatalogueComplete':False})
    print(json.dumps(results),flush=True)
