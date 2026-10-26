/** Bounded, native vector scenery: no raster assets, downloads or renderer fork. */
import {createObject,createFrame} from './demo.mjs';
import {paintBackground} from './paint.mjs';
import {ensureLayerState} from './layers.mjs';
import {initializeLayerSheet} from './editor-layer-sheet.mjs';

export const SCENE_LOCATIONS={none:'Plain canvas',rooftop:'Rooftop',street:'City street',forest:'Forest clearing',arena:'Arena',studio:'Studio room'};
export const SCENE_LIGHTING={day:'Daylight',sunset:'Sunset',night:'Night'};
const rgb=hex=>[hex>>16&255,hex>>8&255,hex&255];
const palettes={
 day:{sky:[0x96cce1,0xe7eff0,0xffefda],far:0xa0b8c4,mid:0x718c9c,near:0x405c70,wall:0x8e9b9e,floor:0x667884,line:0xa4b6ba,accent:0xd8ac6c,light:0xfff1cd,leaf:0x668e83,dark:0x2f4859},
 sunset:{sky:[0x4c527e,0xd58d91,0xffd0a0],far:0x9d8caa,mid:0x6f718e,near:0x3c4a64,wall:0x867784,floor:0x4e5069,line:0x9c8a9c,accent:0xf3b980,light:0xffddb0,leaf:0x5b7377,dark:0x293c55},
 night:{sky:[0x101d38,0x263c60,0x64829b],far:0x425979,mid:0x304961,near:0x1e344a,wall:0x3a4d61,floor:0x293d51,line:0x506a7e,accent:0x60bccb,light:0xffd99a,leaf:0x365c65,dark:0x14283b},
};
export function sceneryRandom(seed){let s=(seed^0x7b7d159c)>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
class Artwork {
 constructor(id,name){this.figure={figure_type_id:id,name,segments:[],polyfills:[],image_assets:[],text_assets:[]};}
 node(x,y){const segments=this.figure.segments,id=segments.length+1;segments.push({segment_id:id,parent_id:0,length:Math.max(.0001,Math.hypot(x,y)),angle_rad:Math.atan2(y,x),thickness:0,bend_rad:0,primitive_code:0,aux_code:0,flags:0,segment_type:'line',segment_kind:'line',color_rgb:[0,0,0],transparency:255,visible:false,z_order:0});return id;}
 poly(points,color,opacity=1){const f=this.figure;f.polyfills.push({polyfill_id:f.polyfills.length+1,segment_ids:points.map(([x,y])=>this.node(x,y)),color_rgb:rgb(color),alpha_raw:Math.round((1-opacity)*255),z_order:f.segments.length+1});}
 rect(x,y,w,h,color,opacity=1){this.poly([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],color,opacity);}
 line(x,y,x2,y2,width,color,opacity=1){const parent=this.node(x,y),f=this.figure;f.segments.push({segment_id:f.segments.length+1,parent_id:parent,length:Math.max(.0001,Math.hypot(x2-x,y2-y)),angle_rad:Math.atan2(y2-y,x2-x),thickness:width,bend_rad:0,primitive_code:0,aux_code:0,flags:0,segment_type:'line',segment_kind:'line',color_rgb:rgb(color),transparency:Math.round((1-opacity)*255),visible:true,z_order:f.segments.length+1});}
 ellipse(x,y,rx,ry,color,opacity=1){this.poly(Array.from({length:20},(_,i)=>[x+rx*Math.cos(i*Math.PI/10),y+ry*Math.sin(i*Math.PI/10)]),color,opacity);}
 finish(){for(const segment of this.figure.segments){segment.is_static=true;segment.aux_code=1;segment.flags|=256;}this.figure.segment_count=this.figure.segments.length;return this.figure;}
}
function skyline(a,p,rng,base,small=false){
 for(let x=-280;x<1260;){const w=small?35+rng()*40:55+rng()*65,h=(small?35:70)+rng()*(small?90:175),y=base-h;
  a.rect(x,y,w,h,small?p.far:p.mid);if(rng()>.5)a.rect(x+w*.22,y-8,w*.56,8,small?p.far:p.mid);
  if(!small){for(let wx=x+10;wx<x+w-8;wx+=15)for(let wy=y+14;wy<base-10;wy+=21)if(rng()>.48)a.rect(wx,wy,4,7,p.light,.28+rng()*.55);
   if(rng()>.65)a.line(x+w*.5,y,x+w*.5,y-30,2,p.mid);}
  x+=w+8+rng()*18;
 }
}
function tree(a,x,y,h,p,color,rng){
 a.poly([[x-9,y],[x-5,y-h*.7],[x+4,y-h*.75],[x+13,y]],color);
 a.line(x,y-h*.38,x-h*.22,y-h*.67,5,color);a.line(x,y-h*.48,x+h*.19,y-h*.76,4,color);
 for(let i=0;i<5;i++)a.ellipse(x+(rng()-.5)*h*.45,y-h*(.68+rng()*.22),h*(.14+rng()*.07),h*.16,color);
 a.line(x-3,y-7,x-1,y-h*.43,2,p.line,.22);
}
function floor(a,p,location){
 a.rect(-400,440,1760,380,p.floor);a.line(-400,440,1360,440,3,p.line,.8);
 if(location==='forest'){
  a.ellipse(480,465,360,65,p.accent,.12);
  for(let x=-200;x<1200;x+=37){a.line(x,457,x+5,449,2,p.leaf,.7);a.line(x+8,453,x+13,443,1,p.leaf,.8);}
 }else{
  for(let x=-900;x<1900;x+=150)a.line(480+(x-480)*.12,440,x,800,1,p.line,.28);
  for(const y of [469,514,584,690])a.line(-400,y,1360,y,1,p.line,.28);
 }
}
export function buildScenery({location,lighting,seed}){
 if(location==='none')return {figures:[],objects:[],background:null};
 const p=palettes[lighting],rng=sceneryRandom(seed),far=new Artwork(100,'Distance'),mid=new Artwork(101,'Scenery'),stage=new Artwork(102,'Stage'),front=new Artwork(103,'Foreground');
 // Large overscan margins support camera moves and parallax without exposed edges.
 if(location!=='studio'){
  if(lighting==='night'){far.ellipse(770,96,26,26,0xe1e8dc,.9);for(let i=0;i<32;i++){const x=rng()*1400-220,y=30+rng()*150;far.ellipse(x,y,1,1,p.light,.3+rng()*.5);}}
  else far.ellipse(770,132,48,48,p.light,.75);
 }
 if(['rooftop','street'].includes(location)){
  skyline(far,p,rng,365,true);skyline(mid,p,rng,435);
  if(location==='rooftop'){
   stage.rect(-400,408,1760,32,p.near);stage.rect(-400,404,1760,6,p.line);stage.line(-400,427,1360,427,2,p.dark,.45);
   floor(stage,p,location);
   for(const x of [15,850]){stage.rect(x,365,90,75,p.wall);stage.poly([[x,365],[x+12,355],[x+102,355],[x+90,365]],p.line);stage.rect(x+12,382,55,31,p.dark);for(let y=387;y<410;y+=6)stage.line(x+17,y,x+61,y,2,p.line,.55);}
   mid.line(92,188,92,110,3,p.near);mid.line(65,126,119,126,2,p.near);mid.line(72,142,112,142,2,p.near);
   mid.rect(650,225,68,50,p.near);mid.ellipse(684,225,34,9,p.mid);mid.line(660,275,650,310,3,p.near);mid.line(708,275,718,310,3,p.near);
   front.rect(-120,516,260,110,p.dark);front.line(-100,516,120,516,4,p.line);front.rect(885,520,220,110,p.dark);
  }else{
   for(const x of [-140,830]){stage.rect(x,80,270,360,p.near);stage.rect(x+14,246,242,115,p.wall);stage.rect(x+23,255,98,95,p.dark);stage.rect(x+137,255,108,95,p.dark);stage.rect(x+12,224,246,22,p.accent);stage.line(x+12,248,x+258,248,4,p.dark);for(let i=0;i<3;i++)stage.rect(x+25+i*74,128,52,72,p.mid);}
   floor(stage,p,location);for(let x=210;x<780;x+=80)stage.poly([[x,480],[x+48,480],[x+60,508],[x-12,508]],p.light,.5);
   for(const x of [130,830]){stage.line(x,438,x,198,5,p.dark);stage.line(x,198,x+30,185,5,p.dark);stage.ellipse(x+30,188,17,5,p.light);stage.poly([[x+18,193],[x+43,193],[x+99,438],[x-40,438]],p.light,.035);}
   front.rect(-100,504,235,120,p.dark);front.rect(890,504,180,120,p.dark);front.line(-100,503,135,503,4,p.line);front.line(890,503,1100,503,4,p.line);
  }
 }else if(location==='forest'){
  far.poly([[-400,390],[-150,235],[100,315],[330,190],[520,300],[750,210],[1050,320],[1360,240],[1360,600],[-400,600]],p.far);
  mid.poly([[-400,440],[-100,300],[160,355],[400,290],[680,360],[990,280],[1360,355],[1360,600],[-400,600]],p.mid);
  for(const x of [-80,70,210,770,930,1100])tree(mid,x,445,230+rng()*100,p,p.leaf,rng);
  mid.poly([[390,-100],[470,-100],[750,440],[520,440]],p.light,.045);
  floor(stage,p,location);stage.ellipse(130,431,45,13,p.near);stage.ellipse(840,434,36,10,p.near);
  for(const x of [-50,990])tree(front,x,575,590,p,p.dark,rng);
  for(let i=0;i<16;i++){const x=i<8?i*15-30:870+(i-8)*18;front.poly([[x,565],[x-18,485-rng()*35],[x+10,532],[x+26,480-rng()*25],[x+30,565]],p.dark);}
 }else if(location==='arena'){
  far.ellipse(480,410,850,235,p.far);mid.ellipse(480,420,760,185,p.mid);mid.ellipse(480,437,650,128,p.near);
  for(let row=0;row<5;row++)for(let i=0;i<38;i++){const x=-60+i*29,y=260+row*24+Math.sin(i/37*Math.PI)*24;mid.rect(x,y,12,6,row%2?p.accent:p.line,.35);}
  for(const x of [65,895]){mid.line(x,440,x,112,7,p.dark);mid.line(x-43,110,x+43,110,8,p.near);for(let i=0;i<6;i++)mid.rect(x-37+i*13,112,8,12,p.light);mid.poly([[x-40,124],[x+40,124],[x+160,440],[x-160,440]],p.light,.03);}
  stage.rect(-200,422,1360,18,p.line);floor(stage,p,location);stage.rect(-200,444,1360,9,p.accent,.4);
  for(const x of [100,860])stage.line(x,440,x,290,9,p.near);for(const y of [303,336,369])stage.line(100,y,860,y,3,p.accent,.55);
  front.rect(-130,520,270,120,p.dark);front.rect(860,520,250,120,p.dark);front.line(-130,519,140,519,5,p.line);front.line(860,519,1110,519,5,p.line);
 }else{
  far.rect(-400,-300,1760,1100,p.wall);far.rect(-400,0,1760,26,p.near);far.rect(-400,284,1760,140,p.mid);
  for(const x of [70,650]){mid.rect(x-8,61,248,205,p.near);mid.rect(x,69,232,189,p.far);mid.rect(x+4,73,224,181,lighting==='night'?0x233d59:lighting==='sunset'?0xeeb9a1:0xc2e0e4);mid.line(x+116,69,x+116,258,6,p.near);mid.line(x,158,x+232,158,6,p.near);mid.rect(x-16,260,264,10,p.line);mid.poly([[x+12,269],[x+200,269],[x+320,440],[x+60,440]],p.light,.055);}
  stage.rect(-400,423,1760,17,p.near);floor(stage,p,location);
  for(const x of [22,842]){stage.rect(x,375,95,50,p.near);stage.rect(x-4,370,103,12,p.accent);stage.line(x+8,423,x+8,440,4,p.dark);stage.line(x+85,423,x+85,440,4,p.dark);}
  mid.line(480,-100,480,70,3,p.dark);mid.poly([[445,70],[515,70],[535,104],[425,104]],p.near);mid.ellipse(480,104,53,8,p.light,.8);
  front.rect(-180,520,290,120,p.dark);front.rect(890,520,300,120,p.dark);
 }
 const figures=[far,mid,stage,front].map(a=>a.finish());
 const objects=figures.map(f=>createObject(f,f.figure_type_id,0,0));
 return {figures,objects,background:{background_id:1,name:`${SCENE_LOCATIONS[location]} · ${SCENE_LIGHTING[lighting]}`,...paintBackground({type:'linear',angle:90,stops:p.sky.map((c,i)=>({offset:i/2,color:rgb(c),opacity:1}))})}};
}
/** Install scenery once in held native pose sources, independent of movie length. */
export function installScenery(report,plan,art){
 const state=ensureLayerState(report);state.order=[];state.byId={};state.assignments={};let next=1;
 const layer=(name,response,color='teal')=>{const id=`layer-${next++}`;state.order.push(id);state.byId[id]={name,visible:true,locked:['Distance','Scenery','Stage','Foreground','Contact shadows'].includes(name),color,parallax:{enabled:true,linked:true,x:response,y:response,reference:{x:0,y:0}}};return id;};
 const sourceIds=[];
 for(const [i,object] of art.objects.entries())if(i<3){const id=layer(art.figures[i].name,[.12,.45,1][i]);state.assignments[object.unique_id]=id;sourceIds.push(id);}
 const shadowLayer=plan.shadows?layer('Contact shadows',1):null;
 for(let i=0;i<plan.people;i++){const id=layer(['Red','Blue','Purple','Green'][i],1,['rose','blue','violet','green'][i]);state.assignments[i+1]=id;if(i===0)state.defaultLayerId=state.activeId=id;if(shadowLayer)state.assignments[50+i]=shadowLayer;}
 if(art.objects[3]){const id=layer('Foreground',1.2);state.assignments[103]=id;sourceIds.push(id);}
 state.nextId=next;
 if(art.background){report.backgrounds.push(art.background);for(const frame of report.keyframes)frame.background_id=art.background.background_id;}
 report.figure_types.push(...art.figures);
 initializeLayerSheet(report);
 if(art.objects.length){
  const source=createFrame(art.objects);source._styk={frameId:'generated-scenery'};report._styk.frameSources={'generated-scenery':source};
  for(const id of sourceIds)report._styk.layerSheet.tracks[id]={end:plan.duration*report.fps,keys:[{id:`scenery-${id}`,tick:0,interpolation:'hold',value:{frameId:'generated-scenery'}}]};
 }
 report._styk.layerSheet.tracks.scene.keys=[report._styk.layerSheet.tracks.scene.keys[0]];
 return report;
}
export function createContactShadow(){
 const a=new Artwork(50,'Contact shadow');a.line(0,0,52,0,8,0x071522,.25);return a.finish();
}
