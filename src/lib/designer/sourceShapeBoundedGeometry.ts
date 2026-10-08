/** Offline geometry for the exact binary input, never supplier scaling authority.
 * Topology uses integer dyadic predicates; offsets use outward-rounded interval
 * arithmetic. A refused interval/join is not repaired or connected implicitly. */
import { assertSourceShapePath, type ShapePoint, type SourceShapeSegment } from './sourceShapeReviewGeometry.ts';

type EPoint = readonly [bigint, bigint];
type Curve = { p: EPoint[]; e: number; depth: number; t0: number; t1: number };
type Interval = readonly [number, number];
type IPoint = readonly [Interval, Interval];
const dot = (a:EPoint,b:EPoint)=>a[0]*b[0]+a[1]*b[1];
const sub = (a:EPoint,b:EPoint):EPoint=>[a[0]-b[0],a[1]-b[1]];
const equal = (a:EPoint,b:EPoint)=>a[0]===b[0]&&a[1]===b[1];
const sum = (a:EPoint,b:EPoint):EPoint=>[a[0]+b[0],a[1]+b[1]];
const mul = (a:EPoint,n:bigint):EPoint=>[a[0]*n,a[1]*n];
const perp = (a:EPoint):EPoint=>[-a[1],a[0]];
const determinant = (a:EPoint,b:EPoint)=>a[0]*b[1]-a[1]*b[0];
const buffer=new DataView(new ArrayBuffer(8));
function dyadic(n:number):readonly [bigint,number] {
  if(n===0)return [0n,0];
  buffer.setFloat64(0,n);const bits=buffer.getBigUint64(0),exp=Number((bits>>52n)&2047n);
  const mantissa=(bits&((1n<<52n)-1n))+(exp?1n<<52n:0n);
  return [(bits>>63n)?-mantissa:mantissa,exp?exp-1075:-1074];
}
function exactCurves(path:SourceShapeSegment[]):Curve[] {
  assertSourceShapePath(path);
  const scalars=path.flatMap(s=>s.pointsPt.flatMap(p=>p.map(dyadic)));
  const e=Math.min(...scalars.filter(([n])=>n!==0n).map(([,e])=>e));
  if(!Number.isFinite(e))throw Error('Collapsed binary geometry');
  return path.map(s=>({p:s.pointsPt.map(p=>p.map(n=>{const [v,k]=dyadic(n);return v===0n?0n:v<<BigInt(k-e);}) as unknown as EPoint),e,depth:0,t0:0,t1:1}));
}
function exactWinding(curves:Curve[]) {
  const coefficients=(ps:EPoint[],axis:number)=>{
    const p=ps.map(q=>q[axis]);return p.length===2?[p[0],p[1]-p[0]]:
      [p[0],3n*(p[1]-p[0]),3n*(p[2]-2n*p[1]+p[0]),p[3]-3n*p[2]+3n*p[1]-p[0]];
  };
  let scaledArea=0n;
  // Initial curves share one dyadic scale. The Green integral denominators
  // divide 120, so its sign is obtained with integer arithmetic too.
  for(const c of curves) {
    const x=coefficients(c.p,0),y=coefficients(c.p,1);
    for(let i=0;i<x.length;i++)for(let j=1;j<y.length;j++)scaledArea+=(x[i]*BigInt(j)*y[j]-y[i]*BigInt(j)*x[j])*(60n/BigInt(i+j));
  }
  return scaledArea>0n?1:scaledArea<0n?-1:0;
}
function split(c:Curve):[Curve,Curve] {
  const p=c.p,mid=(c.t0+c.t1)/2,common={e:c.e-(p.length===2?1:3),depth:c.depth+1};
  if(p.length===2) {
    const m=sum(p[0],p[1]);
    return [{...common,p:[mul(p[0],2n),m],t0:c.t0,t1:mid},{...common,p:[m,mul(p[1],2n)],t0:mid,t1:c.t1}];
  }
  const a=mul(sum(p[0],p[1]),4n),b=mul(sum(sum(p[0],mul(p[1],2n)),p[2]),2n);
  const m=sum(sum(p[0],mul(p[1],3n)),sum(mul(p[2],3n),p[3]));
  const d=mul(sum(sum(p[1],mul(p[2],2n)),p[3]),2n),f=mul(sum(p[2],p[3]),4n);
  return [{...common,p:[mul(p[0],8n),a,b,m],t0:c.t0,t1:mid},{...common,p:[m,d,f,mul(p[3],8n)],t0:mid,t1:c.t1}];
}
function align(a:Curve,b:Curve) {
  const e=Math.min(a.e,b.e),scale=(c:Curve)=>c.p.map(p=>p.map(n=>n<<BigInt(c.e-e)) as unknown as EPoint);
  return [scale(a),scale(b)] as const;
}
function injective(c:Curve) {
  const direction=sub(c.p.at(-1)!,c.p[0]);
  // Derivative Bernstein coefficients have nonnegative projection, at least
  // one positive. Projection is strictly increasing in the open interval.
  const projected=c.p.slice(1).map((p,i)=>dot(sub(p,c.p[i]),direction));
  return projected.every(n=>n>=0n)&&projected.some(n=>n>0n);
}
function directions(a:EPoint[],b:EPoint[]) {
  const result:EPoint[]=[[1n,0n],[0n,1n]];
  for(const ps of [a,b])for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++) {
    const v=sub(ps[j],ps[i]);result.push(v,perp(v));
  }
  result.push(sub(b.at(-1)!,a[0]),sum(sub(a.at(-1)!,a[0]),sub(b.at(-1)!,b[0])));
  const incoming=sub(a.at(-1)!,a[0]),outgoing=sub(b.at(-1)!,b[0]),aa=dot(incoming,incoming),bb=dot(outgoing,outgoing),ab=dot(incoming,outgoing);
  // This rational bisector has positive dot product aa*bb-ab² with BOTH
  // non-collinear chords, including very unequal lengths and obtuse corners.
  result.push(sum(mul(incoming,bb-ab),mul(outgoing,aa-ab)));
  return result.filter(v=>v[0]!==0n||v[1]!==0n);
}
function separated(a:Curve,b:Curve,allowSeam:boolean) {
  const [ap,bp]=align(a,b),shared=allowSeam&&equal(ap.at(-1)!,bp[0]);
  for(const v of directions(ap,bp)) {
    const pa=ap.map(p=>dot(p,v)),pb=bp.map(p=>dot(p,v));
    const min=(ns:bigint[])=>ns.reduce((a,b)=>a<b?a:b),max=(ns:bigint[])=>ns.reduce((a,b)=>a>b?a:b);
    if(max(pa)<min(pb)||max(pb)<min(pa))return true;
    if(shared) {
      const s=pa.at(-1)!;
      // Strict opposite-side endpoints and at least one strict coefficient
      // place curve interiors in disjoint open half planes, allowing only seam.
      if(pa.every(n=>n<=s)&&pb.every(n=>n>=s)&&pa[0]<s&&pb.at(-1)!>s)return true;
      if(pa.every(n=>n>=s)&&pb.every(n=>n<=s)&&pa[0]>s&&pb.at(-1)!<s)return true;
    }
  }
  return false;
}

