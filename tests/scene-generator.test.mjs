import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScene,planScene,compatibleSceneFigure} from '../src/scene-generator.mjs';
import {Editor} from '../src/editor.mjs';
import {defaultFigure} from '../src/demo.mjs';
import {validateScene} from '../src/pivot/model.mjs';
import {validateCameraMotion} from '../src/camera-motion.mjs';
import {validateVfxClips} from '../src/vfx-clips.mjs';
function generate(options){const g=generateScene(options);let next;do{next=g.next();}while(!next.done);return next.value;}
test('60 second random scene has a complete editable native timeline, continuous roots and finite poses',()=>{
 const report=generate({randomize:true,seed:12});validateScene(report);validateCameraMotion(report._styk.cameraMotion);validateVfxClips(report._styk.vfxClips);
 const e=new Editor({demo:false,layerTimeline:true}).load(report);assert.equal(e.totalTicks,1440);assert.equal(report.keyframes.length,1440);
 const ids=report.keyframes[0].objects.map(o=>o.unique_id);
 for(let i=0;i<report.keyframes.length;i++){
  const frame=report.keyframes[i];assert.deepEqual(frame.objects.map(o=>o.unique_id),ids);
  for(const [j,o] of frame.objects.entries()){
   assert.ok([o.root_x,o.root_y,...o.angles].every(Number.isFinite));
   if(i)assert.ok(Math.abs(o.root_x-report.keyframes[i-1].objects[j].root_x)<4,'no horizontal teleport between beats');
  }
 }
 e.seek(720);assert.equal(e.evaluatedFrame.objects.length,2);assert.ok(e.geometry);
 assert.ok(report._styk.cameraMotion.clips.length);assert.ok(report._styk.vfxClips.clips.length);
});
test('prompt action and actor ordering is explicit; full length includes opening and ending',()=>{
 const plan=planScene({prompt:'Red punches, blue dodges, blue kicks, red falls, red gets up. Add shake and Glow.',duration:120});
 assert.deepEqual(plan.beats.slice(1,6).map((b,i)=>b.actions[[0,1,1,0,0][i]]),['punch','dodge','kick','fall','get up']);
 assert.equal(plan.beats.at(-1).start+plan.beats.at(-1).duration,120);assert.ok(plan.requestedEffects.includes('Glow'));
 const report=generate({prompt:plan.prompt,duration:120});assert.equal(report.keyframes.length,2880);assert.ok(report._styk.vfxClips.clips.some(c=>c.name==='Glow'));
});
test('unsupported prompts fail visibly and invalid lengths never silently become short clips',()=>{
 assert.throws(()=>planScene({prompt:'Make an epic movie'}),/Include an action/);
 for(const duration of [0,10,59,60.5,601,NaN])assert.throws(()=>planScene({duration,randomize:true}),/60 to 600/);
 assert.throws(()=>planScene({people:5,randomize:true}),/one to four/);
});
test('seeded variations reproduce; all themes and maximum length stay within native limits',()=>{
 assert.deepEqual(planScene({randomize:true,seed:42}),planScene({randomize:true,seed:42}));
 assert.notDeepEqual(planScene({randomize:true,seed:42}),planScene({randomize:true,seed:43}));
 for(const theme of ['fight','chase','comedy','everyday','surprise']){
  const report=generate({duration:600,people:4,randomize:true,theme,seed:19});assert.equal(report.keyframes.length,14400);validateScene(report);validateCameraMotion(report._styk.cameraMotion);validateVfxClips(report._styk.vfxClips);
 }
});
test('effects toggle omits all clips; compatible custom figures retain artwork without mutating the source',()=>{
 const figure=defaultFigure(77);figure.segments[0].color_rgb=[1,2,3];assert.equal(compatibleSceneFigure(figure),true);
 const before=JSON.stringify(figure),report=generate({prompt:'walk and wave with glow and shake',figure,effects:false});
 assert.equal(JSON.stringify(figure),before);assert.deepEqual(report.figure_types[0].segments[0].color_rgb,[1,2,3]);assert.deepEqual(report._styk.cameraMotion.clips,[]);assert.deepEqual(report._styk.vfxClips.clips,[]);
 assert.equal(compatibleSceneFigure({...figure,segments:[]}),false);
});
test('named native generators and scene-only effects use the correct editable clip targets',()=>{
 const report=generate({prompt:'Red jumps with Smoke, Aura, Energy beam and Shockwave.'});
 const clips=report._styk.vfxClips.clips;validateVfxClips(report._styk.vfxClips);
 for(const name of ['Smoke','Aura','Energy beam','Shockwave'])assert.ok(clips.some(c=>c.name===name));
 assert.equal(clips.find(c=>c.name==='Shockwave').target.kind,'scene');
 assert.equal(clips.find(c=>c.name==='Aura').target.kind,'figure');
});
