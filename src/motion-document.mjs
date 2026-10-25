/** Retarget screen-space COCO joints to ordinary editable native segments.
 * Projected lengths intentionally vary: a foreshortened arm must stay short.
 * This captures the camera's view, not an unseen 3D performance.
 */
import {emptyDocument, createFrame, createObject} from './demo.mjs';

const colors = [[13,153,255],[255,112,67],[142,90,235],[38,166,110]];
const midpoint = (a,b) => [(a[0]+b[0])/2,(a[1]+b[1])/2];

function joints(points) {
  if (!Array.isArray(points) || points.length !== 17 || points.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n) || Math.abs(n)>100000)))
    throw new Error('Motion capture returned invalid body joints.');
  const root = midpoint(points[11],points[12]), shoulder = midpoint(points[5],points[6]);
  // A circle's two endpoints span its diameter; extend past the nose to place
  // the head centre above the shoulders, with no face-detail dependency.
  const head = [0,1].map(i => shoulder[i]+(points[0][i]-shoulder[i])*1.8);
  return [root,shoulder,head,points[5],points[7],points[9],points[6],points[8],points[10],points[11],points[13],points[15],points[12],points[14],points[16]];
}
// Segment index + 1 equals its child joint index; parent IDs stay native.
const parents = [0,1,1,3,4,1,6,7,0,9,10,0,12,13];
const names = ['Torso','Head','Left shoulder','Left upper arm','Left forearm','Right shoulder','Right upper arm','Right forearm','Left hip','Left thigh','Left shin','Right hip','Right thigh','Right shin'];
function poseFor(points) {
  const nodes=joints(points);
  return {root:nodes[0], angles:parents.map((p,i)=>Math.atan2(nodes[i+1][1]-nodes[p][1],nodes[i+1][0]-nodes[p][0])),
    lengths:parents.map((p,i)=>Math.max(.01,Math.hypot(nodes[i+1][0]-nodes[p][0],nodes[i+1][1]-nodes[p][1])))};
}

export class MotionDocument {
  constructor(header, name='Video motion') {
    if (![header.width,header.height].every(n=>Number.isInteger(n)&&n>0&&n<=3840) || !Number.isFinite(header.fps) || header.fps<1 || header.fps>60)
      throw new Error('Invalid capture dimensions or frame rate.');
    this.report={...emptyDocument(),canvas_width:header.width,canvas_height:header.height,fps:header.fps,figure_types:[],keyframes:[],
      _styk:{format:'StykAnimate',format_version:1,name,motionCapture:{...header,reviewFrames:[]}}};
    this.figures=new Map();
  }
  append(frame) {
    if(frame.tick!==this.report.keyframes.length || frame.tick>=18000 || !Array.isArray(frame.actors) || frame.actors.length>4)
      throw new Error('Invalid or out-of-order motion frame.');
    const seen=new Set();
    const objects=frame.actors.map(actor=>{
      if(!Number.isInteger(actor.id)||actor.id<1||actor.id>128||seen.has(actor.id))throw new Error('Invalid actor identity.');
      seen.add(actor.id);
      const pose=poseFor(actor.points);
      let figure=this.figures.get(actor.id);
      if(!figure){
        const color=colors[(actor.id-1)%colors.length],thickness=Math.max(3,pose.lengths[0]*.09);
        figure={figure_type_id:actor.id,name:`Actor ${actor.id}`,segment_count:parents.length,
          segments:parents.map((parent,i)=>({segment_id:i+1,parent_id:parent,name:names[i],length:pose.lengths[i],angle_rad:pose.angles[i],thickness:i===1?Math.max(2,thickness*.65):thickness,
            bend_rad:0,primitive_code:i===1?1:0,aux_code:0,flags:i===1?1:0,segment_type:i===1?'circle':'line',segment_kind:i===1?'circle':'line',
            color_rgb:color,transparency:0,visible:true,z_order:i+1})),polyfills:[],image_assets:[],text_assets:[]};
        this.figures.set(actor.id,figure);this.report.figure_types.push(figure);
      }
      return createObject(figure,actor.id,...pose.root,{angles:pose.angles,len_flag:1,lengths:pose.lengths});
    });
    this.report.keyframes.push({...createFrame(objects,1),_styk:{easing:{interpolation:'hold'}}});
    if(frame.review)this.report._styk.motionCapture.reviewFrames.push(frame.tick);
  }
  finish(metrics) {
    if(!this.figures.size)throw new Error('No people were detected. Try footage with visible full bodies.');
    if(metrics.frames!==this.report.keyframes.length)throw new Error('The capture ended before every frame arrived.');
    this.report._styk.motionCapture.metrics=metrics;
    return this.report;
  }
}
