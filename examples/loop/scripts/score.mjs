// Original stereo score and sound design for The loop. Rebuild: node examples/loop/scripts/score.mjs
// 120 BPM, one chord per shot, cuts on the beat. Sparse under the brief, fuller under the evidence,
// lighter under the critic, and a resolving chord on the lockup. Effects sit only on visible actions.
import { execFile } from 'node:child_process';
import { rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SR = 48000, DUR = 36, N = SR * DUR, TARGET = -21.5;
const L = new Float64Array(N), R = new Float64Array(N);
let seed = 19;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => random() * 2 - 1;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const TAU = 2 * Math.PI;

function add(start, length, fn, pan = 0, gain = 1) {
  const offset = Math.round(start * SR), left = Math.sqrt((1 - pan) / 2), right = Math.sqrt((1 + pan) / 2);
  for (let j = 0; j < length * SR; j++) {
    const i = offset + j;
    if (i < 0 || i >= N) continue;
    const t = j / SR, v = fn(t) * gain * Math.min(1, t / 0.004, (length - t) / 0.02);
    L[i] += v * left; R[i] += v * right;
  }
}

// Shot boundaries from storyboard.json.
const CUTS = [6.5, 12.5, 19, 26, 32];
const section = t => CUTS.filter(c => t >= c).length; // 0 Brief … 5 Ship

// Pads: one chord per shot, crossfading across each cut.
const chords = [
  { at: 0, until: 6.9, notes: [50, 57, 61, 64, 66] },        // Dmaj9
  { at: 6.3, until: 12.9, notes: [47, 54, 57, 61, 62] },     // Bm9
  { at: 12.3, until: 19.4, notes: [43, 50, 54, 57, 62] },    // Gmaj7
  { at: 18.8, until: 26.4, notes: [45, 52, 57, 59, 61, 66] },// A6/9
  { at: 25.8, until: 32.3, notes: [40, 47, 50, 54, 59] },    // Em9
  { at: 31.8, until: 33.6, notes: [45, 52, 57, 61, 64] },    // A (dominant into the lockup)
];
for (const chord of chords) {
  const length = chord.until - chord.at;
  chord.notes.forEach((note, n) => {
    const f = hz(note), pan = (n / (chord.notes.length - 1) - 0.5) * 0.9;
    const envelope = s => Math.min(1, s / 0.5) * Math.min(1, (length - s) / 0.5);
    add(chord.at, length, s => (Math.sin(TAU * f * s) + 0.45 * Math.sin(TAU * f * 1.004 * s + 1) + 0.1 * Math.sin(2 * TAU * f * s)) * envelope(s) * (1 + 0.1 * Math.sin(TAU * 0.5 * s + n)), pan, 0.022);
  });
}

// Rhythm on the 120 BPM grid (one beat = 0.5s).
const kick = t => add(t, 0.32, s => Math.sin(TAU * (50 * s + 2.2 * (1 - Math.exp(-s * 34)))) * Math.exp(-s * 12), 0, 0.42);
const shaker = (t, g) => { let last = 0; add(t, 0.07, s => { last = 0.45 * last + noise() * 0.55; return (noise() - last) * Math.exp(-s * 70); }, 0.25, g); };
const snare = t => { let last = 0; add(t, 0.18, s => { last = 0.6 * last + 0.4 * noise(); return (last * 0.8 + 0.25 * Math.sin(TAU * 190 * s)) * Math.exp(-s * 24); }, -0.1, 0.16); };
for (let beat = 0; beat < 64; beat++) {
  const t = beat * 0.5, part = section(t);
  if (part >= 1 && part <= 3 && beat % 2 === 0) kick(t);
  if (part === 4 && beat % 4 === 0) kick(t);
  if (part === 3 && beat % 2 === 1) snare(t);
  if (part >= 1 && part <= 4) { shaker(t, 0.05); shaker(t + 0.25, 0.08); }
  if (part === 0) shaker(t + 0.25, 0.035);
}
// Bass: eighth-note root and fifth from the build onward.
const roots = [null, null, 43, 45, 40];
for (let e = 0; e < 64; e++) {
  const t = e * 0.5, part = section(t), root = roots[part];
  if (!root || t >= 32) continue;
  [0, 0.25].forEach((offset, k) => {
    const f = hz(root + (k ? 7 : 0) - 12);
    add(t + offset, 0.24, s => Math.tanh(1.6 * Math.sin(TAU * f * s)) * Math.exp(-s * 7), 0, part === 4 ? 0.1 : 0.13);
  });
}
// Keys: off-beat stabs through the evidence.
for (let beat = 0; beat < 14; beat++) {
  const t = 19 + beat * 0.5 + 0.25;
  [57, 61, 64].forEach((note, n) => add(t, 0.3, s => (Math.sin(TAU * hz(note) * s) + 0.3 * Math.sin(2 * TAU * hz(note) * s)) * Math.exp(-s * 9), (n - 1) * 0.3, 0.03));
}

// ---- Sound design ----
// A soft accent on each cut: a short sub thump, felt more than heard.
for (const t of CUTS) add(t, 0.4, s => Math.sin(TAU * (42 * s + 1.5 * (1 - Math.exp(-s * 25)))) * Math.exp(-s * 9), 0, 0.3);
// One soft whoosh per real transition: band-limited noise, little energy below 150 Hz, peaking as the frame lands.
function whoosh(peak, length = 0.55, gain = 0.2, pan = 0) {
  let lp = 0, hp = 0, prev = 0;
  add(peak - length * 0.7, length, s => {
    const x = s / length, cutoff = 0.05 + 0.25 * Math.sin(Math.PI * x);
    lp += cutoff * (noise() - lp);
    hp = 0.97 * (hp + lp - prev); prev = lp;
    return hp * Math.sin(Math.PI * x) ** 2;
  }, pan, gain);
}
whoosh(6.55); whoosh(12.4); whoosh(19.15, 0.5); whoosh(26.15); whoosh(32.4, 0.65, 0.22);
// Clean UI sounds on visible actions only.
const tick = (t, f = 2400, gain = 0.05, pan = 0.2) => add(t, 0.05, s => Math.sin(TAU * f * s) * Math.exp(-s * 90), pan, gain);
const pluck = (t, note, gain = 0.06, pan = 0) => add(t, 0.9, s => (Math.sin(TAU * hz(note) * s) + 0.3 * Math.sin(2 * TAU * hz(note) * s)) * Math.exp(-s * 6), pan, gain);
[7.0, 7.5, 8.0].forEach(t => tick(t, 2200, 0.04));                 // plan fields land
tick(9.05, 1900, 0.045);                                          // selection moves
[10.35, 10.6, 10.8].forEach(t => tick(t, 3000, 0.025, -0.2));     // command typed
pluck(11.0, 74, 0.06); pluck(11.08, 78, 0.05);                     // plan result
[13.4, 14.6, 15.8, 16.9].forEach(t => tick(t, 2100, 0.035));       // code line highlighted
[14.8, 14.9, 15.0, 15.1, 15.2].forEach((t, i) => pluck(t, [62, 66, 69, 74, 69][i], 0.045, (i - 2) * 0.2)); // bars rise
[17.1, 17.35, 17.6].forEach(t => tick(t, 3000, 0.025, -0.2));      // command typed
{ let last = 0; add(18.88, 0.06, s => { last = 0.3 * last + noise(); return last * Math.exp(-s * 60); }, 0, 0.12); add(18.93, 0.05, s => noise() * Math.exp(-s * 80), 0, 0.08); } // shutter flash
pluck(22.65, 62, 0.07); add(22.65, 0.35, s => Math.sin(TAU * 70 * s) * Math.exp(-s * 10), 0, 0.12); // frozen stretch marked
[[28.25, 74], [29.1, 78], [29.95, 81]].forEach(([t, note]) => { tick(t, 2600, 0.04); pluck(t + 0.02, note, 0.055); }); // fixed
const bell = (t, note, gain) => add(t, 3, s => [1, 2.0, 2.76, 4.07].reduce((sum, ratio, k) => sum + Math.sin(TAU * hz(note) * ratio * s) * Math.exp(-s * (1.6 + k)) / (k + 1), 0), 0, gain);
bell(30.35, 86, 0.05); bell(30.45, 81, 0.035);                     // ship
// The resolution: D add9 on the lockup, ringing out.
[38, 50, 57, 62, 64, 66, 69].forEach((note, n) => {
  const f = hz(note), pan = (n / 6 - 0.5) * 0.8;
  add(33.8, 2.2, s => (Math.sin(TAU * f * s) + 0.4 * Math.sin(TAU * f * 1.003 * s + 1)) * Math.min(1, s / 0.02) * Math.exp(-s * 0.9), pan, n ? 0.03 : 0.08);
});
bell(33.8, 74, 0.05);

// The arc: the brief sits about 6 dB under the rest so the first cut opens the mix up, and the
// critic's shot eases back about 2.5 dB before the resolution.
const arc = t => t < 6.2 ? 0.5 : t < 6.5 ? 0.5 + 0.5 * (t - 6.2) / 0.3 : t < 25.8 ? 1 : t < 26.1 ? 1 - 0.25 * (t - 25.8) / 0.3 : t < 31.7 ? 0.75 : t < 32 ? 0.75 + 0.25 * (t - 31.7) / 0.3 : 1;
for (let i = 0; i < N; i++) { const g = arc(i / SR); L[i] *= g; R[i] *= g; }

const wav = Buffer.alloc(44 + N * 4);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, i / (SR * 0.01), (N - i) / (SR * 1.2));
  wav.writeInt16LE(Math.round(Math.tanh(L[i]) * fade * 30000), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.tanh(R[i]) * fade * 30000), 46 + i * 4);
}
const asset = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const raw = asset('score-raw.wav'), output = asset('score.wav');
await writeFile(raw, wav);
const measure = async file => {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  return { integrated: Number(summary.match(/I:\s+(-?[\d.]+)/)[1]), range: Number(summary.match(/LRA:\s+([\d.]+)/)[1]), truePeak: Number(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+)/)[1]) };
};
const before = await measure(raw), gain = Number((TARGET - before.integrated).toFixed(2));
await exec('ffmpeg', ['-hide_banner', '-y', '-i', raw, '-af', `volume=${gain}dB,alimiter=limit=0.7:attack=2:release=80:level=disabled`, output]);
await rm(raw);
const result = { targetLufs: TARGET, before, gain, after: await measure(output) };
await writeFile(asset('score-analysis.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ output, ...result }, null, 2));
