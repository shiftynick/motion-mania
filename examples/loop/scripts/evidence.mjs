// Real review evidence shown inside The loop: frames, a cut strip, and the audio and motion data
// of an earlier draft of this same film, plus frames of the final exports.
// Rebuild: node examples/loop/scripts/evidence.mjs <draft review bundle> [<landscape.mp4> <vertical.mp4>]
// The bundle is a `motion-mania review --draft` directory; reviews/ is not committed, so its output is.
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { blockChange } from '../../../src/picture.js';

const exec = promisify(execFile);
const out = name => fileURLToPath(new URL(`../assets/evidence/${name}`, import.meta.url));
const [bundle, landscape, vertical] = process.argv.slice(2);
if (!bundle) throw new Error('Usage: evidence.mjs <draft review bundle> [<landscape.mp4> <vertical.mp4>]');
const draft = path.join(bundle, 'draft.mp4'), report = JSON.parse(await readFile(path.join(bundle, 'report.json'), 'utf8'));
await mkdir(out(''), { recursive: true });
const still = (file, time, width, name) => exec('ffmpeg', ['-v', 'error', '-y', '-ss', String(time), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '3', out(name)]);

// Contact sheet: every 3 seconds. Cut strip: nine adjacent frames around the Plan → Build cut.
const sheet = Array.from({ length: 12 }, (_, i) => i * 3);
for (const [i, t] of sheet.entries()) await still(draft, t, 480, `sheet-${String(i + 1).padStart(2, '0')}.jpg`);
const CUT = 12.5, strip = Array.from({ length: 9 }, (_, i) => Number((CUT + (i - 4) / 30).toFixed(3)));
for (const [i, t] of strip.entries()) await still(draft, t, 240, `strip-${i + 1}.jpg`);

// Waveform columns: peak and RMS of a mono 8 kHz copy of the draft's mix.
const RATE = 8000, COLUMNS = 260;
const pcm = (await exec('ffmpeg', ['-v', 'error', '-i', draft, '-map', '0:a:0', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { encoding: 'buffer', maxBuffer: 1 << 28 })).stdout;
const samples = new Float32Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 4));
const per = Math.floor(samples.length / COLUMNS), peaks = [], levels = [];
for (let c = 0; c < COLUMNS; c++) {
  let peak = 0, sum = 0;
  for (let i = c * per; i < (c + 1) * per; i++) { peak = Math.max(peak, Math.abs(samples[i])); sum += samples[i] ** 2; }
  peaks.push(Number(peak.toFixed(3))); levels.push(Number(Math.sqrt(sum / per).toFixed(3)));
}
// Frame change at 10 fps, measured the same way as `motion-mania picture`.
const W = 160, H = 90, size = W * H;
const gray = (await exec('ffmpeg', ['-v', 'error', '-i', draft, '-vf', `fps=10,scale=${W}:${H}:flags=area,format=gray`, '-f', 'rawvideo', '-'], { encoding: 'buffer', maxBuffer: 1 << 28 })).stdout;
const change = [];
for (let f = 1; f < gray.length / size; f++) change.push(Number(blockChange(gray.subarray(f * size, (f + 1) * size), gray.subarray((f - 1) * size, f * size), W, H).toFixed(2)));

// A plain script (not JSON) so the composition can read it synchronously before registering its timeline.
await writeFile(out('draft.js'), 'window.LOOP_EVIDENCE = ' + JSON.stringify({
  bundle: path.basename(bundle), loudness: report.audio.loudness, heldSeconds: report.picture.heldSeconds,
  holds: report.picture.holds.map(({ from, to, intended, final }) => ({ from, to, intended, final })),
  sheet, strip, waveform: { peaks, levels }, activity: { rate: 10, change },
}) + ';\n');

if (landscape && vertical) {
  await still(landscape, 16.2, 800, 'export-landscape.jpg');
  await still(vertical, 16.2, 360, 'export-vertical.jpg');
}
console.log(JSON.stringify({ bundle: path.basename(bundle), frames: sheet.length + strip.length, columns: COLUMNS, activity: change.length, exports: Boolean(landscape && vertical) }));
