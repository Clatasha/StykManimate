import test from 'node:test';
import assert from 'node:assert/strict';
import {MotionDocument} from '../src/motion-document.mjs';
import {Editor} from '../src/editor.mjs';
import {validateScene} from '../src/pivot/model.mjs';
import {buildContainerV2,decodeDocument} from '../src/native-container.mjs';

const points=()=>[[100,30],[95,28],[105,28],[90,30],[110,30],[80,65],[120,65],[65,100],[135,100],[50,120],[150,120],[85,140],[115,140],[80,195],[120,195],[75,250],[125,250]];
const header={width:640,height:360,fps:30,sourceStart:0};
const frame=(tick,actors)=>({tick,actors,review:false});

test('capture joints remain at the detected coordinates in native geometry and after save/reopen',async()=>{
  const builder=new MotionDocument(header),p=points();
  builder.append(frame(0,[{id:1,points:p}]));
  builder.append({...frame(1,[{id:1,points:p.map(([x,y])=>[x+12,y])}]),review:true});
  const report=builder.finish({frames:2});
  validateScene(report);
  const editor=new Editor({demo:false});editor.load(report);
  assert.equal(editor.totalTicks,2);
  const geometry=editor.geometry.objects.get(0);
  for(const [joint,index] of [[3,5],[4,7],[5,9],[6,6],[7,8],[8,10],[9,11],[10,13],[11,15],[12,12],[13,14],[14,16]]){
    const actual=geometry.joints.get(joint);
    assert.ok(Math.abs(actual.x-p[index][0])<1e-7,`joint ${joint} x`);
    assert.ok(Math.abs(actual.y-p[index][1])<1e-7,`joint ${joint} y`);
  }
  editor.seek(1);assert.equal(editor.object.root_x,112);
  const encoded=await buildContainerV2(editor.serialize(),'styk');
  const decoded=await decodeDocument(encoded,'styk');
  const reopened=new Editor({demo:false});reopened.load(decoded.document);
  assert.equal(reopened.totalTicks,2);reopened.seek(1);
  assert.equal(reopened.object.root_x,112);
  assert.deepEqual(reopened.report._styk.motionCapture.reviewFrames,[1]);
  reopened.beginDrag();reopened.object.root_x+=20;reopened.touch();reopened.commitDrag();
  assert.equal(reopened.object.root_x,132);reopened.undo();assert.equal(reopened.object.root_x,112);
});

test('gaps and new actor identities preserve timing without freezing missing people',()=>{
  const builder=new MotionDocument(header);
  builder.append(frame(0,[{id:1,points:points()}]));builder.append(frame(1,[]));builder.append(frame(2,[{id:2,points:points()}]));
  const report=builder.finish({frames:3});validateScene(report);
  const editor=new Editor({demo:false});editor.load(report);editor.seek(1);
  assert.equal(editor.frame.objects.length,0);editor.seek(2);assert.equal(editor.frame.objects[0].unique_id,2);
});

test('partial responses, duplicate actors and invalid joints cannot become projects',()=>{
  const builder=new MotionDocument(header);
  assert.throws(()=>builder.append(frame(1,[])),/out-of-order/);
  assert.throws(()=>builder.append(frame(0,[{id:1,points:[]}])) ,/invalid body joints/);
  assert.throws(()=>builder.finish({frames:0}),/No people/);
  builder.append(frame(0,[{id:1,points:points()}]));
  assert.throws(()=>builder.finish({frames:2}),/before every frame/);
  assert.throws(()=>builder.append(frame(1,[{id:1,points:points()},{id:1,points:points()}])),/identity/);
});
