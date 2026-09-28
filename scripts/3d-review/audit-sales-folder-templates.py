import importlib.util,json,hashlib,collections
import sys
from shapely.affinity import scale
s=importlib.util.spec_from_file_location('b','scripts/3d-review/build-sales-folder-models.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
cache={};rows=[];errors=[]
for t in b.PLAN['tickets']:
 if t['family']!='Sales folders' or t['id']=='SF-5f824dd572':continue
 for v in t['templates']:
  h=v['templatePdfSha256'];path=b.INDEX[h];raw=b.Path(path).read_bytes();assert hashlib.sha256(raw).hexdigest()==h
  doc=b.fitz.open(path)
  assert len(doc)==v['pageCount']==2, f'{t["id"]}: unexpected template page count'
  for page in doc:
   assert abs(page.rect.width*b.MM-v['widthMm'])<.15 and abs(page.rect.height*b.MM-v['heightMm'])<.15, f'{t["id"]}: catalogue dimensions differ'
  cut,fold=b.extract(doc[0]);sig=hashlib.sha256(json.dumps([cut,fold]).encode()).hexdigest()
  if sig not in cache:
   try:geo,stats,body=b.model_geometry(cut,fold);cache[sig]=(geo,stats,body)
   except Exception as e:errors.append([t['queueNumber'],h,str(e)]);continue
  geo,stats,body=cache[sig];w,hmm=doc[0].rect.width*b.MM,doc[0].rect.height*b.MM
  item=dict(ticket=t['id'],queue=t['queueNumber'],title=t['title'],hash=h,signature=sig,width=w,height=hmm,pages=2 if t['title'].endswith('4+4') else 1,bleed=v['bleedMm'],url=v['url'],mode=v['artworkMode'],name=v['name'])
  if item['pages']==2:
   try:
    cut2,fold2=b.extract(doc[1]);inside,slits,bridges=b.join_paths(cut2)
    candidates={key:scale(body,xfact=x,yfact=y,origin=(w/2,hmm/2)).hausdorff_distance(inside) for key,x,y in [('mirror-x',-1,1),('mirror-y',1,-1),('identity',1,1),('rotate-180',-1,-1)]}
    item['insideTransform']='mirror-x';item['insideDelta']=candidates['mirror-x'];item['insideCandidates']=candidates
    assert candidates['mirror-x'] < 1.5, f'Inside contour differs by {candidates}'
   except Exception as e:item['insideError']=str(e)
  rows.append(item)
 print(t['queueNumber'],len(cache),flush=True)
(b.OUT/'template-audit.json').write_text(json.dumps(dict(rows=rows,errors=errors,geometries={k:dict(geometry=v[0],stats=v[1]) for k,v in cache.items()}),ensure_ascii=False))
print('rows',len(rows),'geometries',len(cache),'errors',errors)
print('inside',collections.Counter(r.get('insideTransform',r.get('insideError')) for r in rows if r['pages']==2))
print('deltas',sorted({round(r['insideDelta'],3) for r in rows if 'insideDelta' in r}))
