/** Local scene choreography. Produces normal native poses and existing effect clips. */
import {emptyDocument,defaultFigure,createObject,createFrame} from './demo.mjs';
import {createCameraMotion,validateCameraMotion} from './camera-motion.mjs';
import {createVfxClip,validateVfxClips} from './vfx-clips.mjs';
import {createVfx,VFX_REGISTRY} from './vfx.mjs';
import {VFX_PRESETS} from './vfx-presets.mjs';
import {buildScenery,installScenery,createContactShadow,SCENE_LOCATIONS,SCENE_LIGHTING} from './scene-backgrounds.mjs';
import {fightBeats,actionPose,blendActionPose} from './fight-choreography.mjs';
import {directScene,SCENE_DIRECTIONS} from './scene-direction.mjs';

export const SCENE_ACTIONS=['walk','run','punch','kick','block','dodge','jump','fall','get up','wave','celebrate','idle','cross','hook','uppercut','duck','sweep','flip','dash','aerial kick'];
export const SCENE_THEMES=['fight','chase','comedy','everyday','surprise'];
const patterns=[['uppercut',/\buppercut(?:s|ting)?\b/gi],['cross',/\bcross(?:es)?\b/gi],['hook',/\bhook(?:s|ing)?\b/gi],['duck',/\bduck(?:s|ing)?\b/gi],['sweep',/\b(?:sweep(?:s|ing)?|swept)\b/gi],['flip',/\bflip(?:s|ping)?\b/gi],['dash',/\b(?:dash(?:es|ing)?|sprint(?:s|ing)?)\b/gi],['aerialkick',/\b(?:flying|aerial)\s+kick(?:s|ing)?\b/gi],['get up',/\b(?:get(?:s|ting)?\s+up|stand(?:s|ing)?\s+up|recover(?:s|ing)?)\b/gi],['walk',/\bwalk(?:s|ing)?\b/gi],['run',/\b(?:run(?:s|ning)?|chas(?:e|es|ing))\b/gi],['punch',/\b(?:punch(?:es|ing)?|jab(?:s|bing)?)\b/gi],['kick',/\bkick(?:s|ing)?\b/gi],['block',/\bblock(?:s|ing)?\b/gi],['dodge',/\bdodg(?:e|es|ing)\b/gi],['jump',/\bjump(?:s|ing)?\b/gi],['fall',/\b(?:fall(?:s|ing)?|trip(?:s|ping)?)\b/gi],['wave',/\bwav(?:e|es|ing)\b/gi],['celebrate',/\b(?:celebrat(?:e|es|ing)|danc(?:e|es|ing))\b/gi],['idle',/\b(?:wait(?:s|ing)?|idle|pause(?:s)?)\b/gi]];
const looks={...Object.fromEntries(Object.entries(VFX_REGISTRY).map(([type,definition])=>[definition.name,{effects:[[type,{}]],scene:Boolean(definition.scene)}])),...VFX_PRESETS};
export const SCENE_EFFECTS=Object.keys(looks);
const palettes=[[229,69,81],[46,139,232],[125,83,210],[34,164,117]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
function random(seed){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
const opponent=(i,count)=>i%2?i-1:Math.min(i+1,count-1)===i?Math.max(0,i-1):i+1;
const choose=(list,rng)=>list[Math.floor(rng()*list.length)];
export function compatibleSceneFigure(figure){
 const base=defaultFigure();return figure?.segments?.length===10&&!figure._styk?.movieclip&&figure.segments.every((s,i)=>s.segment_id===base.segments[i].segment_id&&s.parent_id===base.segments[i].parent_id&&s.length>0)&&!figure.image_assets?.length&&!figure.text_assets?.length;
}
export function planScene({duration=60,people=2,theme='fight',prompt='',seed=1,randomize=false,effects=true,location='rooftop',lighting='night',direction='cinematic',shadows=true,movement='action',sample=false}={}){
 if(!Number.isInteger(duration)||(!(sample&&duration===15)&&(duration<60||duration>600)))throw new Error('Choose a whole length from 60 to 600 seconds.');
 if(!Number.isInteger(people)||people<1||people>4)throw new Error('Choose one to four characters.');
 for(const [value,choices,label] of [[location,SCENE_LOCATIONS,'location'],[lighting,SCENE_LIGHTING,'lighting'],[direction,SCENE_DIRECTIONS,'camera style']])if(!Object.hasOwn(choices,value))throw new Error(`Choose an available ${label}.`);
 if(!['action','classic'].includes(movement))throw new Error('Choose Action choreography or Classic movements.');
 if(typeof sample!=='boolean')throw new Error('Choose whether this is a short fight sample.');
 if(typeof shadows!=='boolean')throw new Error('Choose whether to add contact shadows.');
 if(!SCENE_THEMES.includes(theme))throw new Error('Choose an available theme.');
 if(typeof prompt!=='string'||prompt.length>2000)throw new Error('Keep the prompt under 2,000 characters.');
 if(!Number.isInteger(seed)||seed<0||seed>2147483647)throw new Error('Choose a seed from 0 to 2147483647.');
 const rng=random(seed),actualTheme=theme==='surprise'?choose(SCENE_THEMES.slice(0,-1),rng):theme;
 const matches=patterns.flatMap(([action,re])=>[...prompt.matchAll(re)].map(m=>({action,index:m.index,end:m.index+m[0].length}))).sort((a,b)=>a.index-b.index||b.end-a.end).filter((m,i,list)=>!list.slice(0,i).some(p=>p.index<=m.index&&p.end>m.index));
 const commands=matches.map((m,i)=>{
  const preceding=prompt.slice(i?matches[i-1].index:0,m.index);
  const actors=[...preceding.matchAll(/\b(red|blue|purple|green|character\s*[1-4])\b/gi)];
  const name=actors.at(-1)?.[0].toLowerCase(),actor=name?.startsWith('character')?Number(name.match(/[1-4]/)[0])-1:['red','blue','purple','green'].indexOf(name);
  return {action:m.action,actor:actor>=0?actor%people:i%people};
 });
 if(!randomize&&!commands.length)throw new Error('Include an action such as walk, run, punch, kick, block, dodge, jump, fall, get up, wave or celebrate. Use Random scene for a surprise.');
 const warnings=[];
 if(!randomize)warnings.push('Uses supported action words in order; extra story details, props, dialogue and exact repetition counts are not interpreted.');
 if(commands.some(c=>c.action==='fall')&&!commands.some(c=>c.action==='get up'))warnings.push('Recovery is added after falls so the scene can continue.');
 const pools={fight:['punch','block','kick','dodge','punch','jump'],chase:['run','run','jump','dodge','run'],comedy:['walk','wave','jump','fall','celebrate'],everyday:['walk','wave','idle','jump','celebrate']};
 let beats=[];const down=Array(people).fill(false);let start=0,commandIndex=0,last='';
 const add=(seconds,actions,label)=>{const shot=direction==='off'?'Locked wide':start===0?'Establishing wide':label==='Ending'?'Closing wide':actions.some(a=>['run','walk','jump','approach'].includes(a))?'Wide tracking':actions.some(a=>['punch','kick','block','dodge'].includes(a))?'Medium exchange':'Reaction / recovery';beats.push({start,duration:seconds,actions,label,shot});start+=seconds;};
 add(4,Array.from({length:people},()=>actualTheme==='fight'?'approach':'wave'),'Opening');
 while(start<duration-4){
  const length=Math.min(choose([3,4,5],rng),duration-4-start),actions=Array(people).fill('idle');
  let actor,action;
  if(!randomize){({actor,action}=commands[commandIndex++%commands.length]);}
  else{actor=Math.floor(rng()*people);const pool=pools[actualTheme].filter(a=>a!==last);action=choose(pool,rng);}
  if(down[actor]&&action!=='get up')action='get up';
  actions[actor]=action;last=action;
  const other=opponent(actor,people);
  if(people>1&&['punch','kick'].includes(action)&&!down[other])actions[other]=choose(['block','dodge','recoil'],rng);
  if(actualTheme==='chase'&&action==='run')for(let i=0;i<people;i++)if(!down[i])actions[i]='run';
  for(let i=0;i<people;i++){if(down[i]&&actions[i]==='idle')actions[i]='get up';if(actions[i]==='fall')down[i]=true;else if(actions[i]==='get up')down[i]=false;}
  add(length,actions,actions.map((a,i)=>`${['Red','Blue','Purple','Green'][i]} ${a}`).filter(s=>!s.endsWith(' idle')).join(' · ')||'Pause');
 }
 add(4,down.map(d=>d?'get up':'celebrate'),'Ending');
 const action=movement==='action'&&actualTheme==='fight';
 if(action)beats=fightBeats(duration*24,people,rng,randomize?[]:commands);
 const requestedEffects=[];
 if(effects){
  for(const name of Object.keys(looks))if(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(prompt))requestedEffects.push(name);
 }
 if(requestedEffects.length>8){requestedEffects.length=8;warnings.push('Only the first eight named effects are added; add further effects in the editor.');}
 return {version:3,duration,people,movement,action,sample,location,lighting,direction,shadows,theme:actualTheme,prompt,seed,randomize,effects,requestedEffects,beats,warnings};
}

// Absolute joint angles: native rigs use world angles, rather than parent-relative angles.
function limb(a,b,l1,l2,bend){
 let dx=b[0]-a[0],dy=b[1]-a[1],dist=Math.hypot(dx,dy);dist=clamp(dist,.01,l1+l2-.001);
 const angle=Math.atan2(dy,dx),offset=Math.acos(clamp((l1*l1+dist*dist-l2*l2)/(2*l1*dist),-1,1)),first=angle+bend*offset;
 const elbow=[a[0]+Math.cos(first)*l1,a[1]+Math.sin(first)*l1];return [first,Math.atan2(b[1]-elbow[1],b[0]-elbow[0])];
}
function pose(figure,action,u,from,to,dir,wasDown){
 const lengths=figure.segments.map(s=>s.length),[torso,,arm,forearm,,,thigh,shin]=lengths;
 const floor=440,height=(thigh+shin)*.94,x=mix(from,to,ease(['punch','kick'].includes(action)?u/.3:u));
 const p=Math.sin(Math.PI*clamp(u,0,1)),hit=Math.sin(Math.PI*clamp((u-.15)/.7,0,1))**4;
 let y=floor-height,lean=0,hop=0;
 if(action==='jump')hop=Math.sin(Math.PI*u)*(thigh+shin)*.7;
 if(action==='dodge')lean=-dir*.65*p;
 if(action==='recoil')lean=-dir*.45*p;
 if(action==='punch'||action==='kick')lean=dir*.18*hit;
 y-=hop;
 const root=[x,y],shoulder=[x+Math.sin(lean)*torso,y-Math.cos(lean)*torso];
 let hands=[[shoulder[0]+dir*25,shoulder[1]+arm+forearm-10],[shoulder[0]-dir*25,shoulder[1]+arm+forearm-10]];
 let feet=[[x-dir*23,floor-hop],[x+dir*23,floor-hop]];
 if(['walk','run','approach'].includes(action)&&from!==to){
  const restingHands=hands,restingFeet=feet,edge=ease(Math.min(1,u*12,(1-u)*12));
  const steps=action==='run'?8:6;
  feet=feet.map((_,i)=>{
   const phase=u*steps+i*.5,cycle=Math.floor(phase),f=phase-cycle;
   const anchor=t=>mix(from,to,ease(clamp((t-i*.5)/steps,0,1)));
   const a=anchor(cycle),b=anchor(cycle+1);
   return [f<.5?a:mix(a,b,ease((f-.5)*2)),floor-(f<.5?0:Math.sin((f-.5)*2*Math.PI)*(action==='run'?36:18))];
  });
  hands=hands.map((h,i)=>[shoulder[0]+Math.sin(u*steps*Math.PI*2+i*Math.PI)*35,shoulder[1]+arm+forearm-18]);
  hands=hands.map((h,i)=>h.map((v,j)=>mix(restingHands[i][j],v,edge)));feet=feet.map((h,i)=>h.map((v,j)=>mix(restingFeet[i][j],v,edge)));
 }
 if(action==='punch')hands[0]=[shoulder[0]+dir*(25+(arm+forearm-26)*hit),shoulder[1]+(arm+forearm-10)*(1-hit)];
 if(action==='kick')feet[1]=[x+dir*(23+(thigh+shin-25)*hit),floor-hop-(height+10)*hit];
 if(action==='block')hands=hands.map((h,i)=>[shoulder[0]+dir*(25+i*12)*p,shoulder[1]+mix(arm+forearm-10,-12+i*20,p)]);
 if(action==='wave'||action==='celebrate')hands=hands.map((h,i)=>i===0||action==='celebrate'?[shoulder[0]+(i?1:-1)*(35+Math.sin(u*Math.PI*8)*10)*p,shoulder[1]+mix(arm+forearm-10,-(arm+forearm)*.85,p)]:h);
 const angles=[-Math.PI/2+lean,-Math.PI/2+lean,...limb(shoulder,hands[0],lengths[2],lengths[3],dir),...limb(shoulder,hands[1],lengths[4],lengths[5],-dir),...limb(root,feet[0],lengths[6],lengths[7],-dir),...limb(root,feet[1],lengths[8],lengths[9],dir)];
 const down=action==='fall'?ease(u):action==='get up'?1-ease(u):wasDown?1:0;
 if(down){const body=dir>0?0:Math.PI,legs=body+Math.PI,flat=[body-dir*.05,body-dir*.05,body-dir*.2,body-dir*.1,body-dir*.12,body-dir*.08,legs-dir*.08,legs+dir*.05,legs+dir*.03,legs-dir*.04];for(let i=0;i<angles.length;i++)angles[i]+=Math.atan2(Math.sin(flat[i]-angles[i]),Math.cos(flat[i]-angles[i]))*down;y=mix(y,floor-12,down);}
 return {x,y,angles};
}
export function* generateScene(options={}){
 const plan=planScene(options),report=emptyDocument(),fps=24,total=plan.duration*fps;
 const supplied=options.figure;if(supplied&&!compatibleSceneFigure(supplied))throw new Error('This figure needs the standard ten-segment humanoid rig. Choose the built-in characters.');
 report.fps=fps;report.figure_types=Array.from({length:plan.people},(_,i)=>{const figure=structuredClone(supplied??defaultFigure());figure.figure_type_id=i+1;figure.name=['Red','Blue','Purple','Green'][i];if(!supplied)for(const s of figure.segments)s.color_rgb=palettes[i];return figure;});
 const art=buildScenery(plan),shadow=plan.shadows?createContactShadow():null;
 report.keyframes=[];report._styk.name=`${plan.theme[0].toUpperCase()+plan.theme.slice(1)} scene · ${plan.duration}s`;report._styk.sceneGenerator=plan;
 const camera=[],vfx=[],rng=random(plan.seed+17),positions=Array.from({length:plan.people},(_,i)=>200+i*560/Math.max(1,plan.people-1)),down=Array(plan.people).fill(false),lastPose=Array(plan.people).fill(null),impactStride=Math.max(1,Math.ceil(plan.beats.filter(b=>b.impact!==null&&b.impact!==undefined).length/190));let impactIndex=0;
 for(let b=0;b<plan.beats.length;b++){
  const beat=plan.beats[b],from=positions.slice(),directions=from.map((x,i)=>plan.people===1?1:(from[opponent(i,plan.people)]>=x?1:-1));
  for(let i=0;i<positions.length;i++){
   const action=beat.actions[i];if(plan.action&&['dash','retreat','aerialkick','uppercut','cross','hook','sweep','launched'].includes(action)){
    if(action==='dash')positions[i]=b===0?(plan.people===1?480:plan.people>2?230+i*120+Math.floor(i/2)*140:410+i*140):clamp(from[opponent(i,plan.people)]-directions[i]*130,160,800);
    else if(action==='retreat')positions[i]=clamp(from[i]-directions[i]*85,160,800);
    else if(action==='launched')positions[i]=clamp(from[i]-directions[i]*115,160,800);
    else if(['uppercut','cross','hook','sweep','aerialkick'].includes(action)&&plan.people>1)positions[i]=clamp(from[opponent(i,plan.people)]-directions[i]*(action==='uppercut'?110:130),160,800);
   }else if(['punch','kick'].includes(action)&&plan.people>1)positions[i]=clamp(from[opponent(i,plan.people)]-directions[i]*120,170,790);
   else if(action==='approach')positions[i]=plan.people===1?480:plan.people>2?230+i*120+Math.floor(i/2)*140:420+i*120;
   else if(['walk','run'].includes(action))positions[i]=clamp(from[i]+(from[i]>700?-1:from[i]<260?1:choose([-1,1],rng))*(action==='run'?180:85),170,790);
  }
  if(plan.effects){
   const strike=beat.actions.findIndex(a=>['punch','cross','hook','uppercut','kick','aerialkick','sweep','fall'].includes(a));
   if(strike>=0){const tick=Math.round(beat.start*fps)+(beat.impact??Math.round(beat.duration*fps*.5)),duration=12;
    if(camera.length<200&&(!plan.action||impactIndex++%impactStride===0)){const impact=createCameraMotion('impact',`impact-${b}`,tick,duration);impact.params.strength=plan.direction==='calm'?.25:plan.direction==='intense'?1:.55;camera.push(impact);}
    const target=beat.actions[strike]==='fall'?strike:opponent(strike,plan.people),clip=createVfxClip({kind:'figure',uid:target+1},'tint',`hit-${b}`,`hit-fx-${b}`,{start:tick,duration:6});
    clip.name='Hit flash';clip.effects=VFX_PRESETS['Hit flash'].effects.map(([type,params],i)=>{const fx=createVfx(type,`hit-${b}-${i}`);Object.assign(fx.params,params);return fx;});clip.fadeOut=5;vfx.push(clip);
   }
   for(const name of plan.requestedEffects)if(b===1||b===Math.floor(plan.beats.length/2)){
    const target=looks[name].scene?{kind:'scene'}:{kind:'figure',uid:1};
    const clip=createVfxClip(target,'tint',`look-${b}-${vfx.length}`,`look-fx-${b}`,{start:Math.round(beat.start*fps),duration:Math.round(beat.duration*fps)});clip.name=name;clip.fadeIn=6;clip.fadeOut=6;
    clip.effects=looks[name].effects.map(([type,params],i)=>{const fx=createVfx(type,`look-${b}-${vfx.length}-${i}`);Object.assign(fx.params,params);return fx;});vfx.push(clip);
   }
   if(/\b(?:shake|handheld|zoom)\b/i.test(plan.prompt)&&b===1)camera.push(createCameraMotion(/handheld/i.test(plan.prompt)?'handheld':/zoom/i.test(plan.prompt)?'pulse':'shake','prompt-camera',Math.round(beat.start*fps),Math.round(beat.duration*fps)));
  }
  const count=Math.round(beat.duration*fps),before=lastPose.slice();
  for(let f=0;f<count;f++){
   const u=f/Math.max(1,count-1),objects=report.figure_types.map((figure,i)=>{let p=plan.action?actionPose(figure,beat.actions[i],u,from[i],positions[i],directions[i]):pose(figure,({cross:'punch',hook:'punch',uppercut:'punch',duck:'dodge',sweep:'kick',flip:'jump',dash:'run',aerialkick:'kick'}[beat.actions[i]]??beat.actions[i]),u,from[i],positions[i],directions[i],down[i]);if(plan.action&&before[i]&&f<3)p=blendActionPose(before[i],p,f/3);lastPose[i]=p;return createObject(figure,i+1,p.x,p.y,{angles:p.angles});});
   if(shadow){const shadows=objects.map(o=>{const scale=Math.max(.45,1-Math.max(0,320-o.root_y)/220);return createObject(shadow,49+o.unique_id,o.root_x-26*scale,442,{scale});});objects.push(...shadows);}
   report.keyframes.push({...createFrame(objects),_styk:{easing:{interpolation:'hold'}}});
  }
  for(let i=0;i<down.length;i++){if(plan.action)positions[i]=lastPose[i].x;if(beat.actions[i]==='fall')down[i]=true;else if(beat.actions[i]==='get up')down[i]=false;}
  yield {progress:report.keyframes.length/total,label:beat.label};
 }
 if(shadow)report.figure_types.push(shadow);
 directScene(report,plan);installScenery(report,plan,art);
 report._styk.palette=[...new Set(report.figure_types.flatMap(f=>[...f.segments,...(f.polyfills??[])].map(s=>s.color_rgb)).concat(art.background?.paint.stops.map(s=>s.color)??[]).filter(Boolean).map(c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('')))].slice(0,64);
 report._styk.cameraMotion={version:1,clips:camera};report._styk.vfxClips={version:1,clips:vfx};validateCameraMotion(report._styk.cameraMotion);validateVfxClips(report._styk.vfxClips);
 return report;
}
