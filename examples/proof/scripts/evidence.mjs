// Build an isolated controlled draft from this film, plant exactly one visible frame,
// measure it, preserve the real reports, and extract onscreen evidence. No toolkit source edits.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {cp,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),project=fileURLToPath(new URL('../',import.meta.url));
const cli=fileURLToPath(new URL('../../../src/cli.js',import.meta.url));
const probe=path.join(project,'.motion','controlled-project'),out=path.join(project,'assets/evidence');
const previousSources=JSON.parse(await readFile(path.join(out,'sources.json'),'utf8'));
async function command(args){console.error('motion-mania '+args.join(' '));const r=await exec(process.execPath,[cli,...args,'--json'],{maxBuffer:1<<25,timeout:1200000});return JSON.parse(r.stdout);}
await mkdir(probe,{recursive:true});await mkdir(out,{recursive:true});
for(const f of ['src','assets','motion.json','brand.json','brief.md','storyboard.json','captions.json'])await cp(path.join(project,f),path.join(probe,f),{recursive:true});
const scene=await readFile(path.join(probe,'src/scene.js'),'utf8');
await writeFile(path.join(probe,'src/scene.js'),scene.replace('window.__timelines=window.__timelines||{};',"tl.set('#probe',{opacity:1},0.8);tl.set('#probe',{opacity:0},0.833333333333333);\nwindow.__timelines=window.__timelines||{};"));
const rendered=await command(['render','--project',probe,'--format','landscape','--quality','draft']);
const mp4=path.join(probe,'out/landscape.mp4');await copyFile(mp4,path.join(project,'reviews','controlled-draft.mp4'));
const picture=await command(['picture','--project',probe,'--format','landscape']);await writeFile(path.join(out,'picture-report.json'),JSON.stringify(picture,null,2)+'\n');
const master=await command(['audio','--project',probe,'--format','landscape','--master']);await writeFile(path.join(out,'master-report.json'),JSON.stringify(master.results[0],null,2)+'\n');
const plan=await command(['plan','--project',project]);await writeFile(path.join(out,'plan-report.json'),JSON.stringify(plan,null,2)+'\n');
const finding=picture.results[0].transients.find(t=>Math.abs(t.at-0.8)<.06);if(!finding)throw new Error('The planted defect was not detected; inspect actual report.');
const still=async(file,t,name)=>exec('ffmpeg',['-v','error','-y','-ss',String(t),'-i',file,'-frames:v','1','-vf','crop=864:634:984:240,scale=960:-2','-q:v','2',path.join(out,name+'.jpg')]);
const original=path.join(project,'reviews/controlled-draft.mp4');
await still(original,0.766666667,'before');await still(original,0.8,'defect');await still(original,0.833333333,'after');
const repair=await command(['frame','--project',project,'--format','landscape','--at','0.8']);
await exec('ffmpeg',['-v','error','-y','-i',repair.results[0].frames[0].path,'-vf','crop=864:634:984:240,scale=960:-2','-q:v','2',path.join(out,'repaired.jpg')]);
for(const format of ['landscape','vertical']){const r=await command(['frame','--project',project,'--format',format,'--at','3.7']);await exec('ffmpeg',['-v','error','-y','-i',r.results[0].frames[0].path,'-vf',format==='landscape'?'scale=960:-2':'scale=540:-2','-q:v','2',path.join(out,'layout-'+format+'.jpg')]);}
const pcm=(await exec('ffmpeg',['-v','error','-i',original,'-ac','1','-ar','8000','-f','f32le','-'],{encoding:'buffer',maxBuffer:1<<26})).stdout;
const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4),wave=[];
for(let i=0;i<420;i++){let peak=0;for(let j=Math.floor(i*samples.length/420);j<Math.floor((i+1)*samples.length/420);j++)peak=Math.max(peak,Math.abs(samples[j]));wave.push(peak*(i%2?-1:1)*1.4);}
const metrics=master.results[0].mastering;
const value={wave,before:metrics.before,after:metrics.after,defect:finding,grid:{bpm:plan.bpm,cuts:plan.beatGrid.length,off:plan.beatGrid.filter(b=>Math.abs(b.offsetFrames)>1).length}};
await writeFile(path.join(out,'data.js'),'window.PROOF_EVIDENCE='+JSON.stringify(value)+';\n');
await writeFile(path.join(out,'sources.json'),JSON.stringify({...(previousSources.seek?{seek:previousSources.seek}:{}),controlledDraft:'reviews/controlled-draft.mp4',plant:{at:0.8,duration:1/30,frame:24,method:'Isolated project copy: rose region opacity for one frame; final source never contains these sets'},reports:{picture:'picture-report.json',master:'master-report.json',grid:'plan-report.json'},crop:{x:984,y:240,width:864,height:634,reason:'Ring only; remove nested titles and captions'},frames:{before:0.766666667,defect:0.8,after:0.833333333,repaired:0.8,layouts:3.7},claims:{sound:'master-report.json: mastering.before / mastering.after',pulse:'plan-report.json: beatGrid',defect:'picture-report.json: results[0].transients'}},null,2)+'\n');
console.log(JSON.stringify(value,null,2));