function lineContact(a:Curve,b:Curve,allowSeam:boolean) {
  if(a.p.length!==2||b.p.length!==2)return null;
  const [ap,bp]=align(a,b),[p,q]=ap,[r,s]=bp,u=sub(q,p),v=sub(s,r);
  const orient=(x:EPoint,y:EPoint,z:EPoint)=>determinant(sub(y,x),sub(z,x));
  const oa=orient(p,q,r),ob=orient(p,q,s),oc=orient(r,s,p),od=orient(r,s,q);
  if(oa*ob<0n&&oc*od<0n)return 'proper_line_crossing';
  const min=(a:bigint,b:bigint)=>a<b?a:b,max=(a:bigint,b:bigint)=>a>b?a:b;
  if(oa===0n&&ob===0n&&determinant(u,v)===0n) {
    const axis=u[0]!==0n?0:1,lo=max(min(p[axis],q[axis]),min(r[axis],s[axis])),hi=min(max(p[axis],q[axis]),max(r[axis],s[axis]));
    if(lo<hi)return 'line_overlap';
  }
  const on=(x:EPoint,y:EPoint,z:EPoint)=>orient(x,y,z)===0n&&[0,1].every(k=>z[k]>=min(x[k],y[k])&&z[k]<=max(x[k],y[k]));
  const contacts=[...(on(p,q,r)?[r]:[]),...(on(p,q,s)?[s]:[]),...(on(r,s,p)?[p]:[]),...(on(r,s,q)?[q]:[])];
  if(contacts.some(c=>!(allowSeam&&equal(q,r)&&equal(c,q))))return 'unexpected_line_contact';
  return null;
}

