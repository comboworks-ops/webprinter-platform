#!/usr/bin/env python3
"""Read hash-pinned local template PDFs and generate presentation-only fold geometry.
Requires PyMuPDF and Shapely; writes local source/evidence, never catalogue data.
"""
import sys,json,math,hashlib,re
from pathlib import Path
import pymupdf as fitz
from shapely.geometry import LineString,Polygon,Point,MultiLineString
from shapely.ops import unary_union,polygonize,nearest_points
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/3d-review-queue/sales-folder-batch'
INDEX=json.loads((OUT/'local-template-index.json').read_text())
PLAN=json.loads((ROOT/'docs/3d-review/plan.json').read_text())
MM=25.4/72

def dist(a,b):return math.dist(a,b)
def xy(p):return [round(p[0]*MM,4),round(p[1]*MM,4)]
def paths(d):
 out=[];pts=[]
 for i in d['items']:
  op=i[0]
  if op=='re':
   r=i[1];out.append([xy(p) for p in [r.tl,r.tr,r.br,r.bl,r.tl]]);continue
  if op not in ('l','c','qu'):raise ValueError(op)
  if op=='qu':
   q=i[1];out.append([xy(p) for p in [q.ul,q.ur,q.lr,q.ll,q.ul]]);continue
  a=xy(i[1])
  if pts and dist(pts[-1],a)>.02:out.append(pts);pts=[]
  if not pts:pts=[a]
  if op=='l':pts.append(xy(i[2]))
  if op=='c':
   a,b,c,e=[xy(p) for p in i[1:]]
   for n in range(1,13):
    t=n/12;s=1-t;pts.append([round(s**3*a[k]+3*s*s*t*b[k]+3*s*t*t*c[k]+t**3*e[k],4) for k in (0,1)])
 if pts:
  if d['closePath'] and dist(pts[0],pts[-1])>.001:pts.append(pts[0])
  out.append(pts)
 return [p for p in out if len(p)>1 and LineString(p).length>.01]

def extract(page):
 cuts=[];folds=[]
 for d in page.get_drawings():
  layer=d.get('layer','');color=d.get('color')
  if layer in ('Beskæring og stans','Udfald og sikkerhedsafstand') and color and color[0]>.7 and color[1]<.1:cuts+=paths(d)
  if layer=='Falselinjer':folds+=paths(d)
 return cuts,folds

def join_paths(paths):
 paths=[p[:] for p in paths];bridges=[]
 while True:
  best=None
  for i,a in enumerate(paths):
   if dist(a[0],a[-1])<.025:continue
   for j in range(i+1,len(paths)):
    b=paths[j]
    if dist(b[0],b[-1])<.025:continue
    for ai in [0,-1]:
     for bi in [0,-1]:
      dd=dist(a[ai],b[bi])
      if dd<4.2 and (best is None or dd<best[0]):best=(dd,i,j,ai,bi)
  if best is None:break
  dd,i,j,ai,bi=best;a=paths[i];b=paths[j]
  if ai==0:a=a[::-1]
  if bi==-1:b=b[::-1]
  bridges.append(dd);paths[i]=a+b;paths.pop(j)
 # Main diecut and windows close across intentional scissor gaps, slits stay open.
 closed=[];slits=[]
 for p in paths:
  if dist(p[0],p[-1])<4.2 and Polygon(p).area>25:
   poly=Polygon(p).buffer(0)
   if poly.geom_type=='Polygon':closed.append(poly)
   else:closed.extend(poly.geoms)
  else:slits.append(p)
 if not closed:raise ValueError('No closed diecut contour')
 closed.sort(key=lambda p:p.area,reverse=True);body=closed[0]
 for hole in closed[1:]:
  if body.contains(hole.representative_point()):body=body.difference(hole)
  else:raise ValueError('Disconnected cut contour')
 return body,slits,bridges

