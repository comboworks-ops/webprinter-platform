/** Offline exact contacts of native round joins. No trimming/join-policy choice,
 * source-scale approval, complete offset boundary, Designer or order authority. */
import {assertSourceShapePath, type SourceShapeSegment} from './sourceShapeReviewGeometry';
import type {OffsetJoin} from './sourceShapeBoundedGeometry';
type Point=readonly [bigint,bigint];
type SerializedPoint=readonly [string,string];
export type ExactRoundArc={afterSegment:number;center:SerializedPoint;radius:string;
  startDirection:SerializedPoint;endDirection:SerializedPoint;sweep:1|-1;scale2Exponent:number;
  incomingLeadingOrder:number;outgoingLeadingOrder:number};
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:Point,b:Point)=>a[0]*b[1]-a[1]*b[0];
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1];
const sign=(n:bigint):1|0|-1=>n>0n?1:n<0n?-1:0;
const serial=(p:Point):SerializedPoint=>[String(p[0]),String(p[1])];
const point=(p:SerializedPoint):Point=>p.map(BigInt) as unknown as Point;
const bits=new DataView(new ArrayBuffer(8));
function dyadic(n:number):readonly [bigint,number]{
  if(n===0)return [0n,0];bits.setFloat64(0,n);const b=bits.getBigUint64(0),k=Number((b>>52n)&2047n);
  return [(b>>63n?-1n:1n)*((b&((1n<<52n)-1n))+(k?1n<<52n:0n)),k?k-1075:-1074];
}

/** Sign of a+b*sqrt(t) using integers. Equality stays exact, including tangency. */
export function signSourceShapeRadical(a:bigint,b:bigint,t:bigint):1|0|-1{
  if(t<0n)throw Error('Negative real radical');
  if(t===0n||b===0n)return sign(a);
  if(a===0n)return sign(b);
  if(sign(a)===sign(b))return sign(a);
  const difference=a*a-b*b*t;
  return difference===0n?0:sign(difference)>0?sign(a):sign(b);
}

/** Reconstruct native tangent LIMIT directions from exact Bernstein controls,
 * rather than using rounded display endpoints. First nonzero endpoint controls
 * have a positive leading coefficient for native lines/cubics. */