export function boundSourceShapeTopology(path:SourceShapeSegment[],maxDepth=18,maxWork=100000) {
  if(!Number.isInteger(maxDepth)||maxDepth<2||maxDepth>24||!Number.isInteger(maxWork)||maxWork<1||maxWork>1000000)throw Error('Invalid topology budget');
  const initial=exactCurves(path),leaves:Curve[]=[];let work=0;
  const failures:Array<{reason:string;leafIndices:number[];parameterIntervals:number[][]}>=[];
  let lineWitness:null|{kind:string;curves:Array<{integerControls:string[][];scale2Exponent:number;parameterInterval:number[]}>}=null;
  const visit=(c:Curve):boolean=>{
    if(work>=maxWork)return false;work++;
    if(leaves.length>=4096)return false;
    if(c.depth>=1&&injective(c)){leaves.push(c);return true;}
    if(c.depth>=maxDepth||leaves.length>=4096)return false;
    return split(c).every(visit);
  };
  for(let i=0;i<initial.length;i++)if(!visit(initial[i])) {
    failures.push({reason:work>=maxWork?'topology_work_budget':'curve_injectivity_unresolved',leafIndices:[],parameterIntervals:[[i,0,1]]});break;
  }
  const exclude=(a:Curve,b:Curve,seam:boolean):boolean=>{
    if(work>=maxWork)return false;work++;
    const contact=lineContact(a,b,seam);
    if(contact) {
      lineWitness={kind:contact,curves:[a,b].map(c=>({integerControls:c.p.map(p=>p.map(String)),scale2Exponent:c.e,parameterInterval:[c.t0,c.t1]}))};return false;
    }
    if(separated(a,b,seam))return true;
    if(a.depth>=maxDepth&&b.depth>=maxDepth)return false;
    // Balanced exact subdivision avoids relying on a floating hull diameter.
    if(a.depth<=b.depth&&a.depth<maxDepth)return split(a).every(c=>exclude(c,b,seam&&c.t1===a.t1));
    return split(b).every(c=>exclude(a,c,seam&&c.t0===b.t0));
  };
  if(!failures.length)outer:for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++) {
    const seam=j===i+1||(i===0&&j===leaves.length-1);
    const a=i===0&&j===leaves.length-1?leaves[j]:leaves[i],b=i===0&&j===leaves.length-1?leaves[i]:leaves[j];
    if(!exclude(a,b,seam)) {
      failures.push({reason:lineWitness?.kind??(work>=maxWork?'topology_work_budget':'contact_or_crossing_unresolved'),leafIndices:[i,j],parameterIntervals:[[a.t0,a.t1],[b.t0,b.t1]]});break outer;
    }
  }
  return {status:lineWitness?'binary_input_not_simple' as const:failures.length?'unresolved' as const:'binary_input_simple_loop_proved' as const,
    arithmetic:'exact_integer_dyadic' as const,leafCount:leaves.length,work,maxDepth,maxWork,failures,lineWitness,
    supplierScalingAccepted:false as const,sourceGeometryAccepted:false as const};
}

