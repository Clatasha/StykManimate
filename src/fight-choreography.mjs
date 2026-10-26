/** Connected action phrases. Timings are whole native frames, not padded seconds. */
const PI=Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
export const FIGHT_STYLES={mixed:'Mixed martial arts',boxing:'Boxing',kicks:'Kickboxing',acrobatics:'Acrobatics',power:'Heavy brawler'};
export const FIGHT_STRIKES=['punch','cross','hook','uppercut','kick','aerialkick','sweep','elbow','knee','roundhouse','backkick'];
const styles={
 mixed:['punch','cross','hook','kick','uppercut','sweep','aerialkick','elbow','knee','roundhouse','backkick'],
 boxing:['punch','punch','cross','cross','hook','uppercut'],
 kicks:['kick','kick','roundhouse','backkick','sweep','knee','cross','aerialkick'],
 acrobatics:['aerialkick','roundhouse','sweep','backkick','kick'],
 power:['hook','uppercut','elbow','knee','cross','kick'],
};
const pick=(items,rng)=>items[Math.floor(rng()*items.length)];
const partner=(actor,people)=>actor%2?actor-1:actor+1<people?actor+1:Math.max(0,actor-1);
const recovery=a=>['fall','launched'].includes(a)?'get up':'guard';
/** Compose exchanges from individual attacks, defences and footwork, rather than looping phrases. */
export function fightBeats(total,people,rng,commands=[],style='mixed'){
 const beats=[];let tick=0,exchange=0,lastAttack='',lastActor=-1;
 const add=(count,a,b,label,actor=0,phase='exchange')=>{
  count=Math.min(Math.round(count),total-tick);if(count<1)return;
  const actions=Array(people).fill('guard');actions[actor]=a;if(people>1)actions[partner(actor,people)]=b;
  const hit=FIGHT_STRIKES.includes(a),profile=Array.from({length:people},()=>({reach:.88+rng()*.24,power:.8+rng()*.4,stance:.85+rng()*.3}));
  beats.push({tick,count,start:tick/24,duration:count/24,actions,label,phase,profile,shot:['dash','flip','cartwheel','aerialkick','launched'].includes(a)||b==='launched'?'Wide action':'Close exchange',impact:hit?Math.min(count-1,Math.round(count*.42)):null});tick+=count;
 };
 const opening=commands.length?['dash','dash']:pick([['dash','dash'],['walk','dash'],['jump','dash'],['dash','walk']],rng);
 add(pick([24,30,36],rng),...opening,'Meet / size up',0,'opening');
 while(tick<total-24){
  let actor=people===1?0:Math.floor(rng()*people);
  // A change of initiative is part of the story, not an invariant red/blue alternation.
  if(actor===lastActor&&people>1&&rng()<.65)actor=partner(actor,people);
  const phase=pick(exchange%3===2?['footwork','recovery','burst']:['pressure','burst','counter'],rng);
  const speed=(style==='power'?1.3:style==='acrobatics'?1.1:1)*pick(phase==='burst'?[.75,.85]:[1,1.15,1.35],rng);
  if(commands.length){
   for(let i=0;i<commands.length&&tick<total-24;i++){
    const c=commands[i],a=c.action==='run'?'dash':c.action;
    // Preserve requested actors/actions on every pass; vary timing and their opponents' responses.
    const b=FIGHT_STRIKES.includes(a)?pick(['block','duck','dodge','recoil'],rng):'guard';
    add(Math.min((['fall','get up','flip','cartwheel'].includes(a)?28:18)*speed,total-24-tick),a,b,`${exchange+1} · ${a}`,c.actor,phase);
    if(a==='fall'&&!(commands[i+1]?.action==='get up'&&commands[i+1]?.actor===c.actor))add(Math.min(26,total-24-tick),'get up','guard','Recover footing',c.actor,'recovery');
   }
  }else if(phase==='footwork'||phase==='recovery'){
   const moves=style==='acrobatics'?['cartwheel','flip','roll','sidestep']:style==='boxing'?['sidestep','retreat','feint']:['sidestep','retreat','roll','feint'];
   const a=pick(moves,rng);add(Math.min(pick([22,30,38],rng),total-24-tick),a,a==='retreat'?'dash':'guard',`${exchange+1} · Reposition / ${a}`,actor,phase);
   if(rng()<.5&&tick<total-24)add(Math.min(pick([16,24,36],rng),total-24-tick),'taunt','feint','Challenge / read the guard',partner(actor,people),'recovery');
  }else{
   const length=pick(phase==='burst'?[3,4,5]:[2,3],rng);
   for(let i=0;i<length&&tick<total-24;i++){
    const a=pick(styles[style].filter(a=>a!==lastAttack),rng);lastAttack=a;
    let b=pick(a==='sweep'?['dodge','jump','fall']:a==='uppercut'?['block','dodge','launched']:['block','duck','dodge','recoil'],rng);
    if(style==='power'&&i===length-1)b=pick(['recoil','fall'],rng);
    const count=(['aerialkick','roundhouse','backkick'].includes(a)?26:['uppercut','sweep','knee'].includes(a)?22:16)*speed;
    add(Math.min(b==='launched'?Math.max(32,count):count,total-24-tick),a,b,`${exchange+1} · ${a} / ${b}`,actor,phase);
    if(['fall','launched'].includes(b)&&tick<total-24){add(Math.min(pick([24,30,36],rng),total-24-tick),'guard','get up','Recover / reset',actor,'recovery');break;}
    // A blocked or evaded attack may turn immediately into a counter from the other fighter.
    if(people>1&&['block','duck','dodge'].includes(b)&&rng()<.55){actor=partner(actor,people);}
   }
  }
  lastActor=actor;exchange++;
 }
 const last=beats.at(-1),actions=last?.actions.map(recovery)??Array(people).fill('guard');
 if(tick<total){const count=total-tick;beats.push({tick,count,start:tick/24,duration:count/24,actions,label:'Settle / ready',phase:'ending',shot:'Closing wide',impact:null});}
 return beats;
}
const guard={lean:.04,crouch:0,hop:0,shift:0,head:0,hands:[[42,-23],[-10,24]],feet:[[-38,0],[42,0]],down:0,spin:0};
const control=(values={})=>({...guard,...values});
const keys={
 punch:[[0,{}],[.18,{lean:-.18,shift:-7,hands:[[20,8],[-5,20]]}],[.42,{lean:.30,shift:12,hands:[[98,-5],[15,8]]}],[.56,{lean:.4,shift:16,hands:[[100,8],[20,15]]}],[1,{}]],
 cross:[[0,{}],[.18,{lean:-.24,shift:-8,hands:[[35,-25],[-30,20]]}],[.42,{lean:.42,shift:15,hands:[[28,0],[100,-10]]}],[.64,{lean:.25,shift:10,hands:[[25,12],[95,6]]}],[1,{}]],
 hook:[[0,{}],[.2,{lean:-.28,shift:-8,hands:[[20,10],[-20,30]]}],[.42,{lean:.4,shift:12,hands:[[90,-24],[10,20]]}],[.6,{lean:.5,shift:14,hands:[[55,-20],[10,15]]}],[1,{}]],
 uppercut:[[0,{}],[.22,{crouch:30,lean:-.28,hands:[[16,48],[-15,22]]}],[.42,{hop:12,lean:.3,shift:12,hands:[[70,-66],[15,12]]}],[.6,{hop:22,lean:.08,hands:[[28,-91],[10,22]]}],[1,{}]],
 kick:[[0,{}],[.2,{crouch:8,lean:-.15,feet:[[-38,0],[25,-42]]}],[.42,{lean:-.4,shift:8,feet:[[-38,0],[118,-110]],hands:[[35,0],[-30,25]]}],[.58,{lean:-.35,feet:[[-38,0],[125,-90]]}],[1,{}]],
 aerialkick:[[0,{}],[.18,{crouch:22,lean:.2}],[.42,{hop:110,lean:-.45,feet:[[-22,-90],[118,-190]],hands:[[35,-10],[-45,15]]}],[.65,{hop:95,lean:.3,feet:[[-25,-105],[100,-160]]}],[.88,{crouch:24,lean:.2}],[1,{}]],
 elbow:[[0,{}],[.2,{lean:-.2,hands:[[12,15],[-15,20]]}],[.42,{lean:.55,shift:18,hands:[[15,-35],[20,20]]}],[.65,{lean:.45,hands:[[40,-12],[5,15]]}],[1,{}]],
 knee:[[0,{}],[.22,{crouch:16,hands:[[65,-10],[55,8]]}],[.42,{lean:-.18,hop:18,shift:14,feet:[[-30,0],[30,-100]],hands:[[65,28],[50,40]]}],[.65,{lean:.2,feet:[[-30,0],[42,-75]]}],[1,{}]],
 roundhouse:[[0,{}],[.2,{lean:.1,crouch:12,feet:[[-30,0],[-35,-65]],hands:[[15,15],[-45,10]]}],[.42,{lean:-.6,shift:12,feet:[[-30,0],[140,-160]],hands:[[50,5],[-55,25]]}],[.65,{lean:-.25,feet:[[-30,0],[95,-65]],hands:[[-20,5],[35,-5]]}],[1,{}]],
 backkick:[[0,{}],[.2,{lean:.5,feet:[[-25,0],[20,-50]]}],[.42,{lean:-1.05,shift:10,feet:[[-35,0],[150,-105]],hands:[[-50,25],[-75,15]]}],[.7,{lean:-.6,feet:[[-35,0],[60,-65]]}],[1,{}]],
 sidestep:[[0,{}],[.3,{crouch:28,lean:-.25,feet:[[-65,0],[20,-15]]}],[.65,{crouch:10,lean:.2,feet:[[-20,-15],[65,0]]}],[1,{}]],
 feint:[[0,{}],[.22,{lean:.25,shift:12,hands:[[68,-10],[20,15]]}],[.5,{lean:-.3,shift:-12,crouch:16}],[.75,{lean:.15,hands:[[45,-20],[60,5]]}],[1,{}]],
 taunt:[[0,{}],[.3,{lean:-.2,hands:[[55,-10],[-45,25]]}],[.55,{lean:-.1,hands:[[40,-20],[-45,25]]}],[.8,{lean:-.2,hands:[[55,-10],[-45,25]]}],[1,{}]],
 block:[[0,{}],[.3,{}],[.42,{crouch:9,lean:-.12,hands:[[55,-27],[42,-5]]}],[.65,{crouch:12,lean:-.18,hands:[[48,-20],[32,-5]]}],[1,{}]],
 duck:[[0,{}],[.2,{crouch:20,lean:.1}],[.42,{crouch:65,lean:.55,hands:[[25,-15],[5,-5]],feet:[[-50,0],[52,0]]}],[.68,{crouch:48,lean:.35}],[1,{}]],
 dodge:[[0,{}],[.25,{}],[.42,{lean:-.65,crouch:16,shift:-20,hands:[[35,-5],[-30,30]]}],[.7,{lean:-.35,shift:-15}],[1,{}]],
 recoil:[[0,{}],[.4,{}],[.52,{lean:-.65,shift:-22,head:-.28,hands:[[0,15],[-65,35]]}],[.7,{lean:-.35,shift:-34,hands:[[30,18],[-45,40]]}],[1,{shift:-24}]],
 sweep:[[0,{}],[.2,{crouch:30,lean:.2}],[.42,{crouch:65,lean:-.45,feet:[[-25,0],[120,0]],hands:[[25,-10],[-40,35]]}],[.7,{crouch:48,lean:.2}],[1,{}]],
 fall:[[0,{}],[.4,{}],[.7,{down:.8,shift:-25}],[1,{down:1,shift:-32}]],
 'get up':[[0,{down:1}],[.3,{down:.8,crouch:30}],[.65,{crouch:50,lean:.4,hands:[[20,40],[-5,40]]}],[1,{}]],
};
function interpolate(action,u){const frames=keys[action]??[[0,{}],[1,{}]];let i=0;while(i<frames.length-2&&u>frames[i+1][0])i++;const [t,a]=frames[i],[end,b]=frames[i+1],v=smooth((u-t)/(end-t)),aa=control(a),bb=control(b),out={};for(const key of Object.keys(guard))out[key]=Array.isArray(aa[key])?aa[key].map((p,j)=>p.map((n,k)=>lerp(n,bb[key][j][k],v))):lerp(aa[key],bb[key],v);return out;}
function ik(a,b,l1,l2,bend){const dx=b[0]-a[0],dy=b[1]-a[1],d=clamp(Math.hypot(dx,dy),.1,l1+l2-.001),angle=Math.atan2(dy,dx)+bend*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1)),joint=[a[0]+Math.cos(angle)*l1,a[1]+Math.sin(angle)*l1];return [angle,Math.atan2(b[1]-joint[1],b[0]-joint[0])];}
export function actionPose(figure,action,u,from,to,dir,profile={}){
 const c=interpolate(action,u);c.lean*=profile.power??1;c.hands=c.hands.map(([x,y])=>[x*(profile.reach??1),y]);c.feet=c.feet.map(([x,y])=>[x*(profile.stance??1),y]);const lengths=figure.segments.map(s=>s.length),height=(lengths[6]+lengths[7])*.94,torso=lengths[0],floor=440;
 let x=lerp(from,to,smooth(FIGHT_STRIKES.includes(action)?u/.25:u))+c.shift*dir,y=floor-height+c.crouch-c.hop;
 if(action==='jump'||action==='flip'||action==='cartwheel'){y-=Math.sin(PI*u)*145;c.crouch=0;}
 if(action==='flip'||action==='cartwheel')c.spin=(action==='cartwheel'?-1:1)*PI*2*smooth(u);
 if(action==='dash'||action==='retreat'||action==='run'||action==='walk'){
  c.lean=(action==='retreat'?-.2:.35);const stride=Math.sin(u*PI*6);c.feet=[[-32+stride*25,-Math.max(0,-stride)*28],[32-stride*25,-Math.max(0,stride)*28]];c.hands=[[40+stride*25,10],[-30-stride*20,35]];y+=Math.cos(u*PI*12)*3;
 }
 if(action==='launched'){
  const p=clamp((u-.4)/.6,0,1);x=lerp(from,to,smooth(p));c.hop=Math.sin(PI*p)*155;y=floor-height-c.hop;c.down=smooth((p-.7)/.3);c.lean=-Math.sin(PI*p)*1.2;c.head=-.15;c.feet=[[-35,-c.hop-35],[45,-c.hop-50]];c.hands=[[5,20],[-65,35]];
 }
 const root=[0,y],shoulder=[Math.sin(c.lean)*torso,y-Math.cos(c.lean)*torso],hands=c.hands.map(p=>[shoulder[0]+p[0],shoulder[1]+p[1]]),feet=c.feet.map(p=>[p[0],floor+p[1]]);
 const angles=[-PI/2+c.lean,-PI/2+c.lean+c.head,...ik(shoulder,hands[0],lengths[2],lengths[3],1),...ik(shoulder,hands[1],lengths[4],lengths[5],-1),...ik(root,feet[0],lengths[6],lengths[7],-1),...ik(root,feet[1],lengths[8],lengths[9],-1)];
 if(c.down){const flat=[-.05,-.05,-.2,-.1,-.12,-.08,PI-.08,PI+.05,PI+.03,PI-.04];angles.forEach((a,i)=>{angles[i]=a+Math.atan2(Math.sin(flat[i]-a),Math.cos(flat[i]-a))*c.down;});y=lerp(y,floor-12,c.down);}
 if(action==='roll'){const t=smooth(u),curl=Math.sin(PI*u);y-=curl*30;angles.forEach((a,i)=>{const tucked=[-PI/2,-PI/2,-.4,.7,PI+.4,PI-.7,2.4,.8,.8,2.4][i];angles[i]=a+Math.atan2(Math.sin(tucked-a),Math.cos(tucked-a))*curl-PI*2*t;});}
 if(action==='wave'||action==='celebrate'){angles[2]=-PI*.65+Math.sin(u*PI*5)*.3;angles[3]=-PI*.35;}
 return {x,y,angles:angles.map(a=>dir>0?a+c.spin:PI-a-c.spin)};
}
export function blendActionPose(before,after,t){t=smooth(t);return {x:lerp(before.x,after.x,t),y:lerp(before.y,after.y,t),angles:before.angles.map((a,i)=>a+Math.atan2(Math.sin(after.angles[i]-a),Math.cos(after.angles[i]-a))*t)};}
