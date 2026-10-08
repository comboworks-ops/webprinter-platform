/** Offline supplement to018. Exact endpoint factors extend the normal of the
 * SAME native polynomial; no replacement, snapping or supplier permission. */
import { assertSourceShapePath, type ShapePoint, type SourceShapeSegment } from './sourceShapeReviewGeometry.ts';
type EPoint = readonly [bigint,bigint];
type I = readonly [number,number];
type IP = readonly [I,I];
type Exact = {p:EPoint[];e:number};
type Factor = {startOrder:number;endOrder:number;w:EPoint[]};
const sub=(a:EPoint,b:EPoint):EPoint=>[a[0]-b[0],a[1]-b[1]];
const add=(a:EPoint,b:EPoint):EPoint=>[a[0]+b[0],a[1]+b[1]];
const mul=(a:EPoint,n:bigint):EPoint=>[a[0]*n,a[1]*n];
const cross=(a:EPoint,b:EPoint)=>a[0]*b[1]-a[1]*b[0];
const dot=(a:EPoint,b:EPoint)=>a[0]*b[0]+a[1]*b[1];
const zero=(a:EPoint)=>a[0]===0n&&a[1]===0n;
const same=(a:EPoint,b:EPoint)=>zero(sub(a,b));
const bits=new DataView(new ArrayBuffer(8));
function dyadic(n:number):readonly [bigint,number] {
  if(n===0)return [0n,0];bits.setFloat64(0,n);const b=bits.getBigUint64(0),k=Number((b>>52n)&2047n);
  return [(b>>63n?-1n:1n)*((b&((1n<<52n)-1n))+(k?1n<<52n:0n)),k?k-1075:-1074];
}
function exact(path:SourceShapeSegment[]):Exact[] {
  assertSourceShapePath(path);
  const e=Math.min(...path.flatMap(s=>s.pointsPt.flatMap(p=>p.map(dyadic))).filter(([n])=>n!==0n).map(([,e])=>e));
  if(!Number.isFinite(e))throw Error('Collapsed binary geometry');
  return path.map(s=>({e,p:s.pointsPt.map(p=>p.map(n=>{const [v,k]=dyadic(n);return v===0n?0n:v<<BigInt(k-e);}) as unknown as EPoint)}));
}
function power(c:Exact):EPoint[] {
  const p=c.p;return p.length===2?[p[0],sub(p[1],p[0])]:[p[0],mul(sub(p[1],p[0]),3n),
    mul(add(sub(p[2],mul(p[1],2n)),p[0]),3n),sub(add(p[3],mul(p[1],3n)),add(mul(p[2],3n),p[0]))];
}
function winding(cs:Exact[]) {
  let area=0n;for(const c of cs){const p=power(c);for(let i=0;i<p.length;i++)for(let j=1;j<p.length;j++)area+=cross(p[i],p[j])*BigInt(j)*(60n/BigInt(i+j));}
  return area>0n?1:area<0n?-1:0;
}
function factor(c:Exact):Factor|null {
  const p=c.p;if(p.length!==4)return null;
  const start=same(p[0],p[1]),end=same(p[2],p[3]);if(!start&&!end)return null;
  if(start&&end)return {startOrder:1,endOrder:1,w:[mul(sub(p[3],p[0]),6n)]};
  if(start&&same(p[0],p[2]))return {startOrder:2,endOrder:0,w:[mul(sub(p[3],p[0]),3n)]};
  if(end&&same(p[1],p[3]))return {startOrder:0,endOrder:2,w:[mul(sub(p[3],p[0]),3n)]};
  return start?{startOrder:1,endOrder:0,w:[mul(sub(p[2],p[0]),6n),mul(sub(p[3],p[2]),3n)]}:
    {startOrder:0,endOrder:1,w:[mul(sub(p[1],p[0]),3n),mul(sub(p[3],p[1]),6n)]};
}
function certificate(c:Exact,f:Factor) {
  // Multiply f=t^a(1-t)^b by the POWER coefficients of W and compare
  // every exact derivative coefficient. This is an identity, not a sample.
  const fp=f.endOrder===2?[1n,-2n,1n]:f.endOrder===1?[1n,-1n]:[1n];
  const polynomial=[...Array<bigint>(f.startOrder).fill(0n),...fp];
  const wp=f.w.length===1?f.w:[f.w[0],sub(f.w[1],f.w[0])];
  const product:EPoint[]=Array.from({length:polynomial.length+wp.length-1},()=>[0n,0n]);
  for(let i=0;i<polynomial.length;i++)for(let j=0;j<wp.length;j++)product[i+j]=add(product[i+j],mul(wp[j],polynomial[i]));
  const derivative=power(c).slice(1).map((p,i)=>mul(p,BigInt(i+1)));
  if(derivative.length!==product.length||!derivative.every((p,i)=>same(p,product[i])))throw Error('Endpoint factor identity failed');
  return {arithmetic:'exact_integer_dyadic' as const,startOrder:f.startOrder,endOrder:f.endOrder,
    scale2Exponent:c.e,normalizedBernsteinControls:f.w.map(p=>p.map(String)),
    derivativePowerCoefficients:derivative.map(p=>p.map(String)),identityProved:true as const,
    positiveScalarOnOpenInterval:true as const,nativePolynomialPreserved:true as const};
}
function adjacent(n:number,increase:boolean) {
  if(Number.isNaN(n))throw Error('Invalid interval');if(n===(increase?Infinity:-Infinity))return n;
  if(n===0)return increase?Number.MIN_VALUE:-Number.MIN_VALUE;
  bits.setFloat64(0,n);let b=bits.getBigUint64(0);b+=(n>0)===increase?1n:-1n;bits.setBigUint64(0,b);return bits.getFloat64(0);
}
const down=(n:number)=>adjacent(n,false),up=(n:number)=>adjacent(n,true),scalar=(n:number):I=>[n,n];
const addI=(a:I,b:I):I=>[down(a[0]+b[0]),up(a[1]+b[1])];
const subI=(a:I,b:I):I=>addI(a,[-b[1],-b[0]]);
function mulI(a:I,b:I):I {const ps=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return [down(Math.min(...ps)),up(Math.max(...ps))];}
function divI(a:I,b:I):I {if(b[0]<=0&&b[1]>=0)throw Error('Zero divisor');return mulI(a,[down(1/b[1]),up(1/b[0])]);}
function squareI(a:I):I {const ends=[a[0]**2,a[1]**2];return [a[0]<=0&&a[1]>=0?0:Math.max(0,down(Math.min(...ends))),up(Math.max(...ends))];}
function normI(p:IP):I {const s=addI(squareI(p[0]),squareI(p[1]));return [Math.max(0,down(Math.sqrt(Math.max(0,s[0])))),up(Math.sqrt(Math.max(0,s[1])))];}
function numberI(n:bigint,e:number):I {
  if(n===0n)return [0,0];const v=Number(n),s=2**e;
  if(!Number.isFinite(v)||!Number.isFinite(s)||s===0)throw Error('Numeric range refused');return mulI([down(v),up(v)],scalar(s));
}
const pointI=(p:EPoint,e:number):IP=>[numberI(p[0],e),numberI(p[1],e)];
function polynomialI(ps:EPoint[],e:number,t:I):IP {
  return [0,1].map(axis=>ps.slice(0,-1).reduceRight((v,p)=>addI(mulI(v,t),numberI(p[axis],e)),numberI(ps.at(-1)![axis],e))) as unknown as IP;
}
function normalPoint(c:Exact,w:EPoint[],t:number,d:number,sign:number) {
  const wp=w.length===1?w:[w[0],sub(w[1],w[0])],v=polynomialI(wp,c.e,scalar(t)),speed=normI(v);
  if(speed[0]<=0)throw Error('Normal limit unresolved');
  const p=polynomialI(power(c),c.e,scalar(t));
  const value:IP=[addI(p[0],mulI(scalar(d*sign),divI(v[1],speed))),subI(p[1],mulI(scalar(d*sign),divI(v[0],speed)))];
  const point=value.map(a=>(a[0]+a[1])/2) as unknown as ShapePoint;
  const radius=normI([subI(value[0],scalar(point[0])),subI(value[1],scalar(point[1]))])[1];
  if(!point.every(Number.isFinite)||!Number.isFinite(radius))throw Error('Normal numeric range');return {point,radius};
}
export type EndpointChord={start:ShapePoint;end:ShapePoint;t0:number;t1:number;maxErrorMm:number;
  normalizedSpeedLower:number;derivativeCoefficientLower:number;regularity:'positive_normal_extension'|'monotone_line_image'};
