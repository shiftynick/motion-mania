// Inspect actual encoded delivery frames at native size and at 390px width.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const exec=promisify(execFile),p=fileURLToPath(new URL('../',import.meta.url));
const sb=JSON.parse(await readFile(`${p}storyboard.json`,'utf8'));
const special=[1.0,1.5,11.5,12.7,14.5,20.3,20.4,20.5,20.6,20.7,21.8,27.7,30.5,33.7,38.7,39.967];
const times=[...new Set([...Array.from({length:40},(_,i)=>i),...sb.shots.map(s=>s.reviewAt),...special])].sort((a,b)=>a-b);
const root=`${p}reviews/revision-3/encoded`;await mkdir(root,{recursive:true});
for(const format of ['landscape','vertical']){
 const native=`${root}/${format}`,phone=`${root}/${format}-phone`;await mkdir(native,{recursive:true});await mkdir(phone,{recursive:true});
 const h=format==='landscape'?219:693,rows=Math.ceil(times.length/3),images=[];
 for(const [i,t] of times.entries()){
  const name=`${t.toFixed(3)}.png`,file=`${native}/${name}`;
  await exec('ffmpeg',['-v','error','-y','-ss',String(t),'-i',`${p}out/${format}.mp4`,'-frames:v','1',file]);
  const img=await sharp(file).resize({width:390}).png().toBuffer();await writeFile(`${phone}/${name}`,img);
  images.push({input:img,left:i%3*390,top:Math.floor(i/3)*(h+28)+28});
  const title=Buffer.from(`<svg width="390" height="28"><text x="8" y="20" font-family="sans-serif" font-size="16" fill="white">${t.toFixed(3)}s</text></svg>`);
  images.push({input:title,left:i%3*390,top:Math.floor(i/3)*(h+28)});
 }
 await sharp({create:{width:1170,height:rows*(h+28),channels:3,background:'#182039'}}).composite(images).jpeg({quality:95}).toFile(`${root}/${format}-sheet.jpg`);
 for(const [i,cut] of [5,11,16,23,29,35].entries()){
  const strip=[];
  for(let j=-4;j<=4;j++){
   const t=cut+j/30,file=`${native}/cut-${cut}-${j+4}.png`;
   await exec('ffmpeg',['-v','error','-y','-ss',String(t),'-i',`${p}out/${format}.mp4`,'-frames:v','1',file]);
   const img=await sharp(file).resize({width:390}).png().toBuffer();strip.push({input:img,left:(j+4)*390,top:28});
   strip.push({input:Buffer.from(`<svg width="390" height="28"><text x="8" y="20" font-family="sans-serif" font-size="16" fill="white">${t.toFixed(3)}s</text></svg>`),left:(j+4)*390,top:0});
  }
  await sharp({create:{width:3510,height:h+28,channels:3,background:'#182039'}}).composite(strip).jpeg({quality:95}).toFile(`${root}/${format}-transition-${i+1}.jpg`);
 }
 console.log(`${format}: ${times.length} native/phone samples and six nine-frame boundary strips`);
}
await writeFile(`${root}/times.json`,JSON.stringify(times,null,2)+'\n');
