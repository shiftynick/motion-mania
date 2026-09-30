// Original stereo score for the Lull film. Rebuild: node examples/lull/scripts/score.mjs
// Storm (0–6s): pings timed to the same card arrivals as src/scene.js, rising noise, hard stop.
// Lull (6s–): sub swell, slow major-seventh pads, a bell when the chosen person breaks through.
import { execFile } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SR = 48000, DUR = 28, N = SR * DUR, TARGET = -22;
const L = new Float64Array(N), R = new Float64Array(N);
let seed = 7;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => random() * 2 - 1;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

function add(start, length, fn, pan = 0, gain = 1) {
  const offset = Math.round(start * SR), left = Math.sqrt((1 - pan) / 2), right = Math.sqrt((1 + pan) / 2);
  for (let j = 0; j < length * SR; j++) {
    const i = offset + j;
    if (i < 0 || i >= N) continue;
    const t = j / SR, v = fn(t) * gain * Math.min(1, t / 0.004, (length - t) / 0.02);
    L[i] += v * left; R[i] += v * right;
  }
}

// Same arrival curve as scene.js: arrivals accelerate toward the cut at 6s.
export const CARDS = 40;
export const arrival = i => 0.1 + 5.3 * Math.sqrt(i / CARDS);

// Storm: notification pings, a nervous pulse, and a riser that stops dead at 5.97s.
const pingNotes = [88, 91, 93, 95, 96, 98, 100];
for (let i = 0; i < CARDS; i++) {
  const t = arrival(i), a = hz(pingNotes[Math.floor(random() * pingNotes.length)]), b = a * (random() < 0.5 ? 1.335 : 1.498);
  const gain = 0.05 + 0.05 * (i / CARDS), pan = random() * 1.6 - 0.8;
  add(t, 0.09, s => Math.sin(2 * Math.PI * a * s) * Math.exp(-s * 40), pan, gain);
  add(t + 0.07, 0.14, s => Math.sin(2 * Math.PI * b * s) * Math.exp(-s * 30), pan, gain);
}
for (let t = 0; t < 5.95; t += t < 3 ? 0.5 : 0.25) {
  add(t, 0.22, s => Math.sin(2 * Math.PI * (52 * s + 1.4 * (1 - Math.exp(-s * 40)))) * Math.exp(-s * 14), 0, 0.28);
  add(t + (t < 3 ? 0.25 : 0.125), 0.04, () => noise() * 0.5, 0.3, 0.05);
}
{
  let last = 0;
  add(3, 2.97, s => { last = 0.7 * last + 0.3 * noise(); return last * (s / 2.97) ** 2; }, 0, 0.35);
  add(3.5, 2.47, s => Math.sin(2 * Math.PI * (180 * s + 110 * s * s)) * (s / 2.47) ** 3, 0, 0.1);
}

// The lull: a soft sub swell at the cut, then pads crossfading under the voice.
add(6, 3.2, s => Math.sin(2 * Math.PI * (38 * s + 12 * (1 - Math.exp(-s * 3)))) * Math.exp(-s * 1.1) * Math.min(1, s / 0.06), 0, 0.26);
{
  let last = 0;
  add(6, 1.6, s => { last = 0.96 * last + 0.04 * noise(); return last * Math.exp(-s * 2.4) * 4; }, 0, 0.2);
}
const chords = [
  { at: 6.2, until: 13.3, notes: [50, 54, 57, 61, 64] },      // Dmaj9
  { at: 12.9, until: 18.4, notes: [47, 50, 54, 57, 61] },     // Bm9
  { at: 18.0, until: 23.6, notes: [43, 47, 50, 54, 57, 61] }, // Gmaj9
  { at: 23.2, until: 28, notes: [38, 45, 50, 54, 57, 64] },   // D add9, the resolution
];
for (const chord of chords) {
  const length = chord.until - chord.at;
  chord.notes.forEach((note, n) => {
    const f = hz(note), pan = (n / (chord.notes.length - 1) - 0.5) * 0.8;
    const envelope = s => Math.min(1, s / 1.4) * Math.min(1, (length - s) / 1.6);
    add(chord.at, length, s => (Math.sin(2 * Math.PI * f * s) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * s + 1) + 0.12 * Math.sin(4 * Math.PI * f * s)) * envelope(s) * (1 + 0.08 * Math.sin(2 * Math.PI * 0.25 * s + n)), pan, 0.028);
  });
}
// Soft plucks as the digest sections open.
const pluck = (t, note, pan = 0, gain = 0.07) => add(t, 1.4, s => (Math.sin(2 * Math.PI * hz(note) * s) + 0.3 * Math.sin(4 * Math.PI * hz(note) * s)) * Math.exp(-s * 4.5), pan, gain);
[[13.7, 74, -0.3], [14.3, 78, 0.2], [14.9, 81, -0.1], [15.5, 78, 0.3]].forEach(([t, n, p]) => pluck(t, n, p));
// Ghost notifications dissolving at the ring: muted, low taps.
for (const t of [18.55, 19.05, 19.45]) add(t, 0.25, s => Math.sin(2 * Math.PI * 330 * s) * Math.exp(-s * 25), (t - 19) * 1.5, 0.05);
// The breakthrough bell, and an answer when the wordmark lands.
const bell = (t, note, gain) => add(t, 3.5, s => [1, 2.0, 2.76, 4.07, 5.43].reduce((sum, ratio, k) => sum + Math.sin(2 * Math.PI * hz(note) * ratio * s) * Math.exp(-s * (1.4 + k * 0.9)) / (k + 1), 0), 0, gain);
bell(20.05, 86, 0.1);
bell(20.43, 81, 0.05);
bell(23.8, 74, 0.08);

const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (N - i) / (SR * 2.5));
  wav.writeInt16LE(Math.round(Math.tanh(L[i]) * fade * 30000), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.tanh(R[i]) * fade * 30000), 46 + i * 4);
}
const asset = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const raw = asset('score-raw.wav'), output = asset('score.wav');
await writeFile(raw, wav);
const measure = async file => {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  return { integrated: Number(summary.match(/I:\s+(-?[\d.]+)/)[1]), truePeak: Number(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+)/)[1]) };
};
const before = await measure(raw), gain = Number((TARGET - before.integrated).toFixed(2));
await exec('ffmpeg', ['-hide_banner', '-y', '-i', raw, '-af', `volume=${gain}dB,alimiter=limit=0.7:attack=2:release=80:level=disabled`, output]);
await rm(raw);
const result = { targetLufs: TARGET, before, gain, after: await measure(output), cardArrivals: Array.from({ length: CARDS }, (_, i) => Number(arrival(i).toFixed(3))) };
await writeFile(asset('score-analysis.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, before, gain, after: result.after }, null, 2));