/** v=fW, f>0 in(0,1), W affine/constant. N(v)=N(W) exactly there.
 * Q'= (f+d*sign*cross(W,W')/|W|^3) W. At a stationary endpoint a negative
 * second term proves a reversed interval; it is refused without trimming.
 * |Q''| <= |P''|+|d|*3|W'|^2/min|W|^2. On [a,b] the chord bound is
 * this times (b-a)^2/8 plus interval endpoint error. No sampling is proof. */
export function boundSourceShapeEndpointNormals(path:SourceShapeSegment[],d:number,errorMm=0.01,maxDepth=18,maxWork=32768) {
  if(!Number.isFinite(d)||Math.abs(d)<1e-5||Math.abs(d)>100||!Number.isFinite(errorMm)||errorMm<1e-5||errorMm>0.05
    ||!Number.isInteger(maxDepth)||maxDepth<1||maxDepth>24||!Number.isInteger(maxWork)||maxWork<1||maxWork>1000000)throw Error('Invalid endpoint budget');
  const cs=exact(path),sign=winding(cs);if(!sign)throw Error('Zero exact winding');
  const factors=cs.map(factor);let totalWork=0;
  const branches=cs.flatMap((c,segment)=>{
    const f=factors[segment];if(!f)return [];
    const proof=certificate(c,f),delta=f.w.length===1?[0n,0n] as EPoint:sub(f.w[1],f.w[0]);
    const crossValue=cross(f.w[0],delta),directionSign=(d>0?1:-1)*sign;
    const orientedCross=BigInt(directionSign)*crossValue;
    const collinear=crossValue===0n&&f.w.every(p=>dot(p,f.w[0])>0n);
    const chords:EndpointChord[]=[];let reason:string|null=null,work=0;
    const visit=(a:number,b:number,depth:number):boolean=>{
      if(totalWork>=maxWork){reason='endpoint_work_budget';return false;}totalWork++;work++;
      const t:I=[a,b],wp=f.w.length===1?f.w:[f.w[0],delta],w=polynomialI(wp,c.e,t),speed=normI(w);
      if(speed[0]>0) {
        const p=power(c),acceleration=polynomialI([mul(p[2],2n),mul(p[3],6n)],c.e,t),aa=normI(acceleration);
        const ww=normI(pointI(delta,c.e));
        const curvatureTerm=orientedCross===0n?scalar(0):divI(mulI(scalar(d*sign),numberI(crossValue,2*c.e)),mulI(squareI(speed),speed));
        let fi:I=[1,1];for(let i=0;i<f.startOrder;i++)fi=mulI(fi,t);for(let i=0;i<f.endOrder;i++)fi=mulI(fi,subI(scalar(1),t));
        const coefficient=addI(fi,curvatureTerm);
        if(collinear||coefficient[0]>0) {
          const bound=addI(aa,mulI(scalar(Math.abs(d)),mulI(scalar(3),divI(squareI(ww),squareI(speed)))));
          const start=normalPoint(c,f.w,a,d,sign),end=normalPoint(c,f.w,b,d,sign);
          const error=addI(divI(mulI(bound,squareI(scalar(b-a))),scalar(8)),scalar(Math.max(start.radius,end.radius)))[1];
          if(Number.isFinite(error)&&error<=errorMm) {
            chords.push({start:start.point,end:end.point,t0:a,t1:b,maxErrorMm:error,normalizedSpeedLower:speed[0],
              derivativeCoefficientLower:collinear?Math.max(0,coefficient[0]):coefficient[0],regularity:collinear?'monotone_line_image':'positive_normal_extension'});return true;
          }
        }
      }
      if(depth>=maxDepth){reason=speed[0]>0?'endpoint_error_or_regularity_unresolved':'normalized_hodograph_zero_unresolved';return false;}
      const mid=(a+b)/2;return visit(a,mid,depth+1)&&visit(mid,b,depth+1);
    };
    let okay=false;
    if(f.w.some(zero))reason='normalized_endpoint_tangent_zero';
    else if(crossValue===0n&&f.w.length===2&&dot(f.w[0],f.w[1])<0n)reason='normalized_hodograph_interior_zero_proved';
    else if(orientedCross<0n)reason='offset_reverses_near_stationary_endpoint';
    else try{okay=visit(0,1,0);}catch{reason='endpoint_numeric_interval_refused';}
    return [{segment,certificate:proof,status:okay?'bounded_endpoint_normal_branch' as const:'refused' as const,
      reason:okay?null:reason,chords:okay?chords:[],work}];
  });
  const tangent=(c:Exact,f:Factor|null,end:boolean)=>f?(end?f.w.at(-1)!:f.w[0]):sub(end?c.p.at(-1)!:c.p[1],end?c.p.at(-2)!:c.p[0]);
  const normalControls=(c:Exact,f:Factor|null,end:boolean)=>f?f.w:[tangent(c,null,end)];
  const joins=cs.flatMap((c,i)=>{
    const j=(i+1)%cs.length,other=cs[j],f=factors[i],g=factors[j];
    // Only replace018's stationary-join diagnosis when a facing endpoint
    // actually has a proved factor; retain all other018 joins untouched.
    if(!(f&&f.endOrder>0)&&!(g&&g.startOrder>0))return [];
    const a=tangent(c,f,true),b=tangent(other,g,false),turn=cross(a,b),turnSign=turn>0n?1:turn<0n?-1:0;
    let kind:'continuous_normal'|'analytic_round_arc'|'refused'='refused',reason:string|null=null;
    if(zero(a)||zero(b))reason='normalized_join_tangent_zero';
    else if(turn===0n&&dot(a,b)>0n)kind='continuous_normal';
    else if(turn===0n)reason='opposed_normalized_join_tangents';
    else if(turnSign*sign*d>0)kind='analytic_round_arc';
    else reason='reentrant_join_requires_trimmed_arrangement';
    let start:ShapePoint|null=null,end:ShapePoint|null=null,endpointErrorMm:number|null=null;
    if(kind!=='refused')try{
      const p=normalPoint(c,normalControls(c,f,true),1,d,sign),q=normalPoint(other,normalControls(other,g,false),0,d,sign);
      start=p.point;end=q.point;endpointErrorMm=Math.max(p.radius,q.radius);
    }catch{kind='refused';reason='normalized_join_numeric_interval_refused';}
    return [{afterSegment:i,kind,reason,center:path[i].pointsPt.at(-1)!,radiusMm:Math.abs(d),start,end,
      sweep:kind==='analytic_round_arc'?(turnSign>0?1:0) as 0|1:null,endpointErrorMm,
      nativeNormalLimitsProved:!zero(a)&&!zero(b),supplierJoinPolicyAccepted:false as const}];
  });
  return {signedDistanceMm:d,errorMm,maxDepth,maxWork,totalWork,exactWinding:sign,branches,joins,
    globalOffsetTopologyProved:false as const,supplierJoinPolicyAccepted:false as const,scalingAuthorityProved:false as const,
    sourceGeometryAccepted:false as const,designerAllowed:false as const,orderReady:false as const};
}
