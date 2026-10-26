import {chromium} from './support/playwright.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {startBackend}=createRequire(import.meta.url)('../desktop/backend.cjs'),resourcesPath=process.env.STYK_PACKAGED_RESOURCES;
const backend=process.env.STYK_URL?null:await startBackend({appRoot:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),resourcesPath,packaged:Boolean(resourcesPath)});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('artifacts',{recursive:true});await page.goto(process.env.STYK_URL||backend.origin);await page.waitForFunction(()=>window.styk?.ready,{timeout:60000});
 await page.evaluate(()=>{void styk.actions['generate-scene']();});const dialog=page.locator('.scene-dialog');await dialog.waitFor();
 const previews=new Set();
 for(const location of ['rooftop','street','forest','arena','studio'])for(const lighting of ['day','sunset','night']){
  await dialog.locator('[data-field="location"]').selectOption(location);await dialog.locator('[data-field="lighting"]').selectOption(lighting);
  const pixels=await dialog.locator('canvas').evaluate(c=>c.toDataURL());previews.add(pixels);
  await writeFile(`artifacts/scenery-preview-${location}-${lighting}.png`,Buffer.from(pixels.split(',')[1],'base64'));
 }
 assert.equal(previews.size,15,'each location and lighting has distinct native artwork');
 await dialog.locator('.ui-dialog-close').click();
 const rendered=await page.evaluate(async()=>{
  const {generateScene}=await import('/src/scene-generator.mjs'),{Editor}=await import('/src/editor.mjs'),{buildGeometry}=await import('/src/pivot/geometry.mjs'),{drawExportScene}=await import('/src/export-frame-core.mjs'),{PlaybackResources}=await import('/src/playback-resources.mjs');
  const results=[];
  for(const location of ['rooftop','street','forest','arena','studio']){
   const g=generateScene({location,lighting:location==='forest'?'day':location==='studio'?'sunset':'night',direction:'cinematic',effects:false,randomize:true,seed:17});let next;do{next=g.next();}while(!next.done);
   const e=new Editor({demo:false,layerTimeline:true}).load(next.value);e.seek(275);const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d'),resources=new PlaybackResources();
   try{drawExportScene(ctx,e.report,e.evaluatedFrame,buildGeometry(e.report,e.evaluatedFrame),resources);const data=ctx.getImageData(0,0,960,540).data;
    let transparent=0;const colors=new Set();for(let i=0;i<data.length;i+=4){if(data[i+3]!==255)transparent++;if(i%128===0)colors.add(`${data[i]},${data[i+1]},${data[i+2]}`);}
    results.push({location,transparent,colors:colors.size,png:canvas.toDataURL()});
   }finally{resources.dispose();}
  }return results;
 });
 for(const row of rendered){assert.equal(row.transparent,0,`${row.location} fills the camera frame`);assert.ok(row.colors>50,`${row.location} contains rendered scenery`);await writeFile(`artifacts/scenery-export-${row.location}.png`,Buffer.from(row.png.split(',')[1],'base64'));delete row.png;}
 assert.deepEqual(errors,[]);console.log('PASS 15 live background previews and five native exports with directed cameras',rendered);
}finally{await browser.close();backend?.stop();}
