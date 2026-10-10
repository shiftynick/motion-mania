// Authoring QA: exact source screenshots and 390px sheets, using the pinned browser.
import puppeteer from 'puppeteer-core';import {readFile,mkdir,writeFile} from 'node:fs/promises';import sharp from 'sharp';import {fileURLToPath} from 'node:url';import {loadProject,buildProject} from '../../../src/project.js';import {execFileSync} from 'node:child_process';
const p=fileURLToPath(new URL('../',import.meta.url));
const project=await loadProject(p),chrome=execFileSync(process.execPath,['node_modules/hyperframes/bin/hyperframes.mjs','browser','path'],{encoding:'utf8'}).trim();
const out=`${p}reviews/revision-3/components`;await mkdir(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-gpu','--allow-file-access-from-files']});
for(const format of ['landscape','vertical']){
 const build=await buildProject(project,format,`${p}.motion/component-${format}`);
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));page.on('console',m=>console.error(m.text()));const {width,height}=project.manifest.formats[format];await page.setViewport({width,height});
 await page.goto(`file://${build}/index.html`);await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Boolean(window.__timelines?.proof),{timeout:5000});
 const times=[0,1.5,9.5,11.5,12.7,14.5,15.95,18,20.5,21.8,23,27.7,30.5,33.7,38.7];let imgs=[];
 for(const time of times){
  await page.evaluate(t=>{window.__timelines.proof.seek(t,false);for(const e of document.querySelectorAll('.clip')){const start=Number(e.dataset.start),dur=Number(e.dataset.duration);e.style.visibility=t>=start&&t<start+dur?'visible':'hidden';}},time);
  const file=`${out}/${format}-${time.toFixed(2)}.png`;await page.screenshot({path:file});
  const data=await sharp(file).resize({width:390}).png().toBuffer();const h=Math.round(height/width*390);imgs.push({input:data,left:imgs.length%3*390,top:Math.floor(imgs.length/3)*(h+30)+30});
  if(time===27.7){const r=await page.evaluate(()=>Object.fromEntries(['#source-value','#report-value'].map(s=>{const b=document.querySelector(s).getBoundingClientRect();return[s,{x:b.x,y:b.y,w:b.width,h:b.height}]})));console.log(format,r);}
 }
 const h=Math.round(height/width*390);await sharp({create:{width:1170,height:Math.ceil(times.length/3)*(h+30),channels:3,background:'#152039'}}).composite(imgs).jpeg({quality:95}).toFile(`${out}/${format}-phone.jpg`);
 await page.close();
}
await browser.close();
