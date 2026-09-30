// Narration for the Lull film. Takes: pinned HyperFrames tts (Kokoro-82M, voice af_heart, speed 0.8).
// Regenerate takes:  HYPERFRAMES_PYTHON=<python with kokoro-onnx> node examples/lull/scripts/voice.mjs --takes
// Assemble only:     node examples/lull/scripts/voice.mjs
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const asset = name => fileURLToPath(new URL(`../assets/${name}`, import.meta.url));
const backend = fileURLToPath(new URL('../../../node_modules/hyperframes/bin/hyperframes.mjs', import.meta.url));
const DURATION = 28, TARGET = -17;

// Each line starts at `at` seconds in the film. Keep these in step with storyboard.json.
export const lines = [
  { at: 1.0, text: 'Every app on your phone insists its message matters most.' },
  { at: 6.7, text: 'Lull holds those interruptions back, and gathers them into one quiet digest.' },
  { at: 13.5, text: 'When you\'re ready, the digest is sorted by what needs you.' },
  { at: 18.7, text: 'Only the people you choose can still reach you, when it can\'t wait.' },
];

if (process.argv.includes('--takes')) {
  for (const [i, line] of lines.entries()) {
    await exec(process.execPath, [backend, 'tts', line.text, '-v', 'af_heart', '-s', '0.8', '-o', asset(`voice-takes/line-${i + 1}.wav`), '--json'], { env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1' } });
  }
}

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
await exec('rm', [raw]);
await writeFile(asset('narration-analysis.json'), JSON.stringify({ voice: 'af_heart', speed: 0.8, lines, targetLufs: TARGET, measurement: result }, null, 2) + '\n');
console.log(JSON.stringify({ output, ...result }, null, 2));
