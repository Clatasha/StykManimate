/** A deterministic camera pass over native actor poses. No playback state. */
export const SCENE_DIRECTIONS={off:'Locked wide',calm:'Calm',cinematic:'Cinematic',intense:'Intense'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
export function sceneActorBounds(report,frame,people){
 let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
 for(const object of frame.objects){
  if(object.unique_id>people)continue;
  const figure=report.figure_types[object.figure_type_id-1],nodes=new Map([[0,[object.root_x,object.root_y]]]);
  const include=(x,y,pad)=>{left=Math.min(left,x-pad);right=Math.max(right,x+pad);top=Math.min(top,y-pad);bottom=Math.max(bottom,y+pad);};
  include(object.root_x,object.root_y,8);
  figure.segments.forEach((s,i)=>{const a=nodes.get(s.parent_id),length=object.lengths?.[i]??s.length,angle=object.angles[i],b=[a[0]+Math.cos(angle)*length,a[1]+Math.sin(angle)*length];nodes.set(s.segment_id,b);const pad=(s.thickness??0)/2+2;
   if(s.segment_kind==='circle'||s.segment_type==='circle'){include((a[0]+b[0])/2,(a[1]+b[1])/2,length/2+pad);}else{include(...a,pad);include(...b,pad);}
  });
 }
 return {left,right,top,bottom};
}
function union(bounds){return {left:Math.min(...bounds.map(b=>b.left)),right:Math.max(...bounds.map(b=>b.right)),top:Math.min(...bounds.map(b=>b.top)),bottom:Math.max(...bounds.map(b=>b.bottom))};}
function shot(bounds,style,wide){
 const min=style==='calm'?1.03:wide?1.02:style==='intense'?.78:.84;
 return {x:clamp((bounds.left+bounds.right)/2-480,-140,140),y:clamp((bounds.top+bounds.bottom)/2-270,-80,60),scale:Math.max(min,(bounds.right-bounds.left+100)/960,(bounds.bottom-bounds.top+90)/540)};
}
export function directScene(report,plan){
 if(plan.direction==='off')return;
 let previous={x:0,y:0,scale:1.05};
 for(const [i,beat] of plan.beats.entries()){
  const first=Math.round(beat.start*report.fps),count=Math.round(beat.duration*report.fps);
  const samples=[0,.25,.5,.75,1].map(u=>sceneActorBounds(report,report.keyframes[first+Math.round(u*(count-1))],plan.people));
  const target=shot(union(samples),plan.direction,i===0||i===plan.beats.length-1||beat.actions.some(a=>['run','walk','jump','approach'].includes(a)));
  for(let f=0;f<count;f++){
   const frame=report.keyframes[first+f],t=ease(f/(report.fps*(plan.direction==='calm'?1.6:.8))),current={x:previous.x+(target.x-previous.x)*t,y:previous.y+(target.y-previous.y)*t,scale:previous.scale+(target.scale-previous.scale)*t};
   // A conservative frame guard retains heads/feet during jumps and wide spreads.
   const b=sceneActorBounds(report,frame,plan.people),cx=480+current.x,cy=270+current.y;
   current.scale=Math.max(current.scale,(cx-b.left+28)/480,(b.right-cx+28)/480,(cy-b.top+28)/270,(b.bottom-cy+28)/270);
   frame.camera={is_default:false,...current,angle_rad:0};
  }
  previous={...report.keyframes[first+count-1].camera};
 }
}
