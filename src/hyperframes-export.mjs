import {documentChunks} from './document-transport.mjs';
/** Bounded snapshots keep presentation serialization off the editor thread. */
export function prepareHyperframes(report,{inline=false,signal,baseURL=location.origin}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const worker=new Worker(new URL('./hyperframes-export-worker.mjs',import.meta.url),{type:'module'});let ack,settled=false;
  const finish=(error,result)=>{if(settled)return;settled=true;ack?.();ack=null;worker.terminate();signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve(result);};
  const abort=()=>finish(signal.reason||new DOMException('Cancelled','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  worker.onmessage=({data})=>{if(data.ack){ack?.();ack=null;}else if(data.error)finish(new Error(data.error));else if(Object.hasOwn(data,'result'))finish(null,data.result);};
  worker.onerror=event=>finish(new Error(event.message||'Presentation preparation stopped.'));
  void(async()=>{try{for(const chunk of documentChunks(report,{maxBytes:256*1024,timeBudgetMs:3})){if(settled)return;await new Promise(r=>{ack=r;worker.postMessage({chunk});});}if(!settled)worker.postMessage({inline,baseURL});}catch(error){finish(error);}})();
 });
}
