// Preserve and sample the project's current draft montage into deterministic paired atlases.
import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import sharp from 'sharp';
const exec=promisify(execFile),p=fileURLToPath(new URL('../',import.meta.url));
await mkdir(`${p}reviews/revision-3/seek-sources`,{recursive:true});
for(const format of ['landscape','vertical']){
 const input=process.argv.includes('--baseline')?`${p}reviews/revision-3/baseline/${format}.mp4`:`${p}out/${format}.mp4`;
 const source=`${p}reviews/revision-3/seek-sources/${format}.mp4`;
 await copyFile(input,source);
 const w=format==='landscape'?640:360,h=format==='landscape'?360:640;
 const parts=[];
 for(let i=0;i<46;i++){
  const {stdout}=await exec('ffmpeg',['-v','error','-ss',String(11+i/10),'-i',source,'-frames:v','1','-vf',`scale=${w}:${h}`,'-f','image2pipe','-vcodec','png','-'],{encoding:'buffer',maxBuffer:1<<22});
  parts.push({input:stdout,left:i%8*w,top:Math.floor(i/8)*h});
 }
 await sharp({create:{width:w*8,height:h*6,channels:3,background:'#090f22'}}).composite(parts).jpeg({quality:94}).toFile(`${p}assets/evidence/seek-${format}.jpg`);
}
const sources=JSON.parse(await readFile(`${p}assets/evidence/sources.json`));
sources.seek={source:'reviews/revision-3/seek-sources/{landscape,vertical}.mp4',times:Array.from({length:46},(_,i)=>Number((11+i/10).toFixed(1))),columns:8,rows:6,method:'Exact FFmpeg captures of the film montage; 10 frames per source second; forward then reverse timeline selects the same atlas cells'};
await writeFile(`${p}assets/evidence/sources.json`,JSON.stringify(sources,null,2)+'\n');