export function constructSourceShapeExactRoundArcs(path:SourceShapeSegment[],signedDistanceMm:number,joins:OffsetJoin[]){
  assertSourceShapePath(path);
  if(!Number.isFinite(signedDistanceMm)||Math.abs(signedDistanceMm)<1e-5||Math.abs(signedDistanceMm)>100
    ||!Array.isArray(joins)||joins.length!==path.length)throw Error('Invalid native join inventory');
  const values=[...path.flatMap(s=>s.pointsPt.flatMap(p=>[...p])),signedDistanceMm];
  const e=Math.min(...values.map(dyadic).filter(([n])=>n!==0n).map(([,k])=>k));
  const integer=(n:number)=>{const [v,k]=dyadic(n);return v===0n?0n:v<<BigInt(k-e);};
  const controls=path.map(s=>s.pointsPt.map(p=>p.map(integer) as unknown as Point));
  let area=0n;
  for(const p of controls){
    const power=p.length===2?[p[0],sub(p[1],p[0])]:[p[0],sub(p[1],p[0]).map(n=>3n*n) as unknown as Point,
      [3n*(p[2][0]-2n*p[1][0]+p[0][0]),3n*(p[2][1]-2n*p[1][1]+p[0][1])],
      [p[3][0]-3n*p[2][0]+3n*p[1][0]-p[0][0],p[3][1]-3n*p[2][1]+3n*p[1][1]-p[0][1]]] as Point[];
    for(let i=0;i<power.length;i++)for(let j=1;j<power.length;j++)area+=cross(power[i],power[j])*BigInt(j)*(60n/BigInt(i+j));
  }
  const winding=sign(area);if(!winding)throw Error('Zero exact native winding');
  const normalSign=BigInt(winding*(signedDistanceMm>0?1:-1));
  const tangent=(p:Point[],end:boolean)=>{
    const origin=end?p.at(-1)!:p[0];
    for(let order=1;order<p.length;order++){
      const v=end?sub(origin,p[p.length-1-order]):sub(p[order],origin);
      if(v[0]!==0n||v[1]!==0n)return {direction:v,order};
    }
    return null;
  };
  const arcs:ExactRoundArc[]=[],continuousJoins:{afterSegment:number;center:SerializedPoint;direction:SerializedPoint;scale2Exponent:number}[]=[];
  let refusedJoins=0;
  for(let i=0;i<joins.length;i++){
    const join=joins[i],next=(i+1)%path.length;
    if(join.afterSegment!==i||join.radiusMm!==Math.abs(signedDistanceMm)
      ||join.center.some((n,k)=>n!==path[i].pointsPt.at(-1)![k]))throw Error('Foreign native join geometry');
    if(join.kind==='refused'){refusedJoins++;continue;}
    const a=tangent(controls[i],true),b=tangent(controls[next],false);
    if(!a||!b)throw Error('Unproved native endpoint direction');
    const turn=cross(a.direction,b.direction),direction=sign(turn);
    const normal=(v:Point):Point=>[normalSign*v[1],-normalSign*v[0]];
    if(join.kind==='continuous_normal'){
      if(turn!==0n||dot(a.direction,b.direction)<=0n)throw Error('Invalid continuous native join');
      continuousJoins.push({afterSegment:i,center:serial(controls[i].at(-1)!),direction:serial(normal(a.direction)),scale2Exponent:e});continue;
    }
    if(join.kind!=='analytic_round_arc'||direction===0||direction*winding*signedDistanceMm<=0
      ||join.sweep!==(direction>0?1:0))throw Error('Invalid analytic native round join');
    arcs.push({afterSegment:i,center:serial(controls[i].at(-1)!),radius:String(integer(Math.abs(signedDistanceMm))),
      startDirection:serial(normal(a.direction)),endDirection:serial(normal(b.direction)),sweep:direction,
      scale2Exponent:e,incomingLeadingOrder:a.order,outgoingLeadingOrder:b.order});
  }
  return {arithmetic:'exact_native_bernstein_tangent_limits' as const,scale2Exponent:e,winding,arcs,continuousJoins,refusedJoins,
    sourceGeometryAccepted:false as const,supplierJoinPolicyAccepted:false as const,globalOffsetTopologyProved:false as const,
    designerAllowed:false as const,orderReady:false as const};
}

function validateArc(arc:ExactRoundArc){
  if(!Number.isInteger(arc.afterSegment)||arc.afterSegment<0||!Number.isInteger(arc.scale2Exponent)
    ||arc.scale2Exponent < -1074||arc.scale2Exponent>1024||![1,-1].includes(arc.sweep))throw Error('Invalid exact arc identity');
  for(const p of [arc.center,arc.startDirection,arc.endDirection]){
    if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='string'||!/^(-?[1-9]\d*|0)$/.test(n)||n.length>700))throw Error('Invalid exact arc coordinates');
  }
  if(typeof arc.radius!=='string'||!/^([1-9]\d*)$/.test(arc.radius)||arc.radius.length>700)throw Error('Invalid exact arc radius');
  const start=point(arc.startDirection),end=point(arc.endDirection);
  if(BigInt(arc.sweep)*cross(start,end)<=0n)throw Error('Arc must be a nonzero native minor sector');
}
function directionInArc(arc:ExactRoundArc,v:Point){
  return BigInt(arc.sweep)*cross(point(arc.startDirection),v)>=0n&&BigInt(arc.sweep)*cross(v,point(arc.endDirection))>=0n;
}
type RadicalPoint={base:Point;coefficient:Point;denominator:bigint;radicand:bigint};
function rootInArc(arc:ExactRoundArc,p:RadicalPoint){
  const center=point(arc.center),v=sub(p.base,[p.denominator*center[0],p.denominator*center[1]]);
  const a=point(arc.startDirection),b=point(arc.endDirection),d=arc.sweep;
  const startSign=d*signSourceShapeRadical(cross(a,v),cross(a,p.coefficient),p.radicand);
  const endSign=d*signSourceShapeRadical(cross(v,b),cross(p.coefficient,b),p.radicand);
  return {startSign,endSign,onClosedArc:startSign>=0&&endSign>=0};
}
export type ExactArcPairResult={segments:number[];scale2Exponent:number;
  relation:'concentric_disjoint'|'coincident_circle_support'|'no_real_circle_support_root'|'tangent_circle_support'|'two_circle_support_roots';
  status:'disjoint_exact_round_arcs'|'coincident_sector_contact_unresolved'|'isolated_exact_round_arc_contacts';
  contactCount:number|null;endpointMembership?:boolean[];distanceSquared?:string;radicalAxisNumerator?:string;discriminant?:string;
  roots:{rootSign:number;point:{base:SerializedPoint;coefficient:SerializedPoint;denominator:string;radicand:string};
    onA:ReturnType<typeof rootInArc>;onB:ReturnType<typeof rootInArc>;contact:boolean}[]};

