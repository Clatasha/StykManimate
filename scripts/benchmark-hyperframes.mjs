import {chromium} from '../tests/support/playwright.mjs';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const input=path.resolve(process.env.STYK_HYPERFRAMES_HTML||'artifacts/action-hyperframes.html'),out='artifacts/action-hyperframes.mp4';
await mkdir('artifacts',{recursive:true});const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const encoder=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','24','-i','pipe:0','-an','-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',out],{stdio:['pipe','ignore','pipe']});let encoderErrors='';encoder.stderr.on('data',b=>encoderErrors+=b);const encoded=once(encoder,'close');
try{
 await page.goto(pathToFileURL(input).href);await page.waitForFunction(()=>typeof window.__player?.seek==='function'&&window.stykPresentationTick===0,{timeout:30000});
 const duration=await page.locator('[data-composition-id]').first().getAttribute('data-duration'),frames=Math.round(Number(duration)*24),started=performance.now();
 for(let i=0;i<frames;i++){
  await page.evaluate(async t=>{await window.__player.renderSeek(t,{exact:true});},i/24);await page.waitForFunction(tick=>window.stykPresentationTick===tick,i);
  const png=await page.screenshot({type:'png'});if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');
  if(i%72===0)console.log(`${i}/${frames} frames`);
 }
 encoder.stdin.end();const [code]=await encoded;if(code)throw new Error(encoderErrors);if(errors.length)throw new Error(errors.join('\n'));
 const seconds=(performance.now()-started)/1000,result={frames,videoSeconds:Number(duration),renderSeconds:+seconds.toFixed(2),captureFPS:+(frames/seconds).toFixed(2),size:[960,540],fps:24,encoder:'libx264 veryfast',browser:'headless Chromium; no RTX 3060 benchmark'};
 await writeFile('artifacts/hyperframes-performance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{encoder.kill();await browser.close();}
