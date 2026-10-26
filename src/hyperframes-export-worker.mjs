import {applyDocumentChunk} from './document-transport.mjs';
import {hyperframesComposition,hyperframesHTML} from './hyperframes-composition.mjs';
let report;
self.onmessage=async({data})=>{
 try{if(data.chunk){report=applyDocumentChunk(report,data.chunk);self.postMessage({ack:true});return;}
  const result=data.inline?await hyperframesHTML(report):hyperframesComposition(report,{baseURL:data.baseURL});self.postMessage({result});report=null;
 }catch(error){self.postMessage({error:error.message});}
};
