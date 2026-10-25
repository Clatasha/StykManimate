import {createDialog} from './ui/ui-dialog.mjs';
import {applyDocumentChunk} from './document-transport.mjs';

const seconds=value=>`${Math.max(0,value).toFixed(1)} s`;

export async function showMotionCapture({overlays,token='',onImport,baseURL=location.origin}) {
  const body=document.createElement('div');body.className='motion-capture';
  body.innerHTML=`<p>Convert a short sample first to measure speed and check movement quality. Video is processed on this computer.</p>
    <label>Video file (up to 256 MB)<input data-field="file" type="file" accept="video/*,.mp4,.mkv,.mov,.webm,.avi"></label>
    <div class="motion-options">
      <label>Start (seconds)<input data-field="start" type="number" min="0" max="86400" step="0.1" value="0"></label>
      <label>Length (seconds)<input data-field="duration" type="number" min="0.1" max="600" step="0.1" value="10"></label>
      <label>People<select data-field="people"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option></select></label>
      <label>Capture FPS<select data-field="fps"><option>15</option><option selected>30</option><option>60</option></select></label>
      <label>Quality<select data-field="mode"><option value="lightweight">Fast</option><option value="balanced">Balanced</option></select></label>
      <label>Processor<select data-field="device"><option value="gpu">GPU (required)</option><option value="cpu">CPU test</option></select></label>
      <label>Smoothing<select data-field="smoothing"><option value="0">Off</option><option value="0.2" selected>Light</option><option value="0.45">Medium</option></select></label>
    </div>
    <p>Tracks the largest visible people. Overlapping fighters, hidden limbs and camera cuts may need corrections. Audio and props are not converted.</p>
    <div class="motion-previews"><video controls preload="metadata" aria-label="Original video"></video><canvas aria-label="Captured stick figure preview" width="480" height="270"></canvas></div>
    <p data-status role="status" aria-live="polite">Checking motion runtime…</p>
    <progress max="1" value="0" aria-label="Capture progress"></progress>
    <p data-result></p>
    <div class="motion-actions"><button type="button" data-test>Test 10 seconds</button><button type="button" data-convert>Convert selected section</button><button type="button" data-cancel hidden>Cancel capture</button><button type="button" data-review hidden>Next uncertain frame</button><button type="button" data-open hidden>Open editable animation</button></div>`;
  const field=name=>body.querySelector(`[data-field="${name}"]`),status=body.querySelector('[data-status]'),result=body.querySelector('[data-result]');
  const video=body.querySelector('video'),canvas=body.querySelector('canvas'),ctx=canvas.getContext('2d');
  const test=body.querySelector('[data-test]'),convert=body.querySelector('[data-convert]'),cancel=body.querySelector('[data-cancel]'),open=body.querySelector('[data-open]');
  const progress=body.querySelector('progress');
  const review=body.querySelector('[data-review]');
  for(const label of body.querySelectorAll('label'))label.classList.add('ui-form-row');
  for(const input of body.querySelectorAll('input,select'))input.classList.add('ui-field-input');
  for(const button of body.querySelectorAll('button'))button.classList.add('ui-button');
  open.dataset.variant='primary';
  let worker,jobId,report,url,metrics,busy=false,available=false,timer,raf,closed=false,lastProgress,reviewIndex=0;
  const headers=()=>token?{Authorization:`Bearer ${token}`}:{ };
  const sync=()=>{test.disabled=convert.disabled=busy||!available||!field('file').files[0];for(const input of body.querySelectorAll('input,select'))input.disabled=busy;cancel.hidden=!busy;};
  function stop(){
    worker?.terminate();worker=null;
    if(jobId)void fetch(new URL(`/api/cancel?id=${jobId}`,baseURL),{method:'POST',body:'',headers:headers(),signal:AbortSignal.timeout(2000)}).catch(()=>{});
    jobId=null;busy=false;clearInterval(timer);sync();
  }
  const dialog=createDialog({title:'Video to stick figures · Preview',size:'lg',className:'motion-dialog',body,overlays,
    onSubmit:()=>false,beforeClose:()=>{stop();return true;}});
  // Keep capture/open/cancel actions visible while the options and previews
  // scroll within the existing dialog shell on smaller screens.
  dialog.form.querySelector('.ui-dialog-foot').append(body.querySelector('.motion-actions'));
  function draw(){
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(!report)return;
    const tick=Math.floor((video.currentTime-report._styk.motionCapture.sourceStart)*report.fps+1e-5);
    const frame=report.keyframes[tick];if(!frame)return;
    const sx=canvas.width/report.canvas_width,sy=canvas.height/report.canvas_height;
    ctx.save();ctx.scale(sx,sy);ctx.lineCap='round';ctx.lineJoin='round';
    for(const object of frame.objects){
      const figure=report.figure_types.find(f=>f.figure_type_id===object.figure_type_id),nodes=new Map([[0,[object.root_x,object.root_y]]]);
      figure.segments.forEach((segment,i)=>{
        const a=nodes.get(segment.parent_id),angle=object.angles[i],length=object.lengths[i],b=[a[0]+Math.cos(angle)*length,a[1]+Math.sin(angle)*length];
        nodes.set(segment.segment_id,b);ctx.strokeStyle=`rgb(${segment.color_rgb.join(',')})`;ctx.lineWidth=segment.thickness;
        ctx.beginPath();if(segment.primitive_code===1)ctx.arc((a[0]+b[0])/2,(a[1]+b[1])/2,length/2,0,Math.PI*2);else{ctx.moveTo(...a);ctx.lineTo(...b);}ctx.stroke();
      });
    }
    ctx.restore();
  }
  function animate(){draw();if(!video.paused&&!closed)raf=requestAnimationFrame(animate);}
  video.addEventListener('play',()=>{cancelAnimationFrame(raf);animate();});
  video.addEventListener('seeked',draw);video.addEventListener('timeupdate',draw);
  field('file').addEventListener('change',()=>{
    if(url)URL.revokeObjectURL(url);
    report=null;metrics=null;open.hidden=true;review.hidden=true;result.textContent='';
    const file=field('file').files[0];
    if(file){url=URL.createObjectURL(file);video.src=url;}
    sync();draw();
  });
  async function run(short){
    if(busy)return;
    const file=field('file').files[0];if(!file)return;
    if(file.size>256*1024*1024){dialog.setError('Choose a video smaller than 256 MB. Trim or compress a copy first.');return;}
    const options=Object.fromEntries(['start','duration','people','fps','mode','device','smoothing'].map(key=>[key,field(key).value]));
    if(short)options.duration=String(Math.min(10,Number(options.duration)||10));
    if(!Number.isFinite(Number(options.start))||Number(options.start)<0||Number(options.start)>86400||!Number.isFinite(Number(options.duration))||Number(options.duration)<.1||Number(options.duration)>600){dialog.setError('Enter a start time from 0 to 86400 and a length from 0.1 to 600 seconds.');return;}
    dialog.setError('');report=null;metrics=null;lastProgress=null;open.hidden=true;review.hidden=true;reviewIndex=0;result.textContent='';progress.value=0;
    video.pause();busy=true;sync();
    const started=performance.now();
    const showProgress=()=>{
      const wall=(performance.now()-started)/1000;
      status.textContent=lastProgress?.frames?`${lastProgress.frames}/${lastProgress.total} frames · ${lastProgress.processingFPS.toFixed(1)} FPS · ${seconds(wall)} elapsed · about ${seconds(lastProgress.remaining)} remaining`
        :`${lastProgress?.message||'Uploading local video and preparing capture…'} · ${seconds(wall)} elapsed`;
    };
    timer=setInterval(showProgress,500);showProgress();
    jobId=crypto.randomUUID().replaceAll('-','');
    try{
      worker=new Worker(new URL('./motion-worker.mjs',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>{
        if(closed||!busy)return;
        if(data.error){stop();dialog.setError(data.error);status.textContent='Capture failed. Your current animation was kept.';report=null;return;}
        if(data.progress){lastProgress=data.progress;if(data.progress.type==='header')result.textContent=`Processor: ${data.progress.provider}.`;if(data.progress.frames)progress.value=data.progress.frames/data.progress.total;showProgress();}
        if(data.chunk){try{report=applyDocumentChunk(report,data.chunk);worker.postMessage({ack:true});}catch(error){stop();dialog.setError(error.message);report=null;}}
        if(data.complete){
          metrics=data.metrics;jobId=null;stop();progress.value=1;open.hidden=false;review.hidden=!metrics.reviewFrames;
          const extrapolated=120*report.fps/Math.max(metrics.processingFPS,.001);
          status.textContent=`Finished: ${metrics.frames} frames · ${metrics.processingFPS.toFixed(1)} FPS · analysis ${seconds(metrics.analysisSeconds)} · model setup ${seconds(metrics.modelSeconds)}.`;
          result.textContent=`${metrics.provider} · ${metrics.reviewFrames} frames flagged for review${metrics.truncated?' · Video ended early':''}. A similar 2-minute clip at this capture FPS would take about ${seconds(extrapolated)} for analysis, excluding setup and export.`;
          canvas.width=480;canvas.height=Math.max(120,Math.round(480*report.canvas_height/report.canvas_width));
          video.currentTime=report._styk.motionCapture.sourceStart;draw();
        }
      };
      worker.onerror=event=>{stop();report=null;dialog.setError(event.message||'The motion worker stopped.');};
      worker.postMessage({baseURL,token,jobId,file,options});
    }catch(error){stop();dialog.setError(error.message);}
  }
  test.addEventListener('click',()=>void run(true));convert.addEventListener('click',()=>void run(false));
  cancel.addEventListener('click',()=>{stop();report=null;status.textContent='Capture cancelled. Your current animation was kept.';});
  review.addEventListener('click',()=>{
    const frames=report?._styk.motionCapture.reviewFrames;if(!frames?.length)return;
    video.pause();video.currentTime=report._styk.motionCapture.sourceStart+frames[reviewIndex++%frames.length]/report.fps;draw();
  });
  open.addEventListener('click',async()=>{
    if(!report)return;
    open.disabled=true;
    try{if(await onImport(report)!==false)dialog.close();}catch(error){dialog.setError(error.message);}finally{open.disabled=false;}
  });
  sync();draw();
  const showing=dialog.showModal();
  fetch(new URL('/api/motion/status',baseURL),{headers:headers(),signal:AbortSignal.timeout(30000)}).then(async response=>{
    if(!response.ok)throw new Error('Motion capture requires the desktop preview or local development server.');
    const state=await response.json();if(closed)return;available=state.available;
    status.textContent=available?`Ready. Available processors: ${state.providers.join(', ')}.`:state.message;sync();
  }).catch(error=>{if(!closed){status.textContent=error.message;sync();}});
  await showing;closed=true;stop();cancelAnimationFrame(raf);video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);
}
