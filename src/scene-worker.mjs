import {generateScene} from './scene-generator.mjs';
import {documentChunks} from './document-transport.mjs';
let receipt;
self.onmessage=async ({data})=>{
 if(data.ack){receipt?.();return;}
 try{
  const started=performance.now(),generator=generateScene(data.options);let next;
  do{next=generator.next();if(!next.done)self.postMessage(next.value);}while(!next.done);
  const report=next.value;
  for(const chunk of documentChunks(report,{maxBytes:256*1024,timeBudgetMs:3})){
   const ack=new Promise(resolve=>{receipt=resolve;});self.postMessage({chunk});await ack;
  }
  self.postMessage({complete:true,elapsed:(performance.now()-started)/1000});
 }catch(error){self.postMessage({error:error.message||String(error)});}
};
