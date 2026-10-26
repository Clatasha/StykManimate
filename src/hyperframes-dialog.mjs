import {createDialog} from './ui/ui-dialog.mjs';
import {prepareHyperframes} from './hyperframes-export.mjs';
export async function showHyperframes({report,overlays,saveBlob}){
 const body=document.createElement('div');body.className='scene-presentation';
 const note=document.createElement('p');note.textContent='Hyperframes presentation · scrub to review the action. Your editable project stays in StykManimate.';body.append(note);
 const frame=document.createElement('iframe');frame.title='Hyperframes fight presentation';frame.sandbox='allow-scripts';frame.src=new URL('./hyperframes-preview.html',import.meta.url).href;body.append(frame);
 const status=document.createElement('p');status.textContent='Loading local Hyperframes player…';status.setAttribute('role','status');body.append(status);
 const controller=new AbortController();let closed=false;
 const dialog=createDialog({title:'Hyperframes presentation',size:'lg',className:'scene-presentation-dialog',body,overlays,actions:[{label:'Save Hyperframes HTML',value:'save',variant:'primary'}],beforeClose:()=>{controller.abort();return true;},onSubmit:()=>{void save();return false;}});
 async function save(){
  dialog.setBusy(true);try{const blob=await prepareHyperframes(report,{inline:true,signal:controller.signal});if(!closed)await saveBlob(blob,`${report._styk.name.replace(/[\\/:*?"<>|]/g,'_')}-Hyperframes.html`,controller.signal);}catch(error){if(!closed&&!controller.signal.aborted)dialog.setError(error.message);}finally{if(!closed)dialog.setBusy(false);}
 }
 const receive=event=>{if(event.source===frame.contentWindow&&event.data?.type==='styk-presentation-ready')status.textContent='Ready · Hyperframes 0.8.200 · local playback';};window.addEventListener('message',receive);
 frame.addEventListener('load',async()=>{try{const html=await prepareHyperframes(report,{signal:controller.signal});if(!closed)frame.contentWindow.postMessage({type:'styk-presentation',html},'*');}catch(error){if(!closed&&!controller.signal.aborted)dialog.setError(error.message);}},{once:true});
 try{await dialog.showModal();}finally{closed=true;controller.abort();window.removeEventListener('message',receive);frame.src='about:blank';}
}
