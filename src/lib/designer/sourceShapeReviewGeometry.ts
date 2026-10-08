/** Offline example geometry only. No production path, offset, template or
 * source-scale authority is returned. Native points and distinct loops survive. */
export type ShapePoint = readonly [number, number];
export type SourceShapeSegment = { operator: 'l' | 'c'; pointsPt: ShapePoint[] };
const positive = (n: number) => Number.isFinite(n) && n > 0;
const distance = (a: ShapePoint, b: ShapePoint) => Math.hypot(a[0]-b[0], a[1]-b[1]);
const same = (a: ShapePoint, b: ShapePoint) => a[0] === b[0] && a[1] === b[1];
const mix = (a: ShapePoint, b: ShapePoint): ShapePoint => [(a[0]+b[0])/2,(a[1]+b[1])/2];
const sub = (a: ShapePoint, b: ShapePoint): ShapePoint => [a[0]-b[0],a[1]-b[1]];
const cross = (a: ShapePoint, b: ShapePoint) => a[0]*b[1]-a[1]*b[0];

export function assertSourceShapeSegments(value: unknown): asserts value is SourceShapeSegment[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 512) throw Error('Invalid native segment budget');
  for (const s of value) {
    if (!s || !['l','c'].includes(s.operator) || !Array.isArray(s.pointsPt)
      || s.pointsPt.length !== (s.operator === 'c' ? 4 : 2)
      || s.pointsPt.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n)>1e6))) {
      throw Error('Unsupported native curve');
    }
  }
}
export function sourceShapeContinuity(value: SourceShapeSegment[]) {
  assertSourceShapeSegments(value);
  return {closed:same(value[0].pointsPt[0],value.at(-1)!.pointsPt.at(-1)!),
    gaps:value.slice(1).map((s,i)=>distance(value[i].pointsPt.at(-1)!,s.pointsPt[0]))};
}
export function assertSourceShapePath(value: unknown): asserts value is SourceShapeSegment[] {
  assertSourceShapeSegments(value);
  for (let i=0;i<value.length;i++) {
    const end=value[i].pointsPt.at(-1)!, start=value[(i+1)%value.length].pointsPt[0];
    // No snapping, implicit closing line or tolerance-based shape repair.
    if (!same(end,start)) throw Error('Native curve is open or disconnected');
  }
}

function coefficients(points: ShapePoint[], axis: number) {
  const p=points.map(p=>p[axis]);
  return p.length===2 ? [p[0],p[1]-p[0]] : [p[0],3*(p[1]-p[0]),3*(p[2]-2*p[1]+p[0]),p[3]-3*p[2]+3*p[1]-p[0]];
}
const evaluate = (c: number[], t: number) => c.reduceRight((v,n)=>v*t+n,0);
function extrema(c: number[]) {
  if (c.length===2) return [0,1];
  const a=3*c[3],b=2*c[2],d=c[1],roots:number[]=[];
  if (Math.abs(a)<1e-14) { if(Math.abs(b)>1e-14) roots.push(-d/b); }
  else {
    const discriminant=b*b-4*a*d;
    if(discriminant>=0) {
      const q=-0.5*(b+(b>=0 ? 1:-1)*Math.sqrt(discriminant));
      if(q===0) roots.push(-b/(2*a)); else roots.push(q/a,d/q);
    }
  }
  return [0,1,...roots.filter(t=>t>0&&t<1)];
}
/** Polynomial extrema and Green integral, not the Bezier control hull. */
export function sourceShapeMetrics(path: SourceShapeSegment[]) {
  assertSourceShapePath(path);
  let xMin=Infinity,yMin=Infinity,xMax=-Infinity,yMax=-Infinity,area=0;
  for(const s of path) {
    const x=coefficients(s.pointsPt,0),y=coefficients(s.pointsPt,1);
    const xs=extrema(x).map(t=>evaluate(x,t)),ys=extrema(y).map(t=>evaluate(y,t));
    xMin=Math.min(xMin,...xs);xMax=Math.max(xMax,...xs);yMin=Math.min(yMin,...ys);yMax=Math.max(yMax,...ys);
    for(let i=0;i<x.length;i++) for(let j=1;j<y.length;j++) area+=(x[i]*j*y[j]-y[i]*j*x[j])/(i+j)/2;
  }
  if(!positive(xMax-xMin)||!positive(yMax-yMin)) throw Error('Collapsed native curve bounds');
  return { bounds:[xMin,yMin,xMax,yMax] as const, signedArea:area,
    winding:area>0 ? 'positive' as const : area<0 ? 'negative' as const : 'zero' as const };
}

