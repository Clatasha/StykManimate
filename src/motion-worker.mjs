import {MotionDocument} from './motion-document.mjs';
import {documentChunks} from './document-transport.mjs';

let receipt;
self.onmessage=async ({data})=>{
  if(data.ack){receipt?.();return;}
  try {
    const {baseURL,token,jobId,file,options}=data;
    const query=new URLSearchParams(options);
    const response=await fetch(new URL(`/api/motion/capture?${query}`,baseURL),{method:'POST',body:file,
      headers:{'Content-Type':'application/octet-stream','X-Styk-Job-Id':jobId,...(token?{Authorization:`Bearer ${token}`}:{})}});
    if(!response.ok){const error=await response.json();throw new Error(error.error?.message||error.error||`Capture failed (${response.status}).`);}
    const reader=response.body.getReader(),decoder=new TextDecoder();
    let buffer='',builder,metrics;
    for(;;){
      const {value,done}=await reader.read();
      buffer+=decoder.decode(value,{stream:!done});
      if(buffer.length>2*1024*1024)throw new Error('Invalid capture response.');
      let newline;
      while((newline=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
        if(!line.trim())continue;
        const item=JSON.parse(line);
        if(item.type==='error')throw new Error(item.error);
        if(item.type==='header'){builder=new MotionDocument(item,file.name.replace(/\.[^.]+$/,'')+' motion');self.postMessage({progress:item});}
        else if(item.type==='frame'){
          if(!builder)throw new Error('Missing motion header.');
          builder.append(item);
          // UI progress updates at most four times/second, plus the final frame.
          if(item.progress.elapsed-(self.lastProgress??-1)>.25||item.progress.frames===item.progress.total){self.lastProgress=item.progress.elapsed;self.postMessage({progress:item.progress});}
        }else if(item.type==='done')metrics=item;
        else if(item.type==='stage')self.postMessage({progress:item});
      }
      if(done)break;
    }
    if(!builder||!metrics||buffer.trim())throw new Error('The video conversion was interrupted; no partial project was opened.');
    const report=builder.finish(metrics);
    for(const chunk of documentChunks(report,{maxBytes:256*1024,timeBudgetMs:3})){
      const acknowledged=new Promise(resolve=>{receipt=resolve;});
      self.postMessage({chunk});await acknowledged;
    }
    self.postMessage({complete:true,metrics});
  }catch(error){self.postMessage({error:error.message||String(error)});}
};
