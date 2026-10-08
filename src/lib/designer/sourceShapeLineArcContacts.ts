/** Offline exact contacts of native straight offsets with native round joins.
 * The shared radius is required. No curve substitution, trim or print approval. */
import {signSourceShapeRadical,type ExactRoundArc} from './sourceShapeArcContacts';
import type {ExactOffsetLine} from './sourceShapeLineContacts';
type Point=readonly [bigint,bigint];
const point=(p:readonly string[]):Point=>p.map(BigInt) as unknown as Point;
const sub=(a:Point,b:Point):Point=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:Point,b:Point)=>a[0]*b[1]-a[1]*b[0];
const dot=(a:Point,b:Point)=>a[0]*b[0]+a[1]*b[1];
const serial=(p:Point)=>p.map(String) as [string,string];
const sign=(n:bigint):1|0|-1=>n>0n?1:n<0n?-1:0;

/** Exact sign in a quadratic extension: a+b√d+c√(q+s√d).
 * Opposing terms compare their squares in the base quadratic field. */
export function signSourceShapeNestedRadical(a:bigint,b:bigint,d:bigint,c:bigint,q:bigint,s:bigint):1|0|-1{
  if(d<=0n)throw Error('Invalid base radical');
  const h=signSourceShapeRadical(q,s,d);if(h<0)throw Error('Negative nested radical');
  const x=signSourceShapeRadical(a,b,d),y=h===0?0:sign(c);
  if(y===0)return x;if(x===0)return y;if(x===y)return x;
  const difference=signSourceShapeRadical(a*a+b*b*d-c*c*q,2n*a*b-c*c*s,d);
  return difference===0?0:difference>0?x:y;
}

export function intersectSourceShapeExactLineArc(line:ExactOffsetLine,arc:ExactRoundArc){
  for(const p of [line.origin,line.direction,arc.center,arc.startDirection,arc.endDirection]){
    if(!Array.isArray(p)||p.length!==2||p.some(n=>typeof n!=='string'||!/^(-?[1-9]\d*|0)$/.test(n)||n.length>700))throw Error('Invalid exact line/arc coordinate');
  }
  if(!Number.isInteger(line.segment)||line.segment<0||!Number.isInteger(arc.afterSegment)||arc.afterSegment<0
    ||!Number.isInteger(line.scale2Exponent)||line.scale2Exponent < -1074||line.scale2Exponent>1024
    ||line.scale2Exponent!==arc.scale2Exponent||![1,-1].includes(line.normalSign)||![1,-1].includes(arc.sweep)
    ||line.radius!==arc.radius||!/^([1-9]\d*)$/.test(line.radius)||line.radius.length>700)throw Error('Foreign native line/arc scope');
  const p=point(line.origin),u=point(line.direction),center=point(arc.center),start=point(arc.startDirection),end=point(arc.endDirection);
  const d=dot(u,u);if(d===0n||BigInt(arc.sweep)*cross(start,end)<=0n)throw Error('Collapsed line or non-minor arc');
  const r=BigInt(line.radius)*BigInt(line.normalSign),delta=sub(center,p),h=cross(delta,u),projection=dot(delta,u);
  // Shared-radius circle and offset-line support: H=R²|u|²-(h-r|u|)².
  const q=-h*h,s=2n*r*h,discriminantSign=signSourceShapeRadical(q,s,d);
  const baseIdentity={lineSegment:line.segment,arcAfterSegment:arc.afterSegment,scale2Exponent:line.scale2Exponent};
  if(discriminantSign<0)return {...baseIdentity,relation:'no_real_line_circle_root' as const,status:'disjoint_exact_line_arc' as const,contactCount:0,roots:[]};
  const radical={baseRadicand:String(d),nestedConstant:String(q),nestedCoefficient:String(s)};
  const normal:Point=[u[1],-u[0]],base:Point=[d*p[0]+projection*u[0],d*p[1]+projection*u[1]],first:Point=[r*normal[0],r*normal[1]];
  const roots=(discriminantSign===0?[1n]:[-1n,1n]).map(rootSign=>{
    const nested:Point=[rootSign*u[0],rootSign*u[1]],relative=sub(base,[d*center[0],d*center[1]]);
    const lineStart=signSourceShapeNestedRadical(projection,0n,d,rootSign,q,s),lineEnd=signSourceShapeNestedRadical(projection-d,0n,d,rootSign,q,s);
    const arcStart=arc.sweep*signSourceShapeNestedRadical(cross(start,relative),cross(start,first),d,cross(start,nested),q,s);
    const arcEnd=arc.sweep*signSourceShapeNestedRadical(cross(relative,end),cross(first,end),d,cross(nested,end),q,s);
    const onLine={startSign:lineStart,endSign:lineEnd,onClosedBranch:lineStart>=0&&lineEnd<=0};
    const onArc={startSign:arcStart,endSign:arcEnd,onClosedArc:arcStart>=0&&arcEnd>=0};
    return {rootSign:Number(rootSign),parameter:{constant:String(projection),nestedCoefficient:String(rootSign),denominator:String(d)},
      point:{base:serial(base),firstCoefficient:serial(first),nestedCoefficient:serial(nested),denominator:String(d)},
      onLine,onArc,contact:onLine.onClosedBranch&&onArc.onClosedArc};
  });
  const contactCount=roots.filter(root=>root.contact).length;
  return {...baseIdentity,relation:discriminantSign===0?'tangent_line_circle_support' as const:'two_line_circle_support_roots' as const,radical,roots,contactCount,
    status:contactCount?'isolated_exact_line_arc_contacts' as const:'disjoint_exact_line_arc' as const};
}
