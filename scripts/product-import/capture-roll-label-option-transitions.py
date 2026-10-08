"""Source-specific read-only continuation using the existing guarded WMD reader.

Keeps a separate checkpoint per exact article/material. Never edits originals,
contacts carts/accounts, converts prices, imports products, or publishes.
"""
import argparse,concurrent.futures,copy,hashlib,importlib.util,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'docs/roll-labels-2026-09-30'
OUT=ROOT/'output/supplier-imports/roll-labels-catalogue-2026-10-06/fresh-option-transitions'
spec=importlib.util.spec_from_file_location('existing_wmd_reader',SOURCE/'extract-prices-and-templates.py')
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)

def values(field):
    result=field.get('werte',{})
    return sorted(list(result.values()) if isinstance(result,dict) else result,key=lambda v:int(v.get('sort',0)))

def option_fields(response):
    fields=response.get('additionalFieldsData',{})
    return list(fields.values()) if isinstance(fields,dict) else fields

def capture(article):
    aid=article['supplier_article_id'];directory=OUT/'articles'/aid;directory.mkdir(parents=True,exist_ok=True)
    raw=api.request(article['source_url']);tree,selects,current=api.parse_page(raw)
    (directory/'page.html.gz').write_bytes(api.gzip.compress(raw));page_hash=hashlib.sha256(raw).hexdigest()
    current_materials={o['value'] for s in selects if s['name']=='sorten' for o in api.valid_options(s)}
    results=[]
    for filename in sorted((SOURCE/'extraction/articles'/aid).glob('[0-9]*.json')):
        saved=json.loads(filename.read_text());mid=saved['material']['value'];target=directory/(mid+'.json')
        if target.exists():results.append(json.loads(target.read_text()));continue
        fields=option_fields(api.response(saved['options_evidence']))
        if not any(str(f.get('id'))=='473' and any(str(v.get('id'))=='1682' for v in values(f)) for f in fields):continue
        record={'profileKey':aid+':'+mid,'sourceUrl':article['source_url'],'sourcePageSha256':page_hash,
            'sourceMaterialSha256':hashlib.sha256(filename.read_bytes()).hexdigest(),'capturedAt':api.stamp(),
            'status':'pending','quotes':[],'databaseWrites':False,'arbitrarySizeAcceptance':False,'DenmarkDeliveryVerified':False}
        try:
            if mid not in current_materials:raise ValueError('Material inventory changed')
            p=copy.deepcopy(saved['quotes'][0]['evidence']['request']);p['token']=current['token']
            p['additionalUpsells']['473']={'id':1682,'value':'per Maschine (76mm Hülse)'}
            options=api.api('get-options',p);record['optionsEvidence']=options
            fresh=api.response(options);previous=api.response(saved['options_evidence'])
            for key in ['grossdruck_width_min','grossdruck_width_max','grossdruck_height_min','grossdruck_height_max']:
                if str(fresh.get('article',{}).get(key))!=str(previous.get('article',{}).get(key)):raise ValueError('Size bounds changed: '+key)
            direction=next(f for f in option_fields(fresh) if str(f['id'])=='222')
            choices=values(direction)
            if not choices or any(str(v['id'])=='11293' for v in choices):raise ValueError('Machine direction not exact')
            for option in choices:
                request=copy.deepcopy(p);request['additionalUpsells']['222']={'id':int(option['id']),'value':option['bezeichnung']}
                evidence=api.api('get-price',request);quote=api.response(evidence)
                checks={'positive_eur':quote.get('currency')=='EUR' and float(quote.get('price',0))>0,
                    'quantity':int(quote.get('quantity',0))==int(request['quantity']),
                    'exact_options_echo':all(any(v.get('value')==selected['value'] for v in quote.get('additionalUpsells',{}).get(field,[])) for field,selected in request['additionalUpsells'].items())}
                if 'width' in request:checks['width']=float(quote.get('dimension',{}).get('width',0))==float(request['width'])
                if 'height' in request:checks['height']=float(quote.get('dimension',{}).get('height',0))==float(request['height'])
                record['quotes'].append({'checks':checks,'evidence':evidence,'status':'passed' if all(checks.values()) else 'quarantined'})
            record['status']='passed' if all(q['status']=='passed' for q in record['quotes']) else 'quarantined'
        except Exception as error:record.update(status='quarantined',error=str(error))
        api.save(target,record);results.append(record)
    summary={'articleId':aid,'profiles':len(results),'passed':sum(r['status']=='passed' for r in results),'quarantined':sum(r['status']!='passed' for r in results)}
    api.save(directory/'summary.json',summary);print(json.dumps(summary),flush=True)
    return summary

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--capture',action='store_true');parser.add_argument('--articles',nargs='+');args=parser.parse_args()
    catalogue=json.loads((SOURCE/'catalogue.normalized.json').read_text())
    candidates=[]
    for article in catalogue['articles']:
        if args.articles and article['supplier_article_id'] not in args.articles:continue
        for filename in (SOURCE/'extraction/articles'/article['supplier_article_id']).glob('[0-9]*.json'):
            material=json.loads(filename.read_text());fields=option_fields(api.response(material['options_evidence']))
            if any(str(f.get('id'))=='473' and any(str(v.get('id'))=='1682' for v in values(f)) for f in fields):
                candidates.append(article);break
    print(json.dumps({'articles':len(candidates),'networkEnabled':args.capture,'databaseWrites':False}),flush=True)
    if args.capture:
        OUT.mkdir(parents=True,exist_ok=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:summaries=list(pool.map(capture,candidates))
        api.save(OUT/'capture-summary.json',{'articles':summaries,'databaseWrites':False,'scope':'Exact 50x50 mm/reference-quantity manual-to-machine profiles only; not arbitrary-size pricing or order acceptance'})