def model_geometry(cuts,folds):
 body,slits,bridges=join_paths(cuts)
 # Extend each crease only to a nearby measured boundary/other crease, never
 # across an unrelated panel. Some source creases stop 1 mm short of a cut.
 lines=[LineString(p) for p in folds]
 ext=[]
 for i,line in enumerate(lines):
  coords=list(line.coords);a,b=coords[0],coords[-1]
  # Diagonal tongue creases are retained as arbitrary-axis hinges.
  others=unary_union([body.boundary]+[l for j,l in enumerate(lines) if j!=i])
  for end,other in [(0,b),(-1,a)]:
   pt=coords[end];dx=pt[0]-other[0];dy=pt[1]-other[1];norm=math.hypot(dx,dy)
   ray=LineString([pt,(pt[0]+dx/norm*1.6,pt[1]+dy/norm*1.6)])
   hit=ray.intersection(others)
   if not hit.is_empty:
    target=nearest_points(Point(pt),hit)[1];coords[end]=[target.x+dx/norm*.035,target.y+dy/norm*.035]
   elif Point(pt).distance(others)<.15:
    target=nearest_points(Point(pt),others)[1];coords[end]=[target.x+dx/norm*.035,target.y+dy/norm*.035]
  ext.append(LineString(coords))
 # A tiny quantization removes float differences at line intersections.
 from shapely import set_precision
 mesh=unary_union([set_precision(body.boundary,.005)]+[set_precision(l,.005) for l in ext])
 faces=[p for p in polygonize(mesh) if p.area>.15 and body.buffer(.01).covers(p.representative_point())]
 if abs(sum(p.area for p in faces)-body.area)>max(1,body.area*.0002):raise ValueError('Diecut partition area mismatch')
 # Each crease must separate two faces, including real narrow gussets.
 edges=[]
 for i,a in enumerate(faces):
  for j in range(i+1,len(faces)):
   b=faces[j];common=a.boundary.intersection(b.boundary)
   if common.length<2:continue
   coords=list(max(list(common.geoms),key=lambda g:g.length).coords) if common.geom_type=='MultiLineString' else list(common.coords)
   start,end=coords[0],coords[-1]
   # Retain diagonal tongue hinges too.
   if not any(common.intersection(l.buffer(.02)).length>common.length*.8 for l in ext):continue
   edges.append((i,j,start,end))
 # Root is the large panel with the most attached branches. This identifies
 # the folder back (central panel); ties choose the left page on plain folders.
 degree={i:sum(i in e[:2] for e in edges) for i in range(len(faces))}
 large=[i for i,p in enumerate(faces) if p.area>max(p.area for p in faces)*.65]
 root=max(large,key=lambda i:(degree[i],-faces[i].centroid.x))
 parents={root:None};order=[root];hinges={};
 for i in order:
  for a,b,start,end in edges:
   j=b if a==i else a if b==i else None
   if j is None or j in parents:continue
   parents[j]=i;order.append(j);hinges[j]=(start,end)
 if len(order)!=len(faces):raise ValueError(f'Disconnected fold tree: {len(order)}/{len(faces)} faces')
 if len(edges)!=len(faces)-1:raise ValueError('Cyclic fold tree')
 panels=[]
 for i in order:
  p=faces[i];parent=parents[i];start,end=hinges.get(i,((p.bounds[0],p.bounds[1]),(p.bounds[0],p.bounds[3])))
  axis='y' if abs(start[0]-end[0])<.5 else 'x' if abs(start[1]-end[1])<.5 else 'diagonal'
  hinge=[start[0],min(start[1],end[1])] if axis=='y' else [min(start[0],end[0]),start[1]]
  side=p.centroid.x-hinge[0] if axis=='y' else p.centroid.y-hinge[1]
  cross=(end[0]-start[0])*(-p.centroid.y+start[1])-(-end[1]+start[1])*(p.centroid.x-start[0]);sign=-1 if cross>0 else 1
  narrow=min(p.bounds[2]-p.bounds[0],p.bounds[3]-p.bounds[1])<15
  parent_narrow=parent is not None and min(faces[parent].bounds[2]-faces[parent].bounds[0],faces[parent].bounds[3]-faces[parent].bounds[1])<15
  panels.append(dict(id=f'p{i}',parent=f'p{parent}' if parent is not None else None,hinge=list(start),axis=axis,hingeEnd=list(end),
   angle=0 if parent is None else sign*(math.pi/2 if narrow or parent_narrow else math.pi),
   outline=[list(c) for c in p.exterior.coords][:-1],holes=[[list(c) for c in r.coords][:-1] for r in p.interiors],
   cuts=[s for s in slits if p.buffer(.1).covers(LineString(s).representative_point())],area=p.area))
 return dict(panels=panels,centre=[faces[root].centroid.x,faces[root].centroid.y]),dict(area=body.area,faces=len(faces),folds=len(folds),bridges=len(bridges),maxBridge=max(bridges,default=0)),body

def main():
 reps=[t for t in PLAN['tickets'] if t['family']=='Sales folders' and t['id']!='SF-5f824dd572' and t['title'].endswith('4+0')]
 results=[]
 for t in reps:
  v=next(v for v in t['templates'] if 'Ingen efterbehandling' in v['name']);doc=fitz.open(INDEX[v['templatePdfSha256']]);cuts,folds=extract(doc[0])
  try:
   geo,stats,body=model_geometry(cuts,folds);result=dict(ticket=t['id'],queue=t['queueNumber'],title=t['title'],**stats,geometry=geo)
  except Exception as e:result=dict(queue=t['queueNumber'],title=t['title'],error=str(e))
  results.append(result);print(result['queue'],result.get('faces'),result.get('error',''),flush=True)
 (OUT/'geometry-extraction.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