/** Enumerate ALL circle-support roots, then classify minor-arc membership with
 * exact radical signs. Coincident overlapping sectors are retained unresolved.
 * This proves isolated arc contacts, never a retained printable contour. */
export function intersectSourceShapeExactRoundArcs(a:ExactRoundArc,b:ExactRoundArc):ExactArcPairResult{
  validateArc(a);validateArc(b);
  if(a.scale2Exponent!==b.scale2Exponent||a.afterSegment===b.afterSegment)throw Error('Foreign arc pair scope');
  const ac=point(a.center),bc=point(b.center),delta=sub(bc,ac),distanceSquared=dot(delta,delta);
  const ar=BigInt(a.radius),br=BigInt(b.radius);
  const base={segments:[a.afterSegment,b.afterSegment],scale2Exponent:a.scale2Exponent};
  if(distanceSquared===0n){
    if(ar!==br)return {...base,relation:'concentric_disjoint' as const,status:'disjoint_exact_round_arcs' as const,contactCount:0,roots:[]};
    const endpointMembership=[directionInArc(b,point(a.startDirection)),directionInArc(b,point(a.endDirection)),
      directionInArc(a,point(b.startDirection)),directionInArc(a,point(b.endDirection))];
    return {...base,relation:'coincident_circle_support' as const,endpointMembership,
      status:endpointMembership.some(Boolean)?'coincident_sector_contact_unresolved' as const:'disjoint_exact_round_arcs' as const,
      contactCount:endpointMembership.some(Boolean)?null:0,roots:[]};
  }
  const k=ar*ar-br*br+distanceSquared,t=4n*ar*ar*distanceSquared-k*k;
  const support={distanceSquared:String(distanceSquared),radicalAxisNumerator:String(k),discriminant:String(t)};
  if(t<0n)return {...base,relation:'no_real_circle_support_root' as const,status:'disjoint_exact_round_arcs' as const,contactCount:0,roots:[]};
  const denominator=2n*distanceSquared;
  const pbase:Point=[denominator*ac[0]+k*delta[0],denominator*ac[1]+k*delta[1]];
  const roots=(t===0n?[1]:[-1,1]).map(rootSign=>{
    const coefficient:Point=[-BigInt(rootSign)*delta[1],BigInt(rootSign)*delta[0]];
    const p={base:pbase,coefficient,denominator,radicand:t},onA=rootInArc(a,p),onB=rootInArc(b,p);
    return {rootSign,point:{base:serial(pbase),coefficient:serial(coefficient),denominator:String(denominator),radicand:String(t)},
      onA,onB,contact:onA.onClosedArc&&onB.onClosedArc};
  });
  const contacts=roots.filter(r=>r.contact).length;
  return {...base,...support,relation:t===0n?'tangent_circle_support' as const:'two_circle_support_roots' as const,
    status:contacts?'isolated_exact_round_arc_contacts' as const:'disjoint_exact_round_arcs' as const,contactCount:contacts,roots};
}
