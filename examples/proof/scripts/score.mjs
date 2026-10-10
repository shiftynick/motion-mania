// Original optical-bench score. 120 BPM, 4/4. No borrowed samples or melody.
import {execFile} from 'node:child_process';
import {writeFile,rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),SR=48000,DUR=40,N=SR*DUR,T=2*Math.PI;
const L=new Float64Array(N),R=new Float64Array(N);let seed=731;
const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
const hz=n=>440*2**((n-69)/12);
function add(at,len,fn,pan=0,gain=1){const start=Math.round(at*SR),l=Math.sqrt((1-pan)/2),r=Math.sqrt((1+pan)/2);for(let j=0;j<len*SR;j++){const i=start+j;if(i<0||i>=N)continue;const s=j/SR,v=fn(s)*gain*Math.max(0,Math.min(1,s/.003,(len-s)/.02));L[i]+=v*l;R[i]+=v*r;}}
const chords=[{at:0,to:5.3,n:[45,52,59,60,64]},{at:4.8,to:11.3,n:[41,48,55,57,60]},{at:10.8,to:16.3,n:[43,50,57,59,62]},{at:15.8,to:23.3,n:[45,52,59,60]},{at:22.8,to:29.3,n:[48,55,62,64,67]},{at:28.8,to:35.3,n:[43,50,57,60,64]}];
for(const c of chords)c.n.forEach((note,k)=>{const f=hz(note),len=c.to-c.at;add(c.at,len,s=>(Math.sin(T*f*s)+.35*Math.sin(T*f*1.002*s+k)+.09*Math.sin(T*f*2*s))*Math.min(1,s/.6,(len-s)/.7), (k-2)*.27,.035);});
const root=t=>t<5?33:t<11?29:t<16?31:t<23?33:t<29?36:31;
// Hollow low pulse, dry snare, pitched high percussion. Density changes by section.
for(let b=0;b<70;b++){const at=b*.5,full=at>=5&&at<16||at>=23&&at<35;
 if(b%2===0||full&&b%8===7)add(at,.32,s=>Math.sin(T*(47*s+1.6*(1-Math.exp(-36*s))))*Math.exp(-14*s),0,at<5?.19:at>=16&&at<23?.17:.39);
 if(full&&b%4===2){let prev=0;add(at,.15,s=>{const n=rnd();prev+=.19*(n-prev);return (.7*(n-prev)+.2*Math.sin(T*185*s))*Math.exp(-28*s)},-.12,.09);}
 if(full)for(const o of [.25,.375])add(at+o,.055,s=>(rnd()*.65+Math.sin(T*7100*s)*.2)*Math.exp(-110*s),o===.25?-.45:.5,o===.25?.028:.018);
 if(full){const f=hz(root(at)+(b%8===6?7:0));add(at+.25,.28,s=>(Math.sin(T*f*s)+.23*Math.sin(T*f*2*s))*Math.exp(-9*s),0,.13);}
}
// A repeating but reharmonised five-note motif, syncopated rather than a constant arpeggio.
for(const c of chords){const notes=[c.n[2]+12,c.n[c.n.length-1]+12,c.n[3]+12,c.n[1]+24,c.n[2]+12];for(let bar=c.at;bar<c.to-.8;bar+=2)for(const [k,o]of [0,.75,1,1.5,1.75].entries()){const f=hz(notes[k]);add(bar+o,1.2,s=>(Math.sin(T*f*s+1.3*Math.sin(T*f*2*s)*Math.exp(-7*s))+.15*Math.sin(T*f*3*s))*Math.exp(-5*s), (k-2)*.25,c.at>=15&&c.at<23?.009:c.at>=29?.04:.026);}}
// Air is tonal, not a stock riser; it opens the stereo field into the final layouts.
[64,67,71,74].forEach((n,k)=>add(28.5,6.5,s=>Math.sin(T*hz(n)*s)*Math.sin(Math.PI*s/6.5)**2, (k-1.5)*.4,.035));
// Suspended resolution at 35, then a major third on 36. All tails have an envelope to the end.
[33,45,52,59,62,69].forEach((n,k)=>add(35,5,s=>(Math.sin(T*hz(n)*s)+.22*Math.sin(T*hz(n)*1.003*s+k))*Math.exp(-.65*s), (k-2.5)*.28,k===0?.13:.06));
[61,73].forEach((n,k)=>add(36,4,s=>Math.sin(T*hz(n)*s)*Math.exp(-.7*s),k?-.3:.3,.05));
const wav=Buffer.alloc(44+N*4);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(SR,24);wav.writeUInt32LE(SR*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){const t=i/SR,arc=t<5?.65:t<16?1:t<23?.55:t<29?.85:1.12,g=arc*Math.min(1,t/.008,(DUR-t)/1.4);wav.writeInt16LE(Math.round(Math.tanh(L[i]*g)*30000),44+i*4);wav.writeInt16LE(Math.round(Math.tanh(R[i]*g)*30000),46+i*4);}
const p=n=>fileURLToPath(new URL('../assets/'+n,import.meta.url));await writeFile(p('score-raw.wav'),wav);
async function measure(file){const r=await exec('ffmpeg',['-hide_banner','-nostats','-i',file,'-af','ebur128=peak=true','-f','null','-']);const s=r.stderr.slice(r.stderr.lastIndexOf('Summary:'));return{integrated:Number(s.match(/I:\s+(-?[\d.]+)/)[1]),range:Number(s.match(/LRA:\s+([\d.]+)/)[1]),truePeak:Number(s.match(/True peak:\s+Peak:\s+(-?[\d.]+)/)[1])};}
const before=await measure(p('score-raw.wav')),gain=-21-before.integrated;
await exec('ffmpeg',['-v','error','-y','-i',p('score-raw.wav'),'-af',`volume=${gain}dB,alimiter=limit=0.8:attack=2:release=80:level=disabled`,p('score.wav')]);await rm(p('score-raw.wav'));const result={bpm:120,beatOffset:0,seed:731,before,gain,after:await measure(p('score.wav'))};await writeFile(p('score-analysis.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
