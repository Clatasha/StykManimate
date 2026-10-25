import {chromium} from './support/playwright.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url),{startBackend}=require('../desktop/backend.cjs');
const resourcesPath=process.env.STYK_PACKAGED_RESOURCES;
const backend=process.env.STYK_URL?null:await startBackend({appRoot:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),resourcesPath,packaged:Boolean(resourcesPath)});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.STYK_URL||backend.origin);await page.waitForFunction(()=>window.styk?.ready,{timeout:60000});
 const before=await page.evaluate(()=>styk.editor.report._styk.name);
 assert.equal(await page.evaluate(()=>typeof styk.actions['import-motion']),'undefined');
 await page.evaluate(()=>{void styk.actions['generate-scene']();});
 const dialog=page.locator('.scene-dialog');await dialog.waitFor();
 await dialog.locator('[data-generate]').click();assert.match(await dialog.locator('.ui-dialog-error').textContent(),/Include an action/);
 await dialog.locator('[data-field="length"]').selectOption('custom');await dialog.locator('[data-field="duration"]').fill('600');await dialog.locator('[data-field="people"]').selectOption('4');
 await dialog.locator('[data-random]').click();await dialog.locator('[data-cancel]').click();assert.match(await dialog.locator('[data-status]').textContent(),/cancelled/);assert.equal(await page.evaluate(()=>styk.editor.report._styk.name),before);
 await dialog.locator('[data-field="length"]').selectOption('60');await dialog.locator('[data-field="people"]').selectOption('2');
 await dialog.locator('[data-field="prompt"]').fill('Red walks, red punches, blue dodges, blue kicks, red falls, red gets up. Add camera shake and glow.');
 await dialog.locator('[data-generate]').click();await dialog.locator('[data-open]').waitFor({state:'visible',timeout:60000});assert.match(await dialog.locator('[data-status]').textContent(),/60 seconds · 1440 editable frames/);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/scene-generator.png'});
 await dialog.locator('[data-open]').click();await dialog.waitFor({state:'detached',timeout:60000});
 const result=await page.evaluate(()=>{const e=styk.editor;return {ticks:e.totalTicks,dirty:e.dirty,people:e.report.figure_types.length,motion:e.report._styk.cameraMotion.clips.length,effects:e.report._styk.vfxClips.clips.length};});assert.equal(result.ticks,1440);assert.equal(result.dirty,true);assert.equal(result.people,2);assert.ok(result.motion);assert.ok(result.effects);
 await page.evaluate(()=>{const e=styk.editor,b=e.report._styk.sceneGenerator.beats.find(b=>b.actions.includes('punch'));e.seek(Math.round((b.start+b.duration*.5)*24));});await page.waitForTimeout(300);await page.screenshot({path:'artifacts/scene-editor.png'});
 await page.evaluate(()=>styk.actions['first-frame']());await page.evaluate(()=>{void styk.actions.play();});await page.waitForFunction(()=>styk.editor.tick>8,{timeout:60000});await page.evaluate(()=>styk.actions.play());
 const saved=await page.evaluate(async()=>{
  const {DocumentExporter}=await import('/src/document-export.mjs'),{ImportClient}=await import('/src/import-client.mjs'),{Editor}=await import('/src/editor.mjs');
  const exporter=new DocumentExporter(),importer=new ImportClient();
  try{const source=styk.editor.report,bytes=await exporter.export(source,{format:'styk',name:'scene-test'}),decoded=await importer.importFile(new File([bytes],'scene-test.styk')),e=new Editor({demo:false,layerTimeline:true}).load(decoded.document);
   const samples=[0,155,720,1439].map(t=>{e.seek(t);return e.evaluatedFrame.objects.map(o=>[o.unique_id,o.root_x,o.root_y,...o.angles]);});
   const expected=[0,155,720,1439].map(t=>{styk.editor.seek(t);return styk.editor.evaluatedFrame.objects.map(o=>[o.unique_id,o.root_x,o.root_y,...o.angles]);});
   return {ticks:e.totalTicks,motion:e.report._styk.cameraMotion.clips.length,effects:e.report._styk.vfxClips.clips.length,same:JSON.stringify(samples)===JSON.stringify(expected),seed:e.report._styk.sceneGenerator.seed};
  }finally{exporter.dispose();importer.dispose();}
 });assert.equal(saved.ticks,1440);assert.equal(saved.same,true);assert.equal(saved.motion,result.motion);assert.equal(saved.effects,result.effects);
 await page.evaluate(()=>{void styk.actions['generate-scene']();});await dialog.waitFor();await dialog.locator('[data-field="length"]').selectOption('120');await dialog.locator('[data-random]').click();await dialog.locator('[data-open]').waitFor({state:'visible',timeout:60000});assert.match(await dialog.locator('[data-status]').textContent(),/120 seconds · 2880 editable frames/);await dialog.locator('.ui-dialog-close').click();assert.equal(await page.evaluate(()=>styk.editor.totalTicks),1440);
 assert.deepEqual(errors,[]);console.log('PASS 60-second prompt → native editor → STYK save/reopen; 120-second random; cancellation',result,saved);
}finally{await browser.close();backend?.stop();}
