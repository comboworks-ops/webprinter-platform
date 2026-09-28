#!/usr/bin/env python3
import json,re,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'output/3d-review-queue/sales-folder-batch'
a=json.loads((OUT/'template-audit.json').read_text());assert not a['errors'];assert len(a['rows'])==1420
legacy=json.loads((OUT/'legacy-inspection.json').read_text())
a['geometries']['legacy']={'geometry':legacy['geometry'],'stats':legacy['stats']}
a['rows'].append(dict(signature='legacy',hash=legacy['hash'],width=legacy['width'],height=legacy['height'],bleed=5,title='A4 · ældre skabelon · 5 mm ryg · 4+0',pages=1,ticket='SF-5f824dd572',mode='review_only',name='Ældre A4-skabelon · 5 mm ryg · Eksisterende PDF',url='https://ziattmsmiirfweiuunfo.supabase.co/storage/v1/object/public/product-templates/templates/acac7c01-2f7c-41d4-86bd-b461ed31b53e-template-1775864184259.pdf'))
geometries=[];keys=list(a['geometries'])
for sig in keys:
 geo=copy.deepcopy(a['geometries'][sig]['geometry']);panels=geo['panels'];byid={p['id']:p for p in panels};root=panels[0];row=next(r for r in a['rows'] if r['signature']==sig)
 large=[p for p in panels if p['area']>root['area']*.65]
 closure='lukning' in row['title'];triple='3-delt' in row['title'];last=6 if triple else 4
 centre=lambda p:[sum(n[k] for n in p['outline'])/len(p['outline']) for k in [0,1]]
 cover=min((p for p in large if p is not root),key=lambda p:centre(p)[1]) if closure else max((p for p in large if p is not root),key=lambda p:centre(p)[0])
 root['pageOutside']=last;root['pageInside']=3;cover['pageOutside']=1;cover['pageInside']=2
 if closure:cover['outsideRotation']=180
 if triple:
  for p in large:
   if p is not root and p is not cover:p['pageOutside']=5;p['pageInside']=4
 # Classify each physical branch by its final large face/flap. Paired gusset
 # hinges share the branch's timing, so capacity survives every animation frame.
 for p in panels:
  branch=p
  while branch['parent'] and branch['parent']!=root['id']:branch=byid[branch['parent']]
  descendants=[]
  for pp in panels:
   cur=pp
   while cur['parent'] and cur['id']!=branch['id']:cur=byid[cur['parent']]
   if cur['id']==branch['id']:descendants.append(pp)
  has_cover=cover in descendants
  has_page=any(pp in large for pp in descendants)
  bc=centre(max(descendants,key=lambda pp:pp['area']));rc=geo['centre']
  phase=[0,40] if has_cover else [40,65] if has_page else [45,70] if bc[1]>rc[1]+20 else [65,85] if bc[1]<rc[1]-20 else [70,100]
  # Tongue insertion/flex isn't simulated; the small tongue stays attached to
  # its flap, and the real crease remains in the evidence geometry.
  if p['axis']=='diagonal':p['angle']=0
  p['phase']=phase
  p['layer']=0
  if p['parent']==root['id']:
   xs=[v[0] for v in p['outline']];ys=[v[1] for v in p['outline']]
   paired=min(max(xs)-min(xs),max(ys)-min(ys))<15
   side_branch=phase==[70,100]
   p['layer']=(0 if has_cover else .20 if side_branch else -.13) if paired else (-2 if has_cover else -.55 if side_branch else -1.1)
  p.pop('axis',None)
  for field in ['outline','holes','cuts']:
   def rnd(x):return [rnd(n) for n in x] if isinstance(x,list) else round(x,3)
   p[field]=rnd(p[field])
  p['area']=round(p['area'],3)
 geometries.append(geo)
rows=[]
for r in a['rows']:
 assert not r.get('insideError'),r
 rows.append(dict(geometry=keys.index(r['signature']),id=r['hash'][:12],hash=r['hash'],width=round(r['width'],3),height=round(r['height'],3),bleed=r['bleed'],spine=int(re.search(r'(\d+) mm ryg',r['title']).group(1)),label=r['title'],pages=r['pages'],url=r['url'],ticket=r['ticket'],mode=r['mode'],readerPages=6 if '3-delt' in r['title'] else 4,variantLabel=r['name'].split(' mm ryg · ')[-1],templatePageCount=1 if r['mode']=='review_only' else 2))
# Separate compact geometry and exact identity data, so finish aliases do not
# duplicate thousands of contour vertices in the shipped app.
source="// Generated from hash-verified PDF vector paths. See scripts/3d-review/.\nimport type { SalesFolderModel, SalesFolderDefinition } from './salesFolderDefinition.ts';\n"
source+='const geometries = '+json.dumps(geometries,ensure_ascii=False,separators=(',',':'))+" as unknown as Pick<SalesFolderDefinition, 'panels' | 'centre'>[];\n"
# URLs share a fixed storage prefix; retain full URLs on runtime models.
prefix=rows[0]['url'].rsplit('/',1)[0]+'/'
assert all(r['url']==prefix+r['hash']+'.pdf' for r in rows if r['mode']!='review_only')
legacyUrl=rows[-1]['url']
for r in rows:r.pop('url')
source+='const variants = '+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n'
source+=f"const storage = {json.dumps(prefix)};\nconst legacyUrl = {json.dumps(legacyUrl)};\n"
source+="""export const SALES_FOLDER_MODELS: SalesFolderModel[] = variants.map(v => ({
  kind: 'sales-folder', label: v.label, pages: v.pages as 1 | 2, ticket: v.ticket,
  templateUrl: v.mode === 'review_only' ? legacyUrl : storage + v.hash + '.pdf', artworkMode: v.mode, variantLabel: v.variantLabel, templatePageCount: v.templatePageCount,
  definition: { ...geometries[v.geometry], id: 'sales-folder-' + v.id + '-r1', templateHash: v.hash,
    sheetWidthMm: v.width, sheetHeightMm: v.height, bleedMm: v.bleed, nominalSpineMm: v.spine,
    displayThicknessMm: .3, insideTransform: 'mirror-x', readerPages: v.readerPages },
}));
"""
(ROOT/'src/lib/mockup/salesFolderModels.generated.ts').write_text(source)
print(len(geometries),'geometries;',len(rows),'exact templates;',len(source),'source bytes')
