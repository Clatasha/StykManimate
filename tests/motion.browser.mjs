// STYK_MOTION_VIDEO selects a short full-body test clip; the test uses real CPU
// inference. No user's video or downloaded fixture belongs in the repository.
import {chromium} from './support/playwright.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const video=process.env.STYK_MOTION_VIDEO;
if(!video)throw new Error('Set STYK_MOTION_VIDEO to a short full-body clip.');
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1040}});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(process.env.STYK_URL||'http://127.0.0.1:47831');
  await page.waitForFunction(()=>window.styk?.ready,{timeout:60000});
  // Reproduce a timed-out readiness request, then retry against the real local
  // endpoint. No inference request or partial document should be created.
  await page.evaluate(()=>{
    const original=window.fetch;
    let failed=false;
    window.fetch=(input,options)=>{
      if(String(input).includes('/api/motion/status')&&!failed){failed=true;return Promise.reject(new DOMException('signal timed out','TimeoutError'));}
      return original(input,options);
    };
  });
  await page.evaluate(()=>{void styk.actions['import-motion']();});
  const dialog=page.locator('.ui-dialog:has(.motion-capture)');
  await dialog.waitFor();
  await dialog.locator('[data-retry]').waitFor({state:'visible'});
  assert.match(await dialog.locator('[data-status]').textContent(),/Video conversion has not started/);
  assert.equal(await dialog.locator('[data-convert]').isDisabled(),true);
  await dialog.locator('[data-retry]').click();
  await dialog.locator('[data-retry]').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('.motion-capture [data-status]').textContent.includes('ready'));
  await dialog.locator('[data-field="file"]').setInputFiles(video);
  await dialog.locator('[data-field="duration"]').fill('1');
  await dialog.locator('[data-field="device"]').selectOption('cpu');
  const before=await page.evaluate(()=>styk.editor.report._styk.name);
  await dialog.locator('[data-convert]').click();
  await dialog.locator('[data-cancel]').click();
  assert.match(await dialog.locator('[data-status]').textContent(),/cancelled/);
  assert.equal(await page.evaluate(()=>styk.editor.report._styk.name),before);
  await dialog.locator('[data-convert]').click();
  await dialog.locator('[data-open]').waitFor({state:'visible',timeout:120000});
  assert.match(await dialog.locator('[data-status]').textContent(),/Finished: 30 frames/);
  assert.match(await dialog.locator('[data-result]').textContent(),/CPUExecutionProvider/);
  await page.waitForFunction(()=>document.querySelector('.motion-capture video').readyState>=2);
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/motion-preview.png'});
  await dialog.locator('[data-open]').click();
  await dialog.waitFor({state:'detached'});
  const result=await page.evaluate(()=>({frames:styk.editor.report.keyframes.length,dirty:styk.editor.dirty,
    count:styk.editor.report.figure_types.length,motion:styk.editor.report._styk.motionCapture.metrics.frames}));
  assert.deepEqual(result,{frames:30,dirty:true,count:1,motion:30});
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/motion-editor.png'});
  console.log('PASS real video → pose stream → preview → editable unsaved project',result);
  // Closing while a new status request is pending must abort that request,
  // rather than keeping the local service alive or writing into a stale modal.
  await page.evaluate(()=>{
    const original=window.fetch;
    window.fetch=(input,options)=>{
      if(String(input).includes('/api/motion/status')){
        window.motionReadinessSignal=options.signal;
        return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));
      }
      return original(input,options);
    };
    void styk.actions['import-motion']();
  });
  await dialog.waitFor();
  await dialog.locator('.ui-dialog-close').click();
  await dialog.waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>window.motionReadinessSignal.aborted),true);
  console.log('PASS readiness timeout → retry → conversion; closing aborts pending readiness');
}finally{await browser.close();}
