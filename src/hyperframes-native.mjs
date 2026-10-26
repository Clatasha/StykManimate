/** Hyperframes frame-source adapter for the existing native scene painter. */
import {timeline,evaluatedFrame,buildGeometry} from './pivot/geometry.mjs';
import {drawExportScene} from './export-frame-core.mjs';
import {PlaybackResources} from './playback-resources.mjs';

const report=JSON.parse(document.getElementById('styk-report').textContent),canvas=document.getElementById('styk-canvas'),resources=new PlaybackResources(),rows=timeline(report),ctx=canvas.getContext('2d');
function render(time){
 const tick=Math.min(rows.at(-1).start+rows.at(-1).count-1,Math.max(0,Math.floor(time*report.fps+1e-7)));let low=0,high=rows.length-1;
 while(low<high){const mid=(low+high+1)>>>1;if(rows[mid].start<=tick)low=mid;else high=mid-1;}
 const row=rows[low],frame=evaluatedFrame(report,low,row.count?(tick-row.start)/row.count:0,tick);
 drawExportScene(ctx,report,frame,buildGeometry(report,frame),resources);
 window.stykPresentationTick=tick;
}
window.__hyperframes.registerFrameSource({element:canvas,sourceRange:{start:0,duration:rows.at(-1).start/report.fps+rows.at(-1).count/report.fps,fps:report.fps},render,dispose:()=>resources.dispose()});
render(0);
// Native browser animations are sought by Hyperframes, never a second clock.
for(const element of document.querySelectorAll('[data-impact-accent]')){
 const start=Number(element.dataset.start)*1000;
 const animation=element.firstElementChild.animate([{opacity:0,transform:'scaleX(.75)'},{opacity:.2,transform:'scaleX(1)',offset:.18},{opacity:0,transform:'scaleX(1.12)'}],{duration:160,delay:start,fill:'both'});animation.pause();
}
