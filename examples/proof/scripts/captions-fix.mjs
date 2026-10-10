// Corrections to genuine ASR: first words cannot precede the clip they came from.
// All other word times remain from transcription; corrections are preserved separately.
import {readFile,writeFile} from 'node:fs/promises';
const p=new URL('../captions.json',import.meta.url),c=JSON.parse(await readFile(p));
for(const g of c.groups)for(const w of g.words){if(w.text==='lades')w.text='leads';if(w.text==='-frame')w.text='frame';if(w.text==='A'&&w.start<.38)w.start=.38;if(w.text==='The'&&w.start>28&&w.start<29.38)w.start=29.38;}
for(const g of c.groups)g.start=g.words[0].start;
c.corrections=['lades → leads; recognition spelling','-frame → frame; recognition punctuation','Opening A onset 0.05 → 0.38; cannot precede line-1 audio clip start','Final The onset 28.64 → 29.38; cannot precede line-6 audio clip start'];
await writeFile(p,JSON.stringify(c,null,2)+'\n');
// Regroup into complete phrases so 'result' is not stranded alone on screen.
const words=c.groups.flatMap(g=>g.words);const lengths=[5,4,4,3,4,4,4,5,5,2,4,6,4,3,3];let pos=0;
c.groups=lengths.map(n=>{const part=words.slice(pos,pos+n);pos+=n;return {start:part[0].start,end:part.at(-1).end+.2,words:part};});
c.groups.forEach((g,i)=>{if(c.groups[i+1])g.end=Math.min(g.end,c.groups[i+1].start);});
if(pos!==words.length)throw new Error('Caption phrase map does not cover the transcript');
await writeFile(p,JSON.stringify(c,null,2)+'\n');
