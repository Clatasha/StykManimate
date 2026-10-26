import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScene,planScene} from '../src/scene-generator.mjs';
import {actionPose,FIGHT_STYLES} from '../src/fight-choreography.mjs';
import {defaultFigure} from '../src/demo.mjs';
import {validateScene} from '../src/pivot/model.mjs';
import {sceneActorBounds} from '../src/scene-direction.mjs';
const plan=options=>planScene({randomize:true,...options});
const signature=p=>p.beats.slice(0,8).map(b=>b.actions.join('/')).join('|');
function generate(options){const g=generateScene(options);let n;do{n=g.next();}while(!n.done);return n.value;}
test('fresh seeds change the opening and early exchanges, instead of sharing a fixed four-beat intro',()=>{
 const plans=Array.from({length:40},(_,seed)=>plan({seed}));
 assert.ok(new Set(plans.map(signature)).size>=38);
 assert.ok(new Set(plans.map(p=>p.beats[0].actions.join('/'))).size>=3);
 const moves=new Set(plans.flatMap(p=>p.beats.flatMap(b=>b.actions)));
 for(const move of ['elbow','knee','roundhouse','backkick','roll','sidestep','feint'])assert.ok(moves.has(move),move);
 assert.deepEqual(plan({seed:14}),plan({seed:14}),'same settings and seed remain reproducible');
});
test('styles change actual attack vocabulary and rhythm, not just labels or camera effects',()=>{
 const plans=Object.keys(FIGHT_STYLES).map(fightStyle=>plan({seed:23,fightStyle}));
 assert.equal(new Set(plans.map(signature)).size,plans.length);
 const boxing=plans[1].beats.flatMap(b=>b.actions);
 for(const move of ['kick','roundhouse','backkick','aerialkick','cartwheel','flip'])assert.ok(!boxing.includes(move));
 assert.ok(plans[2].beats.some(b=>b.actions.includes('roundhouse')));
 assert.ok(plans[3].beats.some(b=>b.actions.includes('cartwheel')||b.actions.includes('flip')));
 assert.ok(plans[4].beats.some(b=>b.actions.includes('elbow')||b.actions.includes('knee')));
 assert.ok(plans[0].beats.some(b=>b.phase==='burst'));assert.ok(plans[0].beats.some(b=>b.phase==='recovery'||b.phase==='footwork'));
 assert.throws(()=>plan({fightStyle:'unknown'}),/fighting style/);
});
test('long choreography does not loop identical action blocks and retains whole-frame coverage',()=>{
 for(const fightStyle of Object.keys(FIGHT_STYLES)){
  const p=plan({duration:600,people:4,seed:51,fightStyle}),blocks=new Map();let tick=0;
  for(let i=0;i<p.beats.length;i++){
   const b=p.beats[i];assert.equal(b.tick,tick);assert.ok(Number.isInteger(b.count)&&b.count>0);tick+=b.count;
   if(i%6===0&&i+6<p.beats.length){const key=p.beats.slice(i,i+6).map(b=>b.actions.join('/')).join('|');blocks.set(key,(blocks.get(key)||0)+1);}
  }
  assert.equal(tick,14400);assert.ok(Math.max(...blocks.values())<=2,'six-action passages should not form a repeated loop');
 }
});
test('prompt repeats preserve requested actions while timing and defence vary',()=>{
 const p=planScene({prompt:'Red roundhouse kick, blue elbow, red cartwheel, blue back kick.',seed:8});
 const order=[[0,'roundhouse'],[1,'elbow'],[0,'cartwheel'],[1,'backkick']];
 for(let i=1;i<p.beats.length-1;i++){const [actor,action]=order[(i-1)%4];assert.equal(p.beats[i].actions[actor],action);}
 assert.ok(new Set(p.beats.filter((b,i)=>i%4===1).map(b=>b.count)).size>1);
});
test('new strikes have distinct native limb trajectories and all styles keep actors framed',()=>{
 const f=defaultFigure(),poses=['elbow','knee','roundhouse','backkick','feint','sidestep'].map(a=>actionPose(f,a,.42,400,420,1));
 assert.equal(new Set(poses.map(p=>p.angles.map(a=>a.toFixed(3)).join(','))).size,poses.length);
 for(const fightStyle of Object.keys(FIGHT_STYLES)){
  const r=generate({duration:15,sample:true,randomize:true,seed:9,fightStyle,direction:'cinematic',shadows:false,location:'none',effects:false});validateScene(r);
  for(const frame of r.keyframes){
   for(const o of frame.objects)assert.ok([o.root_x,o.root_y,...o.angles].every(Number.isFinite));
   const b=sceneActorBounds(r,frame,2),c=frame.camera,cx=480+c.x,cy=270+c.y;
   assert.ok(b.left>=cx-480*c.scale+25&&b.right<=cx+480*c.scale-25);
   assert.ok(b.top>=cy-270*c.scale+25&&b.bottom<=cy+270*c.scale-25);
  }
 }
});

test('prompted walking still travels between exchanges in Action mode',()=>{
 const r=generate({duration:15,sample:true,prompt:'Red walks, blue feints.',effects:false,location:'none',shadows:false,direction:'off'}),b=r._styk.sceneGenerator.beats[1];
 const first=r.keyframes[b.tick].objects[0],last=r.keyframes[b.tick+b.count-1].objects[0];assert.ok(Math.abs(last.root_x-first.root_x)>60);
});
