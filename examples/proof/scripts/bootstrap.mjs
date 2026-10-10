import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {writeFile} from 'node:fs/promises';import sharp from 'sharp';
const exec=promisify(execFile),base=new URL('../assets/evidence/',import.meta.url);
const pcm=(await exec('ffmpeg',['-v','error','-i',new URL('../assets/score.wav',import.meta.url).pathname,'-ac','1','-ar','8000','-f','f32le','-'],{encoding:'buffer',maxBuffer:1<<26})).stdout;
const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4),wave=[];
for(let i=0;i<420;i++){let peak=0;for(let j=Math.floor(i*samples.length/420);j<Math.floor((i+1)*samples.length/420);j++)peak=Math.max(peak,Math.abs(samples[j]));wave.push(peak*(i%2?-1:1)*2);}
await writeFile(new URL('data.js',base),'window.PROOF_EVIDENCE='+JSON.stringify({wave})+';\n');
const svg='<svg width="960" height="540"><rect width="960" height="540" fill="#101d3b"/><circle cx="480" cy="270" r="150" fill="none" stroke="#3978ff" stroke-width="30"/></svg>';
for(const name of ['before','defect','after','repaired','layout-landscape','layout-vertical'])await sharp(Buffer.from(svg)).jpeg().toFile(new URL(name+'.jpg',base).pathname);
