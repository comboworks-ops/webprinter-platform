import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEllipseOffsetGeometry,ellipseOffsetSvgPath} from './ellipseOffsetGeometry.ts';

// Independent nearest-point search on the original ellipse. A coarse global
// scan finds each local minimum, followed by golden-section refinement; this
// uses neither the implementation's normal nor its interpolation error formula.
function distanceToEllipse(x:number,y:number,a:number,b:number) {
 const f=(t:number)=>(a*Math.cos(t)-x)**2+(b*Math.sin(t)-y)**2;
 const n=128,h=2*Math.PI/n;
 let best=Infinity;
 for(let i=0;i<n;i++) {
  const center=i*h;
  if (f(center)>f(center-h) || f(center)>f(center+h)) continue;
  let lo=center-h,hi=center+h;
  for(let j=0;j<70;j++) {
   const l=hi-(hi-lo)*0.6180339887498949,r=lo+(hi-lo)*0.6180339887498949;
   if(f(l)<f(r))hi=r;else lo=l;
  }
  best=Math.min(best,f((lo+hi)/2));
 }
 return Math.sqrt(best);
}

test('normal-distance paths and their chords meet the physical distance budget in both orientations',()=>{
 for(const [w,h,b,s] of [[104,154,3,3],[154,104,3,3],[10,10,3,3],[40,120,2,3],[250,35,3,1]]) {
  const g=buildEllipseOffsetGeometry(w,h,b,s);
  for(const path of [g.cut,g.bleed,g.safe]) {
   assert.ok(path.maxErrorMm<=0.001);
   assert.ok(path.segmentCount<=8192 && path.segmentCount%4===0);
   for(let i=0;i<path.points.length;i+=Math.max(1,Math.floor(path.points.length/48))) {
    const p=path.points[i],q=path.points[(i+1)%path.points.length];
    for(const u of [0,0.25,0.5,0.75]) {
     const x=p[0]+u*(q[0]-p[0])-w/2-b,y=p[1]+u*(q[1]-p[1])-h/2-b;
     const measured=distanceToEllipse(x,y,w/2,h/2);
     assert.ok(Math.abs(measured-Math.abs(path.offsetMm))<=path.maxErrorMm+1e-9,`${w}x${h} ${path.offsetMm}: ${measured}`);
    }
   }
   // Strictly convex ordered vertices imply a simple closed polygon.
   for(let i=0;i<path.points.length;i++) {
    const a=path.points[i],b=path.points[(i+1)%path.points.length],c=path.points[(i+2)%path.points.length];
    assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0);
   }
  }
 }
});
test('exact extrema, closed vectors and deterministic regeneration preserve entered dimensions',()=>{
 const g=buildEllipseOffsetGeometry(104,154,3,3);
 assert.deepEqual(g,buildEllipseOffsetGeometry(104,154,3,3));
 assert.equal(g.minCurvatureRadiusMm,52*52/77);
 for(const path of [g.cut,g.bleed,g.safe]) {
  const xs=path.points.map(p=>p[0]),ys=path.points.map(p=>p[1]);
  assert.ok(Math.abs(Math.max(...xs)-Math.min(...xs)-(104+2*path.offsetMm))<1e-10);
  assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-(154+2*path.offsetMm))<1e-10);
  const d=ellipseOffsetSvgPath(path,72/25.4);
  assert.ok(d.startsWith('M ') && d.endsWith(' Z'));
  assert.equal(d.match(/ L /g)?.length,path.segmentCount-1);
 }
});
test('elongated, singular, near-singular and unbounded geometry fail rather than falling back to reduced axes',()=>{
 for(const args of [[10,100,3,3],[10,100,3,0.5],[10,100,3,0.497],
  [10,10,3,5],[0,10,3,3],[NaN,10,3,3],[10,Infinity,3,3],[104,154,-3,3],
  [104,154,3,3,0.1],[104,154,3,3,1e-9],[10001,10001,3,3]]) {
  assert.throws(()=>buildEllipseOffsetGeometry(...args as [number,number,number,number,number?]));
 }
 // Regular but costly offset is refused by the bounded vector budget.
 assert.throws(()=>buildEllipseOffsetGeometry(10000,100,3,0.1,1e-6),/vektorbudget/);
 assert.throws(()=>ellipseOffsetSvgPath(buildEllipseOffsetGeometry(10,10,3,3).cut,0));
 assert.throws(()=>ellipseOffsetSvgPath(buildEllipseOffsetGeometry(10,10,3,3).cut,1e308));
});
test('a reduced-axis ellipse differs materially from the true safe offset away from the extrema',()=>{
 const g=buildEllipseOffsetGeometry(104,154,3,3),a=52,b=77;
 const reducedX=(a-3)*Math.cos(Math.PI/4),reducedY=(b-3)*Math.sin(Math.PI/4);
 assert.ok(Math.abs(distanceToEllipse(reducedX,reducedY,a,b)-3)>0.04);
 const p=g.safe.points[g.safe.segmentCount/8];
 assert.ok(Math.abs(distanceToEllipse(p[0]-a-3,p[1]-b-3,a,b)-3)<1e-9);
});
