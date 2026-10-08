import test from 'node:test';
import assert from 'node:assert/strict';
import {preserveBrochureSerializationGeometry,type BrochureSerializableGeometry} from './brochureGeometry.ts';

function roundedObject(values: Record<string,number>,children?:BrochureSerializableGeometry[]):BrochureSerializableGeometry {
  return {...values,getObjects:children?()=>children:undefined,toObject(properties){
    return {...Object.fromEntries(Object.keys(values).map(key=>[key,Math.round(Number(this[key])*100)/100])),
      data:{source:'original-vector-pdf'},included:properties,...(children?{objects:children.map(child=>child.toObject(properties))}:{})};
  }};
}
test('brochure PDF clone/save geometry retains a 1:1 source placement despite Fabric two-decimal rounding',()=>{
  const originalScale=432/998,object=roundedObject({width:998,height:1400,scaleX:originalScale,scaleY:606/1400,left:316,top:403,angle:0});
  assert.notEqual(Number(object.toObject().scaleX)*998/432,1);
  preserveBrochureSerializationGeometry(object);
  const saved=JSON.parse(JSON.stringify(object.toObject(['data'])));
  assert.equal(saved.scaleX*saved.width/432,1);assert.equal(saved.scaleY*saved.height/606,1);
  assert.deepEqual(saved.data,{source:'original-vector-pdf'});assert.deepEqual(saved.included,['data']);
});
test('linked group geometry, moved artwork and repeated wrapping retain full precision without touching other objects',()=>{
  const child=roundedObject({scaleX:Number('0.43286573146292587'),left:132.3456789,top:74.56789123,angle:13.78901234});
  const group=roundedObject({scaleX:.97341234,left:54.67891234},[child]),unrelated=roundedObject({scaleX:Number('0.43286573146292587')});
  preserveBrochureSerializationGeometry(group);const wrapped=group.toObject;preserveBrochureSerializationGeometry(group);
  assert.equal(group.toObject,wrapped);
  // Canvas serialization temporarily applies ActiveSelection's absolute transform.
  child.left=248.12345678;
  const saved=JSON.parse(JSON.stringify(group.toObject()));
  assert.equal(saved.left,54.67891234);assert.equal(saved.objects[0].left,248.12345678);
  assert.equal(saved.objects[0].angle,13.78901234);assert.equal(unrelated.toObject().scaleX,.43);
});
