// This document runs inside an opaque sandbox and receives data only from its parent.
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='styk-presentation')return;
 const player=document.querySelector('hyperframes-player');player.setAttribute('runtime-src',new URL('../vendor/hyperframes/runtime.js',location.href).href);player.setAttribute('srcdoc',event.data.html);
 player.addEventListener('ready',()=>parent.postMessage({type:'styk-presentation-ready'},'*'),{once:true});
});
