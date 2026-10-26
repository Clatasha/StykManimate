import {showHyperframes} from './hyperframes-dialog.mjs';
import {createDialog} from './ui/ui-dialog.mjs';
import {applyDocumentChunk} from './document-transport.mjs';
import {createSceneryPreview} from './scene-background-preview.mjs';
import {SCENE_LOCATIONS,SCENE_LIGHTING} from './scene-backgrounds.mjs';
import {FIGHT_STYLES} from './fight-choreography.mjs';
import {SCENE_DIRECTIONS} from './scene-direction.mjs';
import {planScene,compatibleSceneFigure,SCENE_ACTIONS,SCENE_EFFECTS} from './scene-generator.mjs';

export async function showSceneGenerator({overlays,onImport,saveBlob,figures=[]}){
 const body=document.createElement('div');body.className='scene-generator';
 body.innerHTML=`<p>Create a complete editable scene using supported movements and the editor’s own camera and effect presets. Works locally with no model download.</p>
 <label>Describe your scene<textarea class="ui-field-input" data-field="prompt" rows="3" maxlength="2000" placeholder="Red walks, red punches, blue dodges, blue kicks, red falls, red gets up. Add camera shake and glow."></textarea></label>
 <div class="scene-options">
 <label>Length<select data-field="length"><option value="60">60 seconds</option><option value="120">2 minutes</option><option value="custom">Custom length</option></select></label>
 <label data-custom hidden>Seconds (60–600)<input data-field="duration" type="number" min="60" max="600" step="1" value="60"></label>
 <label>Characters<select data-field="people"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label>
 <label>Theme<select data-field="theme"><option value="fight">Fight</option><option value="chase">Chase</option><option value="comedy">Comedy</option><option value="everyday">Everyday</option><option value="surprise">Surprise me</option></select></label>
 <label>Location<select data-field="location"></select></label>
 <label>Lighting<select data-field="lighting"></select></label>
 <label>Camera style<select data-field="direction"></select></label>
 <label>Movement<select data-field="movement"><option value="action">Action choreography</option><option value="classic">Classic movements</option></select></label>
 <label>Fighting style<select data-field="fightStyle"></select></label>
 <label>Figures<select data-field="figure"><option value="">Built-in colored characters</option></select></label>
 <label>Variation seed<input data-field="seed" type="number" min="0" max="2147483647" step="1" value="1"></label>
 </div>
 <figure class="scene-preview"><canvas width="640" height="360" aria-label="Location preview"></canvas><figcaption></figcaption></figure>
 <label class="scene-check"><input data-field="lockSeed" type="checkbox"> Lock variation seed (repeat the same scene)</label>
 <label class="scene-check"><input data-field="effects" type="checkbox" checked> Add existing effects and impact accents</label>
 <label class="scene-check"><input data-field="shadows" type="checkbox" checked> Contact shadows</label>
 <p data-art-note>Layered vector scenery stays editable. Camera style controls automatic framing. Fighting style applies to Action choreography in the Fight theme.</p>
 <details><summary>Supported prompts and effects</summary><p data-help></p><p>Use Red, Blue, Purple or Green before an action. Actions run in order and are varied across the chosen length, with an opening and ending. Name an effect or look from the list above to add it. Camera: shake, handheld or zoom. Extra story details, props, dialogue, exact counts and arbitrary effects are not interpreted.</p><p>Existing figures with the standard ten-segment humanoid rig are available above. Other rigs need manual posing in the editor.</p></details>
 <p data-status role="status" aria-live="polite">Ready. Generate a random scene with one click, or enter supported actions.</p>
 <progress max="1" value="0" aria-label="Scene generation progress"></progress>
 <p data-notice></p><ol class="scene-storyboard" aria-label="Scene sequence"></ol>
 <div class="scene-buttons"><button type="button" data-generate>Generate from prompt</button><button type="button" data-demo>15-second fight demo</button><button type="button" data-random>Generate random scene</button><button type="button" data-cancel hidden>Cancel</button><button type="button" data-hyperframes hidden>Hyperframes preview / HTML</button><button type="button" data-open hidden>Open editable animation</button></div>`;
 const field=name=>body.querySelector(`[data-field="${name}"]`),status=body.querySelector('[data-status]'),notice=body.querySelector('[data-notice]'),list=body.querySelector('ol'),progress=body.querySelector('progress');
 const demo=body.querySelector('[data-demo]'),presentation=body.querySelector('[data-hyperframes]');
 const generate=body.querySelector('[data-generate]'),random=body.querySelector('[data-random]'),cancel=body.querySelector('[data-cancel]'),open=body.querySelector('[data-open]');
 body.querySelector('[data-help]').textContent=`Actions: ${SCENE_ACTIONS.join(', ')}. Effects and looks: ${SCENE_EFFECTS.join(', ')}.`;
 for(const [name,choices,value] of [['location',SCENE_LOCATIONS,'rooftop'],['lighting',SCENE_LIGHTING,'night'],['direction',SCENE_DIRECTIONS,'cinematic'],['fightStyle',FIGHT_STYLES,'mixed']]){for(const [key,label] of Object.entries(choices)){const option=document.createElement('option');option.value=key;option.textContent=label;field(name).append(option);}field(name).value=value;}
 const sceneryPreview=createSceneryPreview(body.querySelector('.scene-preview canvas'));
 function previewScenery(){const options={location:field('location').value,lighting:field('lighting').value,seed:Number(field('seed').value)||0};sceneryPreview.update(options);body.querySelector('figcaption').textContent=`${SCENE_LOCATIONS[options.location]} · ${SCENE_LIGHTING[options.lighting]}`;}
 field('seed').addEventListener('input',()=>{field('lockSeed').checked=true;});
 for(const name of ['location','lighting','seed'])field(name).addEventListener('change',previewScenery);previewScenery();
 const available=figures.filter(compatibleSceneFigure);
 available.forEach((f,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=f.name||`Figure ${f.figure_type_id}`;field('figure').append(option);});
 for(const label of body.querySelectorAll('label'))label.classList.add('ui-form-row');
 for(const input of body.querySelectorAll('input:not([type="checkbox"]),select'))input.classList.add('ui-field-input');
 for(const button of body.querySelectorAll('button'))button.classList.add('ui-button');open.dataset.variant='primary';
 let worker,report,busy=false,closed=false,opening=false;
 const sync=()=>{for(const input of body.querySelectorAll('input,select,textarea'))input.disabled=busy||opening;generate.disabled=random.disabled=demo.disabled=presentation.disabled=busy||opening;cancel.hidden=!busy;open.disabled=opening;};
 function stop(){if(worker){worker.onmessage=null;worker.onerror=null;}worker?.terminate();worker=null;busy=false;sync();}
 const dialog=createDialog({title:'Generate animated scene',size:'lg',className:'scene-dialog',body,overlays,onSubmit:()=>false,beforeClose:()=>{if(opening)return false;stop();return true;}});
 dialog.form.querySelector('.ui-dialog-foot').append(body.querySelector('.scene-buttons'));
 field('length').addEventListener('change',()=>{body.querySelector('[data-custom]').hidden=field('length').value!=='custom';});
 function run(randomize,sample=false){
  if(busy||opening)return;
  const options={fightStyle:field('fightStyle').value,sample,movement:field('movement').value,duration:Number(field('length').value==='custom'?field('duration').value:field('length').value),people:Number(field('people').value),theme:field('theme').value,prompt:field('prompt').value,seed:Number(field('seed').value),randomize,effects:field('effects').checked,location:field('location').value,lighting:field('lighting').value,direction:field('direction').value,shadows:field('shadows').checked,figure:available[Number.parseInt(field('figure').value,10)]};
  if(sample){options.duration=15;options.theme='fight';options.people=2;options.movement='action';}
  if(!field('lockSeed').checked){const fresh=crypto.getRandomValues(new Uint32Array(1))[0]&2147483647;options.seed=fresh===options.seed?(fresh+1)%2147483648:fresh;field('seed').value=String(options.seed);previewScenery();}
  let plan;try{plan=planScene(options);}catch(error){dialog.setError(error.message);return;}
  dialog.setError('');report=null;open.hidden=true;presentation.hidden=true;progress.value=0;list.replaceChildren();notice.textContent=(plan.action?[`Fighting style: ${FIGHT_STYLES[plan.fightStyle]}.`,...plan.warnings]:plan.warnings).join(' ');
  for(const beat of plan.beats){const li=document.createElement('li');li.textContent=`${beat.start.toFixed(2)}–${(beat.start+beat.duration).toFixed(2)}s · ${beat.label} · ${beat.shot}`;list.append(li);}
  busy=true;sync();status.textContent='Building editable poses…';
  try{
   worker=new Worker(new URL('./scene-worker.mjs',import.meta.url),{type:'module'});
   worker.onmessage=({data})=>{
    if(closed||!busy)return;
    if(data.error){stop();report=null;dialog.setError(data.error);status.textContent='Generation failed. Your current animation was kept.';return;}
    if(data.progress!==undefined){progress.value=data.progress;status.textContent=`Building scene · ${Math.round(data.progress*100)}% · ${data.label}`;}
    if(data.chunk){try{report=applyDocumentChunk(report,data.chunk);worker.postMessage({ack:true});}catch(error){stop();report=null;dialog.setError(error.message);}}
    if(data.complete){stop();open.hidden=false;presentation.hidden=plan.duration>120;status.textContent=`Ready: ${plan.duration} seconds · ${report.keyframes.length} editable frames · ${data.elapsed.toFixed(2)} seconds to prepare. Open to play, adjust and export.`;random.textContent='Generate another random scene';}
   };
   worker.onerror=event=>{stop();report=null;dialog.setError(event.message||'Scene generation stopped.');};
   worker.postMessage({options});
  }catch(error){stop();dialog.setError(error.message);}
 }
 demo.addEventListener('click',()=>run(true,true));presentation.addEventListener('click',()=>{if(report&&!busy)void showHyperframes({report,overlays,saveBlob});});
 generate.addEventListener('click',()=>run(false));random.addEventListener('click',()=>run(true));
 cancel.addEventListener('click',()=>{stop();report=null;status.textContent='Generation cancelled. Your current animation was kept.';});
 open.addEventListener('click',async()=>{if(!report||opening)return;opening=true;sync();try{if(await onImport(report)!==false){opening=false;dialog.close();}}catch(error){dialog.setError(error.message);}finally{opening=false;sync();}});
 sync();await dialog.showModal();closed=true;stop();sceneryPreview.dispose();
}
