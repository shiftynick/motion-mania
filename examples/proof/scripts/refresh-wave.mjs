import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),p=new URL('../assets/evidence/data.js',import.meta.url),txt=await readFile(p,'utf8'),E=JSON.parse(txt.slice(txt.indexOf('=')+1).trim().replace(/;$/,''));
const pcm=(await exec('ffmpeg',['-v','error','-i',fileURLToPath(new URL('../reviews/controlled-draft.mp4',import.meta.url)),'-ac','1','-ar','8000','-f','f32le','-'],{encoding:'buffer',maxBuffer:1<<26})).stdout;
const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);E.wave=[];
for(let i=0;i<420;i++){let peak=0;for(let j=Math.floor(i*samples.length/420);j<Math.floor((i+1)*samples.length/420);j++)peak=Math.max(peak,Math.abs(samples[j]));E.wave.push(peak*(i%2?-1:1)*1.4);}
await writeFile(p,'window.PROOF_EVIDENCE='+JSON.stringify(E)+';\n');
