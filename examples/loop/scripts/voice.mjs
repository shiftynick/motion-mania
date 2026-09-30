// Narration for The loop. Takes: pinned HyperFrames tts (Kokoro-82M, voice af_heart, speed 0.82).
// Regenerate takes:  HYPERFRAMES_PYTHON=<python with kokoro-onnx> node examples/loop/scripts/voice.mjs --takes
// Assemble only:     node examples/loop/scripts/voice.mjs
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const asset = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const backend = fileURLToPath(new URL('../../../node_modules/hyperframes/bin/hyperframes.mjs', import.meta.url));
const VOICE = 'af_heart', SPEED = 0.82, TARGET = -15.5;
export const DURATION = 36;

// Each line starts at `at` seconds in the film. Keep these in step with storyboard.json.
export const lines = [
  { at: 0.6, text: 'Your coding agent starts from a brief, and plans every shot before it animates anything.' },
  { at: 6.9, text: 'Each shot records its goal, its focal point, and what carries forward.' },
  { at: 12.9, text: 'The animation is ordinary code, rendered into real frames you can inspect.' },
  { at: 19.3, text: 'Contact sheets, cut strips, and charts of the sound and motion show what actually rendered.' },
  { at: 26.3, text: 'Then a second agent reviews each round, and checks that every fix really landed.' },
];

if (process.argv.includes('--takes')) {
  await mkdir(asset('voice-takes'), { recursive: true });
  for (const [i, line] of lines.entries()) {
    await exec(process.execPath, [backend, 'tts', line.text, '-v', VOICE, '-s', String(SPEED), '-o', asset(`voice-takes/line-${i + 1}.wav`), '--json'], { env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1' } });
  }
}

const duration = async file => Number((await exec('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).stdout);
const takes = [];
for (const [i, line] of lines.entries()) takes.push({ ...line, seconds: Number((await duration(asset(`voice-takes/line-${i + 1}.wav`))).toFixed(2)) });

const inputs = lines.flatMap((_, i) => ['-i', asset(`voice-takes/line-${i + 1}.wav`)]);
const placed = lines.map((line, i) => `[${i}:a]aresample=48000,adelay=${Math.round(line.at * 1000)}[l${i}]`).join(';');
const mix = `${placed};${lines.map((_, i) => `[l${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad=whole_dur=${DURATION},atrim=0:${DURATION}`;
const raw = asset('narration-raw.wav'), output = asset('narration.wav');
await exec('ffmpeg', ['-hide_banner', '-y', ...inputs, '-filter_complex', mix, '-ac', '1', raw]);
// One measured gain change for the whole read, then a fast peak limiter for plosives. No compression between lines.
const measure = async file => {
  const { stderr } = await exec('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  return { integrated: Number(summary.match(/I:\s+(-?[\d.]+)/)[1]), truePeak: Number(summary.match(/True peak:\s+Peak:\s+(-?[\d.]+)/)[1]) };
};
const before = await measure(raw), gain = Number((TARGET - before.integrated).toFixed(2));
await exec('ffmpeg', ['-hide_banner', '-y', '-i', raw, '-af', `volume=${gain}dB,alimiter=limit=0.63:attack=2:release=60:level=disabled`, '-ar', '48000', output]);
const result = { before, gain, after: await measure(output) };
await rm(raw);
await writeFile(asset('narration-analysis.json'), JSON.stringify({ voice: VOICE, speed: SPEED, lines: takes, targetLufs: TARGET, measurement: result }, null, 2) + '\n');
console.log(JSON.stringify({ output, takes: takes.map(t => ({ at: t.at, seconds: t.seconds, ends: Number((t.at + t.seconds).toFixed(2)), wpm: Math.round(t.text.split(/\s+/).length / t.seconds * 60) })), ...result }, null, 2));
