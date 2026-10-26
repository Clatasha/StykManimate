import {chromium} from './support/playwright.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {startBackend}=createRequire(import.meta.url)('../desktop/backend.cjs'),resourcesPath=process.env.STYK_PACKAGED_RESOURCES;
const backend=process.env.STYK_URL?null:await startBackend({appRoot:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),resourcesPath,packaged:Boolean(resourcesPath)});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[],messages=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')messages.push(m.text().slice(0,500));});
try{
 await mkdir('artifacts',{recursive:true});await page.goto(process.env.STYK_URL||backend.origin);await page.waitForFunction(()=>window.styk?.ready,{timeout:60000});
 await page.evaluate(()=>{void styk.actions['generate-scene']();});const dialog=page.locator('.scene-dialog');await dialog.waitFor();await dialog.locator('[data-demo]').click();await dialog.locator('[data-open]').waitFor({state:'visible',timeout:60000});
 assert.match(await dialog.locator('[data-status]').textContent(),/15 seconds · 360 editable frames/);
 await dialog.locator('[data-hyperframes]').click();const presentation=page.locator('.scene-presentation-dialog');await presentation.waitFor();
 try{await page.waitForFunction(()=>document.querySelector('.scene-presentation [role="status"]')?.textContent.includes('Ready'),{timeout:30000});}catch(error){console.log('DEBUG',messages,errors);for(const f of page.frames()){try{console.log(f.url(),await f.evaluate(()=>({ready:document.readyState,player:!!window.__player,sources:window.__hfHasFrameSources?.(),native:window.stykPresentationTick,html:document.body?.innerHTML.slice(0,200),srcdoc:document.querySelector('hyperframes-player')?.getAttribute('srcdoc')?.length})));}catch{}}throw error;}
 const outer=page.frames().find(f=>f.url().includes('hyperframes-preview.html'));
 const inner=outer.childFrames()[0];assert.ok(inner);
 await outer.evaluate(()=>document.querySelector('hyperframes-player').seek(4.5));await inner.waitForFunction(()=>window.stykPresentationTick===108);
 await page.screenshot({path:'artifacts/hyperframes-preview.png'});
 const a=await inner.locator('canvas').evaluate(c=>c.toDataURL());await outer.evaluate(()=>document.querySelector('hyperframes-player').seek(.5));await inner.waitForFunction(()=>window.stykPresentationTick===12);
 await outer.evaluate(()=>document.querySelector('hyperframes-player').seek(4.5));await inner.waitForFunction(()=>window.stykPresentationTick===108);assert.equal(await inner.locator('canvas').evaluate(c=>c.toDataURL()),a);
 assert.equal(await outer.evaluate(()=>!!document.querySelector('hyperframes-player').shadowRoot.querySelector('iframe')),true);
 const downloadPromise=page.waitForEvent('download');await presentation.getByRole('button',{name:'Save Hyperframes HTML'}).click();const download=await Promise.race([downloadPromise,presentation.locator('.ui-dialog-error').waitFor({state:'visible'}).then(async()=>{throw new Error(await presentation.locator('.ui-dialog-error').textContent());})]);await download.saveAs('artifacts/action-hyperframes.html');
 await presentation.locator('.ui-dialog-close').click();await dialog.locator('[data-open]').click();await dialog.waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>styk.editor.totalTicks),360);assert.equal(await page.evaluate(()=>styk.editor.dirty),true);
 await page.evaluate(()=>{styk.editor.select(1);styk.editor.moveSelection(10,0);void styk.actions['hyperframes-presentation']();});await presentation.waitFor();await page.waitForFunction(()=>document.querySelector('.scene-presentation [role="status"]')?.textContent.includes('Ready'),{timeout:30000});await presentation.locator('.ui-dialog-close').click();
 assert.deepEqual(errors,[]);console.log('PASS action demo → genuine Hyperframes player → deterministic seeks → self-contained HTML; native editability');
}finally{await browser.close();backend?.stop();}
