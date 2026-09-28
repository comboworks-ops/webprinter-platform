import importlib.util,json,hashlib
s=importlib.util.spec_from_file_location('b','scripts/3d-review/build-sales-folder-models.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
path=b.OUT/'legacy-template.pdf'
assert hashlib.sha256(path.read_bytes()).hexdigest()=='6bb307f051fb3f39c96e21e959b795cd4b449544244e4c1e2ae75af941a03abe', 'Legacy PDF bytes changed'
doc=b.fitz.open(path);cuts=[];folds=[]
for d in doc[0].get_drawings():
 c=d.get('color')
 if c and c[0]>.8 and c[1]<.1:cuts+=b.paths(d)
 if c and c[0]<.1 and c[1]>.5:folds+=b.paths(d)
geo,stats,body=b.model_geometry(cuts,folds)
print(stats);print('creases',folds)
(b.OUT/'legacy-inspection.json').write_text(json.dumps(dict(hash=hashlib.sha256(path.read_bytes()).hexdigest(),width=doc[0].rect.width*b.MM,height=doc[0].rect.height*b.MM,geometry=geo,stats=stats,folds=folds),indent=2))
