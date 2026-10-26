import {buildScenery} from './scene-backgrounds.mjs';
import {emptyDocument,createFrame} from './demo.mjs';
import {buildGeometry} from './pivot/geometry.mjs';
import {drawExportScene} from './export-frame-core.mjs';
import {PlaybackResources} from './playback-resources.mjs';

/** Preview through the same native painter used by video export. */
export function createSceneryPreview(canvas){
 const resources=new PlaybackResources(),ctx=canvas.getContext('2d');
 return {
  update(options){
   const art=buildScenery(options),report=emptyDocument(),frame=createFrame(art.objects);
   report.figure_types=art.figures;report.backgrounds=art.background?[art.background]:[];frame.background_id=art.background?1:0;
   drawExportScene(ctx,report,frame,buildGeometry(report,frame),resources);
  },
  dispose(){resources.dispose();},
 };
}
