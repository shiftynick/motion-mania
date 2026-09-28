// Original stereo score for this film. Rebuild: node examples/launch-v2/scripts/score.mjs
import {writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile), SR=48000, DUR=15, N=SR*DUR;
const L=new Float64Array(N), R=new Float64Array(N);
let seed=91;
const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2147483648-1;};
function add(start,len,fn,pan=0){
 const offset=Math.round(start*SR), left=Math.sqrt((1-pan)/2),right=Math.sqrt((1+pan)/2);
 for(let j=0;j<len*SR;j++){const i=offset+j;if(i<0||i>=N)continue;const t=j/SR,v=fn(t,j)*Math.min(1,t/.003,(len-t)/.012);L[i]+=v*left;R[i]+=v*right;}
}
const kick=t=>Math.sin(2*Math.PI*(43*t+2.1*(1-Math.exp(-35*t))))*Math.exp(-t*12)*.66;
const hat=t=>noise()*Math.exp(-t*80)*.045;
function pluck(time,freq,pan=.0,gain=.12){add(time,.75,t=>(Math.sin(2*Math.PI*freq*t)+.25*Math.sin(4*Math.PI*freq*t))*Math.exp(-t*7)*gain,pan);}
function sweep(end){let last=0;add(end-.3,.38,t=>{last=.55*last+.45*noise();return last*Math.pow(Math.sin(Math.PI*t/.38),2)*.16;},-.2);}
for(let b=0;b<24;b++){
 const t=b*.5;
 if(b>=5||b%2===0)add(t,.45,kick);
 if(b>=5){add(t+.25,.06,hat,b%2?.35:-.35);if(b%2)add(t,.12,s=>noise()*Math.exp(-s*42)*.11);}
 const root=b<13?55:b<19?65.406:73.416;
 if(b>=5)add(t,.38,s=>{const sidechain=1-Math.exp(-s*24);return (Math.sin(2*Math.PI*root*s)+.17*Math.sin(6*Math.PI*root*s))*Math.exp(-s*5)*.24*sidechain;});
 if(b%2===0)pluck(t+.25,[220,261.626,329.628,440][Math.floor(b/2)%4],b%4?-.45:.45,.075);
}
for(const time of [2.5,4.5,6.5,9.5,12]){sweep(time);add(time,.5,kick);pluck(time,880,0,.1);}
for(const time of [2.7,2.82,2.94,3.06,3.18])add(time,.025,t=>Math.sin(2*Math.PI*2300*t)*Math.exp(-t*170)*.055,.25);
for(const [i,f] of [55,110,164.814,220,261.626,329.628].entries())add(12,2.9,t=>Math.sin(2*Math.PI*f*t)*Math.exp(-t*1.15)*.09,(i-2.5)/5);
add(12,.7,kick);
const wav=Buffer.alloc(44+N*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){const fade=Math.min(1,(N-i)/(SR*.5));wav.writeInt16LE(Math.round(Math.tanh(L[i])*fade*28000),44+i*4);wav.writeInt16LE(Math.round(Math.tanh(R[i])*fade*28000),46+i*4);}
const raw=fileURLToPath(new URL('../assets/score-raw.wav',import.meta.url));
const output=fileURLToPath(new URL('../assets/score-v2.wav',import.meta.url));
await writeFile(raw,wav);
const first=await exec('ffmpeg',['-hide_banner','-i',raw,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const m=JSON.parse(first.stderr.slice(first.stderr.lastIndexOf('{'), first.stderr.lastIndexOf('}')+1));
const filter=`loudnorm=I=-16:TP=-1.5:LRA=9:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
const second=await exec('ffmpeg',['-hide_banner','-y','-i',raw,'-af',filter,'-ar',String(SR),output]);
const result=JSON.parse(second.stderr.slice(second.stderr.lastIndexOf('{'), second.stderr.lastIndexOf('}')+1));
await writeFile(new URL('../assets/score-analysis.json',import.meta.url),JSON.stringify({bpm:120,transitions:[2.5,4.5,6.5,9.5,12],targetLufs:-16,truePeakLimit:-1.5,measurement:result},null,2)+'\n');
await rm(raw);
console.log(JSON.stringify({output,...result},null,2));
