/** Exact contacts of straight native offset branches, offline only. Other
 * polynomial branches, trimming, source scale and printable topology stay open. */
import {assertSourceShapePath,type SourceShapeSegment} from './sourceShapeReviewGeometry';
import {signSourceShapeRadical} from './sourceShapeArcContacts';
type Point=readonly [bigint,bigint];
type SerialPoint=readonly [string,string];
export type ExactOffsetLine={segment:number;origin:SerialPoint;direction:SerialPoint;radius:string;normalSign:1|-1;scale2Exponent:number};
export type ExactTwoRadicalParameter={constant:string;firstCoefficient:string;secondCoefficient:string;
  firstRadicand:string;secondRadicand:string;denominator:string};
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:Point,b:Point)=>a[0]*b[1]-a[1]*b[0];
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1];
const sign=(n:bigint):1|0|-1=>n>0n?1:n<0n?-1:0;
const serial=(p:Point):SerialPoint=>[String(p[0]),String(p[1])];
const point=(p:SerialPoint):Point=>p.map(BigInt) as unknown as Point;
const bits=new DataView(new ArrayBuffer(8));
function dyadic(n:number):readonly [bigint,number]{if(n===0)return [0n,0];bits.setFloat64(0,n);const b=bits.getBigUint64(0),k=Number((b>>52n)&2047n);
  return [(b>>63n?-1n:1n)*((b&((1n<<52n)-1n))+(k?1n<<52n:0n)),k?k-1075:-1074];}

/** Compare x=a+b*sqrt(u)+c*sqrt(v) without converting to a floating value.
 * When the two terms oppose, compare their squares with a single radical. */
export function signSourceShapeTwoRadicals(a:bigint,b:bigint,u:bigint,c:bigint,v:bigint):1|0|-1{
  if(u<0n||v<0n)throw Error('Negative parameter radical');
  const x=signSourceShapeRadical(a,b,u),y=v===0n?0:sign(c);
  if(y===0)return x;if(x===0)return y;if(x===y)return x;
  const magnitude=signSourceShapeRadical(a*a+b*b*u-c*c*v,2n*a*b,u);
  return magnitude===0?0:magnitude>0?x:y;
}
export function classifySourceShapeLineParameter(p:ExactTwoRadicalParameter){
  const a=BigInt(p.constant),b=BigInt(p.firstCoefficient),c=BigInt(p.secondCoefficient),
    u=BigInt(p.firstRadicand),v=BigInt(p.secondRadicand),den=BigInt(p.denominator);
  if(den<=0n||u<=0n||v<=0n)throw Error('Invalid exact line parameter');
  const startSign=signSourceShapeTwoRadicals(a,b,u,c,v),endSign=signSourceShapeTwoRadicals(a-den,b,u,c,v);
  return {startSign,endSign,onClosedBranch:startSign>=0&&endSign<=0};
}
export function constructSourceShapeExactOffsetLines(path:SourceShapeSegment[],signedDistanceMm:number,winding:1|-1,scale2Exponent:number){
  assertSourceShapePath(path);
  if(!Number.isFinite(signedDistanceMm)||Math.abs(signedDistanceMm)<1e-5||Math.abs(signedDistanceMm)>100
    ||![1,-1].includes(winding)||!Number.isInteger(scale2Exponent)||scale2Exponent < -1074||scale2Exponent>1024)throw Error('Invalid exact line scope');
  const integer=(n:number)=>{const [v,k]=dyadic(n);if(v!==0n&&k<scale2Exponent)throw Error('Line scale loses native bits');return v===0n?0n:v<<BigInt(k-scale2Exponent);};
  const radius=String(integer(Math.abs(signedDistanceMm))),normalSign=(winding*(signedDistanceMm>0?1:-1)) as 1|-1;
  return path.flatMap((s,segment)=>{
    if(s.operator!=='l')return [];
    const origin=s.pointsPt[0].map(integer) as unknown as Point,end=s.pointsPt[1].map(integer) as unknown as Point,direction=sub(end,origin);
    if(dot(direction,direction)===0n)throw Error('Collapsed native line');
    return [{segment,origin:serial(origin),direction:serial(direction),radius,normalSign,scale2Exponent}];
  });
}
function validate(line:ExactOffsetLine){
  if(!Number.isInteger(line.segment)||line.segment<0||![1,-1].includes(line.normalSign)||!Number.isInteger(line.scale2Exponent)
    ||line.scale2Exponent < -1074||line.scale2Exponent>1024)throw Error('Invalid exact line identity');
  for(const p of [line.origin,line.direction])if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='string'||!/^(-?[1-9]\d*|0)$/.test(n)||n.length>700))throw Error('Invalid exact line coordinates');
  if(typeof line.radius!=='string'||!/^([1-9]\d*)$/.test(line.radius)||line.radius.length>700||dot(point(line.direction),point(line.direction))===0n)throw Error('Invalid exact line radius or tangent');
}
const parameter=(a:bigint,b:bigint,u:bigint,c:bigint,v:bigint,den:bigint):ExactTwoRadicalParameter=>{
  const direction=den<0n?-1n:1n;
  return {constant:String(a*direction),firstCoefficient:String(b*direction),secondCoefficient:String(c*direction),
    firstRadicand:String(u),secondRadicand:String(v),denominator:String(den*direction)};
};
const rational=(numerator:bigint,denominator:bigint)=>{
  if(denominator<0n){numerator=-numerator;denominator=-denominator;}
  const gcd=(a:bigint,b:bigint):bigint=>b===0n?a:gcd(b,a%b);
  const g=gcd(numerator<0n?-numerator:numerator,denominator);
  return {numerator:String(numerator/g),denominator:String(denominator/g)};
};

