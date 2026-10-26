/** Connected action phrases. Timings are whole native frames, not padded seconds. */
const PI=Math.PI,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
export function fightBeats(total,people,rng,commands=[]){
 const beats=[];let tick=0,exchange=0;
 const add=(count,a,b,label,actor=0)=>{count=Math.min(count,total-tick);if(count<1)return;const actions=Array(people).fill('guard');actions[actor]=a;if(people>1)actions[(actor%2?actor-1:actor+1<people?actor+1:Math.max(0,actor-1))]=b;
  beats.push({tick,count,start:tick/24,duration:count/24,actions,label,shot:['dash','flip','aerialkick','launched'].includes(a)||b==='launched'?'Wide action':'Close exchange',impact:['punch','cross','hook','uppercut','kick','aerialkick','sweep'].includes(a)?Math.round(count*.42):null});tick+=count;};
 add(24,'dash','dash','Close the distance');
 const phrases=[
  [[12,'punch','block','Jab / cover'],[14,'cross','duck','Cross / duck'],[17,'hook','recoil','Hook connects'],[10,'guard','guard','Read the reaction']],
  [[16,'kick','block','Front kick / guard'],[14,'duck','cross','Duck the counter'],[32,'uppercut','launched','Uppercut / launch'],[22,'guard','get up','Recover footing']],
  [[24,'aerialkick','dodge','Flying kick / evade'],[26,'flip','guard','Acrobatic recovery'],[18,'sweep','fall','Low sweep / fall'],[22,'guard','get up','Roll back to guard']],
  [[12,'punch','dodge','Jab / slip'],[14,'cross','recoil','Cross / knockback'],[16,'kick','block','Kick / block'],[18,'retreat','dash','Break / pursue']],
 ];
 while(tick<total-24){
  const actor=people>2?Math.floor(rng()*people):exchange%2&&people>1?1:0;
  const phrase=commands.length?commands.flatMap((c,i)=>{const items=[[c.action==='run'?22:c.action==='fall'||c.action==='get up'?24:18,c.action==='run'?'dash':c.action,['punch','kick','cross','hook','uppercut','aerialkick','sweep'].includes(c.action)?'recoil':'guard',c.action,c.actor]];if(c.action==='fall'&&!(commands[i+1]?.action==='get up'&&commands[i+1]?.actor===c.actor))items.push([24,'get up','guard','Recover footing',c.actor]);return items;}):phrases[exchange===0?0:Math.floor(rng()*phrases.length)];
  for(const [count,a,b,label,explicit] of phrase){if(tick>=total-24)break;add(Math.min(count,total-24-tick),a,b,`${exchange+1} · ${label}`,explicit??actor);}
  exchange++;
 }
 // A short held guard lands the scene; falls in a truncated phrase recover first.
 const last=beats.at(-1),actions=last?.actions.map(a=>['fall','launched'].includes(a)?'get up':'guard')??Array(people).fill('guard');
 if(tick<total){const count=total-tick;beats.push({tick,count,start:tick/24,duration:count/24,actions,label:'Settle / ready',shot:'Closing wide',impact:null});}
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
export function actionPose(figure,action,u,from,to,dir){
 const c=interpolate(action,u),lengths=figure.segments.map(s=>s.length),height=(lengths[6]+lengths[7])*.94,torso=lengths[0],floor=440;
 let x=lerp(from,to,smooth(['punch','cross','hook','uppercut','kick','aerialkick','sweep'].includes(action)?u/.25:u))+c.shift*dir,y=floor-height+c.crouch-c.hop;
 if(action==='jump'||action==='flip'){y-=Math.sin(PI*u)*145;c.crouch=0;}
 if(action==='flip')c.spin=PI*2*smooth(u);
 if(action==='dash'||action==='retreat'||action==='run'||action==='walk'){
  c.lean=(action==='retreat'?-.2:.35);const stride=Math.sin(u*PI*6);c.feet=[[-32+stride*25,-Math.max(0,-stride)*28],[32-stride*25,-Math.max(0,stride)*28]];c.hands=[[40+stride*25,10],[-30-stride*20,35]];y+=Math.cos(u*PI*12)*3;
 }
 if(action==='launched'){
  const p=clamp((u-.4)/.6,0,1);x=lerp(from,to,smooth(p));c.hop=Math.sin(PI*p)*155;y=floor-height-c.hop;c.down=smooth((p-.7)/.3);c.lean=-Math.sin(PI*p)*1.2;c.head=-.15;c.feet=[[-35,-c.hop-35],[45,-c.hop-50]];c.hands=[[5,20],[-65,35]];
 }
 const root=[0,y],shoulder=[Math.sin(c.lean)*torso,y-Math.cos(c.lean)*torso],hands=c.hands.map(p=>[shoulder[0]+p[0],shoulder[1]+p[1]]),feet=c.feet.map(p=>[p[0],floor+p[1]]);
 const angles=[-PI/2+c.lean,-PI/2+c.lean+c.head,...ik(shoulder,hands[0],lengths[2],lengths[3],1),...ik(shoulder,hands[1],lengths[4],lengths[5],-1),...ik(root,feet[0],lengths[6],lengths[7],-1),...ik(root,feet[1],lengths[8],lengths[9],-1)];
 if(c.down){const flat=[-.05,-.05,-.2,-.1,-.12,-.08,PI-.08,PI+.05,PI+.03,PI-.04];angles.forEach((a,i)=>{angles[i]=a+Math.atan2(Math.sin(flat[i]-a),Math.cos(flat[i]-a))*c.down;});y=lerp(y,floor-12,c.down);}
 if(action==='wave'||action==='celebrate'){angles[2]=-PI*.65+Math.sin(u*PI*5)*.3;angles[3]=-PI*.35;}
 return {x,y,angles:angles.map(a=>dir>0?a+c.spin:PI-a-c.spin)};
}
export function blendActionPose(before,after,t){t=smooth(t);return {x:lerp(before.x,after.x,t),y:lerp(before.y,after.y,t),angles:before.angles.map((a,i)=>a+Math.atan2(Math.sin(after.angles[i]-a),Math.cos(after.angles[i]-a))*t)};}
