"""Apply only the independently reviewed35 geometry deltas to local projections."""
import copy,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'output/supplier-imports/roll-labels-catalogue-2026-10-06'
OUT=ROOT/'output/qa/roll-labels-2026-10-06/root-motif-rectangle-geometry-048'
PROOF=ROOT/'output/qa/roll-labels-2026-10-06/predecessor006-motif-rectangle-rule-review-052'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(PROOF/'source-rule-proposals.json')=='d645bc4d10a1388a4349ce8ccac9603bca509dce290edbc9d9970df9d00a7751'
assert sha(PROOF/'independent-readback.json')=='5c69fe65b59814f6ce79c08cac55aff3bd98ae9d33579297c50dfca2e1857360'
proof=json.loads((PROOF/'source-rule-proposals.json').read_text());rows={r['profileKey']:r for r in proof['proposals']}
assert len(rows)==35
for record in proof['sourceInputs']:assert sha(ROOT/record['path'])==record['sha256'],record['path']
protected={
 'import-review/proposed-exact-prices.jsonl':'645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a',
 'dimension-documents/exact-size-bindings.jsonl':'2692827bb169f0e25cb224a072c3a2228953e8b42196fd99a3c29fd1ef9310cb',
 'source-cut-contour-contracts.json':'519e99ed8dc4a4aae1f6d0ff6f5526bdf4c09de325f0c976a01cea26aa6eb165'}
def protect():
 for p,s in protected.items():assert sha(BASE/p)==s,p
protect()
paths=['review/families/32553.json','import-review/product-draft-plans.json','source-size-geometry-contracts.json']
updates=[]
for relative in paths:
 path=BASE/relative;before_bytes=path.read_bytes();before=json.loads(before_bytes);after=copy.deepcopy(before)
 if relative=='source-size-geometry-contracts.json':
  changed=[]
  for p in after['profiles']:
   if p['profileKey'] in rows:
    r=rows[p['profileKey']];assert p['contract'] is None and p['status']=='source_geometry_pending'
    assert p['sourceEvidenceSha256']==r['sourceEvidenceSha256']
    assert p['blockers']==['Source PDF does not echo the selected primitive shape']
    p.update(status='primitive_size_geometry_documented',contract=r['contract'],blockers=[]);changed.append(p['profileKey'])
  after['counts']['primitive_size_geometry_documented']+=35;after['counts']['source_geometry_pending']-=35
  restored=copy.deepcopy(after);old={p['profileKey']:p for p in before['profiles']}
  restored['profiles']=[old[p['profileKey']] if p['profileKey'] in rows else p for p in restored['profiles']];restored['counts']=before['counts']
 else:
  get=lambda v:v['profiles'] if relative.startswith('review/') else next(f for f in v['families'] if f['familyId']=='32553')['pricingStructure']['rollLabelConfiguration']['profiles']
  changed=[]
  for p in get(after):
   if p['key'] in rows:
    r=rows[p['key']];assert p['sizeGeometry'] is None and p['sourceEvidenceSha256']==r['sourceEvidenceSha256']
    assert [s['id'] for s in p['optionStates']['states']]==r['optionStateIds']
    c=copy.deepcopy(r['contract']);c['evidence']=[{k:e[k] for k in ('role','sha256','textSha256')} for e in c['evidence']]
    p['sizeGeometry']=c;changed.append(p['key'])
  restored=copy.deepcopy(after)
  for p in get(restored):
   if p['key'] in rows:p['sizeGeometry']=None
 assert len(changed)==35 and set(changed)==set(rows);assert restored==before,'Unreviewed projection mutation'
 backup=OUT/'before-artifacts'/relative;backup.parent.mkdir(parents=True,exist_ok=True)
 with backup.open('xb') as f:f.write(before_bytes)
 updates.append((path,relative,before_bytes,after))
changes=[]
for path,relative,before_bytes,after in updates:
 path.write_text(json.dumps(after,ensure_ascii=False,indent=2)+'\n')
 changes.append({'path':str(path.relative_to(ROOT)),'beforeSha256':hashlib.sha256(before_bytes).hexdigest(),'afterSha256':sha(path),'profilesChanged':35})
protect();OUT.mkdir(parents=True,exist_ok=True)
with (OUT/'geometry-preparation.json').open('x') as f:
 json.dump({'profiles':35,'changes':changes,'protectedArtifacts':[{'path':str((BASE/p).relative_to(ROOT)),'sha256':s} for p,s in protected.items()],
  'onlyReviewedGeometryChanged':True,'pricesChanged':False,'optionStatesChanged':False,'inputModelChanged':False,'remoteWrites':False,'orderReady':False,'fullGoalComplete':False},f,indent=2);f.write('\n')
print(json.dumps({'profiles':35,'changedFiles':len(changes),'registryDocumented':547,'orderReady':False}))