export function transformSourceShape(path:SourceShapeSegment[],bounds:readonly number[],widthMm:number,heightMm:number,paddingMm=0):SourceShapeSegment[] {
  assertSourceShapePath(path);
  if(bounds.length!==4 || !bounds.every(Number.isFinite) || ![widthMm,heightMm].every(positive)
    || Math.max(widthMm,heightMm)>10000 || !Number.isFinite(paddingMm) || paddingMm<0
    || !positive(bounds[2]-bounds[0]) || !positive(bounds[3]-bounds[1])) throw Error('Invalid hypothetical affine dimensions');
  return path.map(s=>({operator:s.operator,pointsPt:s.pointsPt.map(([x,y])=>[
    paddingMm+(x-bounds[0])*widthMm/(bounds[2]-bounds[0]),paddingMm+(y-bounds[1])*heightMm/(bounds[3]-bounds[1])])}));
}

function pointSegmentDistance(p:ShapePoint,a:ShapePoint,b:ShapePoint) {
  const v=sub(b,a),w=sub(p,a),length=v[0]**2+v[1]**2;
  const t=length ? Math.max(0,Math.min(1,(v[0]*w[0]+v[1]*w[1])/length)):0;
  return distance(p,[a[0]+t*v[0],a[1]+t*v[1]]);
}
/** De Casteljau leaves have every control point in the closed chord capsule.
 * Convex-hull containment bounds curve-to-chord distance. Continuous projection
 * between endpoints bounds chord-to-curve distance by the same budget.
 * This bounds flattening, not topology, curvature, or source scale semantics. */
export function flattenSourceShape(path:SourceShapeSegment[],errorMm=0.01) {
  assertSourceShapePath(path);
  if(!positive(errorMm)||errorMm>0.05||errorMm<1e-5) throw Error('Invalid curve review tolerance');
  const points:ShapePoint[]=[path[0].pointsPt[0]];
  const append=(p:ShapePoint[])=>{
    if(points.length>=16384) throw Error('Curve review exceeds segment budget');
    points.push(p.at(-1)!);
  };
  const visit=(p:ShapePoint[],depth:number)=>{
    if(p.length===2 || p.slice(1,-1).every(q=>pointSegmentDistance(q,p[0],p.at(-1)!)<=errorMm/2)) {append(p);return;}
    if(depth>=24) throw Error('Curve subdivision unresolved');
    const a=mix(p[0],p[1]),b=mix(p[1],p[2]),c=mix(p[2],p[3]),d=mix(a,b),e=mix(b,c),f=mix(d,e);
    visit([p[0],a,d,f],depth+1);visit([f,e,c,p[3]],depth+1);
  };
  path.forEach(s=>visit(s.pointsPt,0));
  return {points,maxErrorMm:errorMm,segmentCount:points.length-1};
}

function derivatives(s:SourceShapeSegment,t:number) {
  const x=coefficients(s.pointsPt,0),y=coefficients(s.pointsPt,1);
  const derivative=(c:number[])=>c.slice(1).map((n,i)=>(i+1)*n);
  const dx=derivative(x),dy=derivative(y);
  return {point:[evaluate(x,t),evaluate(y,t)] as ShapePoint,
    first:[evaluate(dx,t),evaluate(dy,t)] as ShapePoint,
    second:[evaluate(derivative(dx),t),evaluate(derivative(dy),t)] as ShapePoint};
}
function tangent(s:SourceShapeSegment,atEnd:boolean) {
  const p=atEnd ? [...s.pointsPt].reverse():s.pointsPt;
  for(const q of p.slice(1)) {const v=atEnd ? sub(p[0],q):sub(q,p[0]);if(Math.hypot(...v)>1e-10)return v;}
  return null;
}

