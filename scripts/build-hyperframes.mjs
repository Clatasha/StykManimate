import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {getHyperframeRuntimeScript} from '@hyperframes/core/runtime-script';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function buildHyperframes(){
const root=new URL('../',import.meta.url),out=new URL('vendor/hyperframes/',root);await mkdir(out,{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('src/hyperframes-native.mjs',root))],outfile:fileURLToPath(new URL('native.js',out)),bundle:true,format:'iife',platform:'browser',target:'chrome134',minify:true,external:['node:*'],define:{'import.meta.url':'location.href'},legalComments:'eof',logLevel:'warning'});
await writeFile(new URL('runtime.js',out),getHyperframeRuntimeScript());
await copyFile(new URL('node_modules/@hyperframes/player/dist/hyperframes-player.global.js',root),new URL('player.js',out));
await copyFile(new URL('node_modules/@hyperframes/core/LICENSE',root),new URL('LICENSE',out));
await copyFile(new URL('LICENSE',root),new URL('STYK-LICENSE',out));
await writeFile(new URL('licenses.json',out),JSON.stringify({apache:await readFile(new URL('LICENSE',out),'utf8'),gpl:await readFile(new URL('STYK-LICENSE',out),'utf8')}));
const files={};for(const name of ['native.js','runtime.js','player.js']){const bytes=await readFile(new URL(name,out));files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
await writeFile(new URL('manifest.json',out),JSON.stringify({version:'0.8.200',files},null,2));console.log('Built pinned Hyperframes 0.8.200 presentation assets.');

}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildHyperframes();
