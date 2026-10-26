import test from 'node:test';
import assert from 'node:assert/strict';
import {generateScene,planScene} from '../src/scene-generator.mjs';
import {hyperframesComposition} from '../src/hyperframes-composition.mjs';
const sample=()=>{let next,g=generateScene({duration:15,sample:true,randomize:true});do{next=g.next();}while(!next.done);return next.value;};
test('HTML uses actual document timing, embeds data safely and registers native frame sources',()=>{
 const report=sample();report._styk.sceneGenerator.prompt='</script><script>bad()</script>';
 const html=hyperframesComposition(report,{baseURL:'http://127.0.0.1:1234'});
 assert.match(html,/data-duration="15"/);assert.match(html,/vendor\/hyperframes\/runtime.js/);assert.ok(!html.includes('</script><script>bad()'));
 const data=html.match(/id="styk-report">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(data)._styk.sceneGenerator.prompt,report._styk.sceneGenerator.prompt);
 report._styk.layerSheet.duration=480;assert.match(hyperframesComposition(report,{baseURL:'http://127.0.0.1'}),/data-duration="20"/);
});
test('large and imported media scenes are rejected explicitly instead of silently dropping content',()=>{
 const report=sample();report._styk.layerSheet.duration=24*121;assert.throws(()=>hyperframesComposition(report),/two minutes/);report._styk.layerSheet.duration=360;
 report.figure_types[0].image_assets=[{}];assert.throws(()=>hyperframesComposition(report),/vector scenes/);
});
test('new prompt actions recognize flying kick once and retain the explicit actor',()=>{
 const plan=planScene({duration:15,sample:true,prompt:'Red flying kick, blue uppercut, red flip.'});
 assert.equal(plan.action,true);assert.equal(plan.beats[1].actions[0],'aerialkick');assert.equal(plan.beats[2].actions[1],'uppercut');assert.equal(plan.beats[3].actions[0],'flip');
});