export function reviewSourceShapeAtSize(native:SourceShapeSegment[],widthMm:number,heightMm:number,bleedMm:number,safeMm:number) {
  if(![bleedMm,safeMm].every(positive)||Math.max(bleedMm,safeMm)>100) throw Error('Invalid source margin review');
  const source=sourceShapeMetrics(native);
  const path=transformSourceShape(native,source.bounds,widthMm,heightMm,bleedMm);
  const metrics=sourceShapeMetrics(path),flat=flattenSourceShape(path);
  const sign=Math.sign(metrics.signedArea);
  const joins:Array<{index:number;angleDegrees:number|null}>=[];
  for(let i=0;i<path.length;i++) {
    const a=tangent(path[i],true),b=tangent(path[(i+1)%path.length],false);
    joins.push({index:i,angleDegrees:a&&b ? Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI:null});
  }
  let inwardFocalRadiusExceededSamples=0,outwardFocalRadiusExceededSamples=0,stationarySamples=0,minSampledRadius=Infinity;
  const normals:Array<{cut:ShapePoint;bleed:ShapePoint;safe:ShapePoint}>=[];
  path.forEach(s=>{
    for(let i=0;i<=64;i++) {
      const d=derivatives(s,i/64),speed=Math.hypot(...d.first);
      if(speed<1e-10) {stationarySamples++;continue;}
      const k=sign*cross(d.first,d.second)/speed**3;
      if(Math.abs(k)>1e-12)minSampledRadius=Math.min(minSampledRadius,1/Math.abs(k));
      // Passing the sampled focal radius is a local warning, not proof that
      // the entire offset has a cusp (a circle can pass it everywhere).
      if(k*safeMm>=1)inwardFocalRadiusExceededSamples++;
      if(-k*bleedMm>=1)outwardFocalRadiusExceededSamples++;
      if(i%8===0 && sign) {
        const nx=sign*d.first[1]/speed,ny=-sign*d.first[0]/speed;
        normals.push({cut:d.point,bleed:[d.point[0]+bleedMm*nx,d.point[1]+bleedMm*ny],safe:[d.point[0]-safeMm*nx,d.point[1]-safeMm*ny]});
      }
    }
  });
  const intersections:Array<[number,number]>=[];
  for(let i=0;i<flat.segmentCount;i++) for(let j=i+2;j<flat.segmentCount;j++) {
    if(i===0&&j===flat.segmentCount-1)continue;
    const a=flat.points[i],b=flat.points[i+1],c=flat.points[j],d=flat.points[j+1];
    if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])
      ||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))continue;
    // A strict polyline crossing is a review signal only. Tangencies, overlaps
    // and features inside the flatten error are explicitly unresolved.
    if(cross(sub(b,a),sub(c,a))*cross(sub(b,a),sub(d,a))<0
      &&cross(sub(d,c),sub(a,c))*cross(sub(d,c),sub(b,c))<0)intersections.push([i,j]);
  }
  return {widthMm,heightMm,bleedMm,safeMm,path,metrics,flat,
    diagnostics:{joins,nonSmoothJoins:joins.filter(j=>j.angleDegrees===null||j.angleDegrees>1).length,
      curvatureSamples:path.length*65,stationarySamples,minSampledRadiusMm:Number.isFinite(minSampledRadius)?minSampledRadius:null,
      inwardFocalRadiusExceededSamples,outwardFocalRadiusExceededSamples,polylineCrossings:intersections},normalSamples:normals,
    scalingAuthorityProved:false as const,exactTopologyProved:false as const,
    offsetGeometryConstructed:false as const,sourceGeometryAccepted:false as const};
}

export function sourceShapeSvgPath(path:SourceShapeSegment[]) {
  assertSourceShapePath(path);
  return `M ${path[0].pointsPt[0].join(' ')} `+path.map(s=>`${s.operator==='c'?'C':'L'} ${s.pointsPt.slice(1).map(p=>p.join(' ')).join(' ')}`).join(' ')+' Z';
}