export function intersectSourceShapeExactOffsetLines(a:ExactOffsetLine,b:ExactOffsetLine){
  validate(a);validate(b);
  if(a.segment===b.segment||a.radius!==b.radius||a.normalSign!==b.normalSign||a.scale2Exponent!==b.scale2Exponent)throw Error('Foreign line pair scope');
  const originA=point(a.origin),originB=point(b.origin),u=point(a.direction),v=point(b.direction),delta=sub(originB,originA);
  const da=dot(u,u),db=dot(v,v),uv=dot(u,v),k=cross(u,v),r=BigInt(a.radius)*BigInt(a.normalSign);
  const base={segments:[a.segment,b.segment],scale2Exponent:a.scale2Exponent};
  if(k===0n){
    // Same-facing normals cancel. Opposing normals move apart by2r/sqrt(da).
    const separation=signSourceShapeRadical(cross(delta,u),uv>0n?0n:-2n*r,da);
    if(separation!==0)return {...base,relation:'parallel_distinct_supports' as const,status:'disjoint_exact_line_branches' as const};
    const start=dot(delta,u),end=start+uv,lo=(start<end?start:end)>0n?(start<end?start:end):0n,
      hi=(start>end?start:end)<da?(start>end?start:end):da;
    if(lo>hi)return {...base,relation:'coincident_disjoint_intervals' as const,status:'disjoint_exact_line_branches' as const};
    const endpoints=[lo,hi].map(t=>({onA:rational(t,da),onB:rational(t-start,uv)}));
    return {...base,relation:lo===hi?'coincident_single_endpoint' as const:'coincident_interval_overlap' as const,
      status:lo===hi?'isolated_exact_line_contact' as const:'exact_coincident_line_overlap' as const,endpoints};
  }
  const ta=parameter(da*cross(delta,v),-r*uv,da,r*da,db,k*da);
  const tb=parameter(db*cross(delta,u),-r*db,da,r*uv,db,k*db);
  const onA=classifySourceShapeLineParameter(ta),onB=classifySourceShapeLineParameter(tb);
  return {...base,relation:'nonparallel_support_intersection' as const,
    status:onA.onClosedBranch&&onB.onClosedBranch?'isolated_exact_line_contact' as const:'disjoint_exact_line_branches' as const,
    parameters:{onA:ta,onB:tb},membership:{onA,onB}};
}