function next(n:number,up:boolean) {
  if(Number.isNaN(n))throw Error('Invalid interval');
  if(n===(up?Infinity:-Infinity))return n;
  if(n===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;
  buffer.setFloat64(0,n);let b=buffer.getBigUint64(0);b+=(n>0)===up?1n:-1n;buffer.setBigUint64(0,b);return buffer.getFloat64(0);
}
const down=(n:number)=>next(n,false),up=(n:number)=>next(n,true);
const scalar=(n:number):Interval=>[n,n];
const addI=(a:Interval,b:Interval):Interval=>[down(a[0]+b[0]),up(a[1]+b[1])];
const negI=(a:Interval):Interval=>[-a[1],-a[0]];
const subI=(a:Interval,b:Interval)=>addI(a,negI(b));
function mulI(a:Interval,b:Interval):Interval {
  const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return [down(Math.min(...v)),up(Math.max(...v))];
}
function divI(a:Interval,b:Interval) {
  if(b[0]<=0&&b[1]>=0)throw Error('Stationary derivative interval');
  return mulI(a,[down(1/b[1]),up(1/b[0])]);
}
function sqrtI(a:Interval):Interval {
  if(a[1]<0)throw Error('Invalid squared interval');return [Math.max(0,down(Math.sqrt(Math.max(0,a[0])))),up(Math.sqrt(Math.max(0,a[1])))];
}
function squareI(a:Interval):Interval {
  const ends=[a[0]**2,a[1]**2];return [a[0]<=0&&a[1]>=0?0:Math.max(0,down(Math.min(...ends))),up(Math.max(...ends))];
}
const normI=(p:IPoint)=>sqrtI(addI(squareI(p[0]),squareI(p[1])));
function numberI(n:bigint,e:number):Interval {
  if(n===0n)return [0,0];
  const value=Number(n),scale=2**e;
  if(!Number.isFinite(value)||!Number.isFinite(scale)||scale===0)throw Error('Numeric range refused');
  return mulI([down(value),up(value)],scalar(scale));
}
const pointI=(p:EPoint,e:number):IPoint=>[numberI(p[0],e),numberI(p[1],e)];
function derivatives(c:Curve) {
  const derive=(p:EPoint[])=>p.slice(1).map((q,i)=>mul(sub(q,p[i]),BigInt(p.length-1)));
  const v=derive(c.p),a=derive(v),j=derive(a);
  const hull=(ps:EPoint[]):IPoint=>{
    if(!ps.length)return [[0,0],[0,0]];
    const values=ps.map(p=>pointI(p,c.e));
    return [0,1].map(k=>[Math.min(...values.map(p=>p[k][0])),Math.max(...values.map(p=>p[k][1]))]) as unknown as IPoint;
  };
  return {v,a,j,vi:hull(v),ai:hull(a),ji:hull(j)};
}
function endpoint(c:Curve,end:boolean,d:number,sign:number):IPoint {
  const der=derivatives(c),v=pointI(end?der.v.at(-1)!:der.v[0],c.e),speed=normI(v),p=pointI(end?c.p.at(-1)!:c.p[0],c.e);
  return [addI(p[0],mulI(scalar(d*sign),divI(v[1],speed))),subI(p[1],mulI(scalar(d*sign),divI(v[0],speed)))];
}
function representative(p:IPoint) {
  const point=p.map(a=>(a[0]+a[1])/2) as unknown as ShapePoint;
  const radius=normI([subI(p[0],scalar(point[0])),subI(p[1],scalar(point[1]))])[1];
  return {point,radius};
}
export type OffsetChord = { start:ShapePoint;end:ShapePoint;t0:number;t1:number;maxErrorMm:number;regularFactorLower:number };
export type OffsetBranch = { segment:number;status:'bounded_normal_branch'|'refused';reason:string|null;chords:OffsetChord[];work:number };
export type OffsetJoin = { afterSegment:number;kind:'continuous_normal'|'analytic_round_arc'|'refused';reason:string|null;
  center:ShapePoint;radiusMm:number;start:ShapePoint|null;end:ShapePoint|null;sweep:0|1|null;endpointErrorMm:number|null };

/** Q=P+d*Nout. On each leaf v=|P'| has a positive interval lower bound.
 * |Q''| <= A + |d|*(J/v + 3*A²/v²); chord error <= |Q''|/8.
 * Endpoint evaluation radii are added. No sampled residual is the bound.
 * A positive interval lower bound for 1+d*k proves local offset regularity.
 * It does NOT prove global offset simplicity or select supplier join policy. */
export function boundSourceShapeOffset(path:SourceShapeSegment[],signedDistanceMm:number,errorMm=0.01,maxDepth=18,maxWork=32768) {
  if(!Number.isFinite(signedDistanceMm)||Math.abs(signedDistanceMm)<1e-5||Math.abs(signedDistanceMm)>100
    ||!Number.isFinite(errorMm)||errorMm<1e-5||errorMm>0.05||!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>24
    ||!Number.isInteger(maxWork)||maxWork<1||maxWork>1000000)throw Error('Invalid offset budget');
  const source=exactCurves(path),sign=exactWinding(source),d=signedDistanceMm;
  if(!sign)throw Error('Zero winding has no accepted outward normal');
  let totalWork=0;
  const branches:OffsetBranch[]=source.map((c,segment)=>{
    const chords:OffsetChord[]=[];let reason:string|null=null,work=0;
    const visit=(leaf:Curve):boolean=>{
      if(totalWork>=maxWork){reason='offset_work_budget';return false;}work++;totalWork++;
      const der=derivatives(leaf),speed=normI(der.vi),a=normI(der.ai),j=normI(der.ji);
      if(der.v.some((v,i)=>(i===0||i===der.v.length-1)&&v[0]===0n&&v[1]===0n)) {reason='stationary_native_endpoint';return false;}
      let regular:Interval|null=null;
      if(speed[0]>0) {
        const crossI=subI(mulI(der.vi[0],der.ai[1]),mulI(der.vi[1],der.ai[0]));
        const k=divI(mulI(scalar(sign),crossI),mulI(squareI(speed),speed));
        regular=addI(scalar(1),mulI(scalar(d),k));
        if(regular[1]<=0){reason='orientation_preserving_offset_refused';return false;}
        if(regular[0]>0) {
          const bound=addI(a,mulI(scalar(Math.abs(d)),addI(divI(j,speed),mulI(scalar(3),divI(squareI(a),squareI(speed))))));
          const start=representative(endpoint(leaf,false,d,sign)),end=representative(endpoint(leaf,true,d,sign));
          const error=addI(divI(bound,scalar(8)),scalar(Math.max(start.radius,end.radius)))[1];
          if(Number.isFinite(error)&&error<=errorMm) {
            chords.push({start:start.point,end:end.point,t0:leaf.t0,t1:leaf.t1,maxErrorMm:error,regularFactorLower:regular[0]});return true;
          }
        }
      }
      if(leaf.depth>=maxDepth){reason=speed[0]>0?'offset_error_or_focal_interval_unresolved':'stationary_derivative_unresolved';return false;}
      return split(leaf).every(visit);
    };
    let okay=false;try{okay=visit(c);}catch{reason='numeric_interval_refused';}
    return {segment,status:okay?'bounded_normal_branch':'refused',reason:okay?null:reason,chords:okay?chords:[],work};
  });
  const joins:OffsetJoin[]=source.map((c,i)=>{
    const other=source[(i+1)%source.length],[a,b]=align(c,other);
    const va=sub(a.at(-1)!,a.at(-2)!),vb=sub(b[1],b[0]),cross=determinant(va,vb),turn=Number(cross>0n)-Number(cross<0n);
    let kind:OffsetJoin['kind']='refused',reason:string|null=null;
    if(dot(va,va)===0n||dot(vb,vb)===0n)reason='stationary_join_tangent';
    else if(cross===0n&&dot(va,vb)>0n)kind='continuous_normal';
    else if(cross===0n)reason='opposed_join_tangents';
    else if(turn*sign*d>0)kind='analytic_round_arc';
    else reason='reentrant_join_requires_trimmed_arrangement';
    let start:ShapePoint|null=null,end:ShapePoint|null=null,endpointErrorMm:number|null=null;
    if(kind!=='refused')try{
      const p=representative(endpoint(c,true,d,sign)),q=representative(endpoint(other,false,d,sign));
      start=p.point;end=q.point;endpointErrorMm=Math.max(p.radius,q.radius);
    }catch{kind='refused';reason='numeric_join_interval_refused';}
    // Arc center/radius and endpoint normals define the analytic arc. Numeric
    // endpoint points are only for display, with explicit interval error radii.
    return {afterSegment:i,kind,reason,center:path[i].pointsPt.at(-1)!,radiusMm:Math.abs(d),start,end,
      sweep:kind==='analytic_round_arc'?(turn>0?1:0):null,endpointErrorMm};
  });
  return {signedDistanceMm:d,errorMm,maxDepth,maxWork,totalWork,branches,joins,
    allBranchesBounded:branches.every(b=>b.status==='bounded_normal_branch'),allJoinsConstructed:joins.every(j=>j.kind!=='refused'),
    globalOffsetTopologyProved:false as const,supplierJoinPolicyAccepted:false as const,
    sourceGeometryAccepted:false as const,designerAllowed:false as const,orderReady:false as const};
}
