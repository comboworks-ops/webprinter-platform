import test from 'node:test';
import assert from 'node:assert/strict';
import {intersectSourceShapeExactOffsetLines,signSourceShapeTwoRadicals,constructSourceShapeExactOffsetLines,type ExactOffsetLine} from './sourceShapeLineContacts';
const line=(id:number,origin:[number,number],direction:[number,number]):ExactOffsetLine=>({segment:id,
  origin:origin.map(String) as [string,string],direction:direction.map(String) as [string,string],radius:'1',normalSign:1,scale2Exponent:0});
test('two radical signs preserve cancellation, equal magnitudes and very small exact differences',()=>{
  assert.equal(signSourceShapeTwoRadicals(0n,1n,2n,-1n,2n),0);
  assert.equal(signSourceShapeTwoRadicals(0n,1n,2n,-1n,3n),-1);
  assert.equal(signSourceShapeTwoRadicals(0n,-1n,2n,1n,3n),1);
  assert.equal(signSourceShapeTwoRadicals(1n,1n,2n,-1n,3n),1);
  assert.equal(signSourceShapeTwoRadicals(-1n,-1n,2n,1n,3n),-1);
  const n=1n<<1000n;
  assert.equal(signSourceShapeTwoRadicals(0n,1n,n*n+1n,-1n,n*n),1);
  assert.equal(signSourceShapeTwoRadicals(0n,1n,n*n-1n,-1n,n*n),-1);
  assert.throws(()=>signSourceShapeTwoRadicals(0n,1n,-1n,1n,2n));
});
test('outward square-corner supports intersect outside their closed native branches',()=>{
  const r=intersectSourceShapeExactOffsetLines(line(0,[0,0],[10,0]),line(1,[10,0],[0,10]));
  assert.equal(r.status,'disjoint_exact_line_branches');assert.equal(r.relation,'nonparallel_support_intersection');
  if(r.relation!=='nonparallel_support_intersection')throw Error('Expected exact parameters');
  assert.equal(r.membership.onA.endSign,1);assert.equal(r.membership.onB.startSign,-1);
});
test('reentrant straight branches have one exact interior contact without choosing a trim',()=>{
  const r=intersectSourceShapeExactOffsetLines(line(0,[0,0],[10,0]),line(1,[10,0],[0,-10]));
  assert.equal(r.status,'isolated_exact_line_contact');
  if(r.relation!=='nonparallel_support_intersection')throw Error('Expected exact parameters');
  assert.deepEqual(r.membership,{onA:{startSign:1,endSign:-1,onClosedBranch:true},onB:{startSign:1,endSign:-1,onClosedBranch:true}});
});
test('collinear native branches retain exact singleton endpoints, overlap intervals and disjoint intervals',()=>{
  const a=line(0,[0,0],[10,0]);
  const end=intersectSourceShapeExactOffsetLines(a,line(1,[10,0],[10,0]));
  assert.equal(end.relation,'coincident_single_endpoint');
  if(end.relation!=='coincident_single_endpoint')throw Error('Expected endpoint');
  assert.deepEqual(end.endpoints[0],{onA:{numerator:'1',denominator:'1'},onB:{numerator:'0',denominator:'1'}});
  const overlap=intersectSourceShapeExactOffsetLines(a,line(1,[5,0],[10,0]));assert.equal(overlap.status,'exact_coincident_line_overlap');
  assert.equal(intersectSourceShapeExactOffsetLines(a,line(1,[11,0],[10,0])).status,'disjoint_exact_line_branches');
});
test('opposed normals can produce exact coincident branches; nearby parallel supports remain distinct',()=>{
  const a=line(0,[0,0],[10,0]),b=line(1,[10,-2],[-10,0]);
  const overlap=intersectSourceShapeExactOffsetLines(a,b);assert.equal(overlap.relation,'coincident_interval_overlap');
  if(overlap.relation!=='coincident_interval_overlap')throw Error('Expected overlap');
  assert.deepEqual(overlap.endpoints,[{onA:{numerator:'0',denominator:'1'},onB:{numerator:'1',denominator:'1'}},
    {onA:{numerator:'1',denominator:'1'},onB:{numerator:'0',denominator:'1'}}]);
  assert.equal(intersectSourceShapeExactOffsetLines(a,line(1,[10,-3],[-10,0])).relation,'parallel_distinct_supports');
});
test('construction preserves straight native source controls and excludes cubic substitutions',()=>{
  const path=[{operator:'l' as const,pointsPt:[[0,0],[1,0]] as [number,number][]},
    {operator:'c' as const,pointsPt:[[1,0],[1,1],[0,1],[0,0]] as [number,number][]}];
  const original=JSON.stringify(path);const result=constructSourceShapeExactOffsetLines(path,3,1,-52);
  assert.equal(result.length,1);assert.equal(result[0].segment,0);assert.equal(JSON.stringify(path),original);
  assert.throws(()=>constructSourceShapeExactOffsetLines(path,3,1,0),/bits/);
});
test('foreign radius, normal orientation, pair identity and zero tangent refuse',()=>{
  const a=line(0,[0,0],[10,0]),b=line(1,[1,1],[0,10]);
  for(const changed of [{...b,radius:'2'},{...b,normalSign:-1 as const},{...b,scale2Exponent:1},
    {...b,direction:['0','0'] as [string,string]},{...b,segment:0}])assert.throws(()=>intersectSourceShapeExactOffsetLines(a,changed));
});
