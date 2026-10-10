import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hf, probe, run } from './process.js';
import { envelope } from './audio.js';
import { writeJson } from './project.js';

export function musicMoments(env) {
  const width = Math.max(1, Math.round(0.5 / env.window)), levels = [];
  let power = 0;
  for (let i = 0; i < env.db.length; i++) {
    power += 10 ** (env.db[i] / 10);
    if (i >= width) power -= 10 ** (env.db[i - width] / 10);
    if (i >= width - 1) levels.push({ at: Number(((i - width + 1) * env.window).toFixed(3)), levelDb: 10 * Math.log10(Math.max(1e-12, power / width)) });
  }
  if (!levels.length) return { loudestMoment: null, drop: null };
  const loudest = levels.reduce((best, item) => item.levelDb > best.levelDb ? item : best);
  let drop = null;
  for (let i = width; i < levels.length; i++) {
    const riseDb = levels[i].levelDb - levels[i - width].levelDb;
    if (levels[i].levelDb > -60 && riseDb >= 3 && (!drop || riseDb > drop.riseDb)) drop = { at: levels[i].at, riseDb: Number(riseDb.toFixed(1)) };
  }
  return { loudestMoment: { ...loudest, levelDb: Number(loudest.levelDb.toFixed(1)), window: 0.5 }, drop };
}

export function beatSummary(payload, data) {
  if (!Number.isFinite(payload.bpm) || payload.bpm <= 0 || !Array.isArray(data.beats) || !data.beats.length || data.beats.some(b => !Number.isFinite(b.time) || b.time < 0 || !Number.isFinite(b.strength))) throw new Error('HyperFrames did not return a usable tempo and beat grid.');
  return { bpm: payload.bpm, beatOffset: data.beats[0].time, beats: data.beats, downbeats: null, limitations: ['Constant tempo assumption; half/double-tempo ambiguity. Confirm the grid by listening.', 'HyperFrames does not expose meter or downbeats; downbeats are unknown.', 'Times are relative to the supplied file, not composition time. Add the music clip start and subtract its media trim when snapping cuts.', 'Drop is the strongest rise between adjacent 0.5s energy windows; it is a candidate, not a musical judgment.'] };
}

export async function beatsReport(project, input) {
  if (!input) throw new Error('beats requires --input <music-file>');
  const file = path.resolve(input), metadata = await probe(file);
  if (!metadata.streams?.some(s => s.codec_type === 'audio')) throw new Error('Beat input has no audio stream.');
  const duration = Number(metadata.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error('Beat input must have a known duration up to 600 seconds.');
  const temp = await mkdtemp(path.join(os.tmpdir(), 'motion-beats-'));
  try {
    await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '22050', path.join(temp, 'music.wav')], { quiet: true });
    await writeFile(path.join(temp, 'index.html'), '<!doctype html><audio id="music" data-timeline-role="music" src="music.wav"></audio>');
    const detected = await hf(['beats', temp, '--json'], { quiet: true });
    const match = detected.stdout.match(/\{\s*"ok"[\s\S]*\}\s*$/);
    if (!match) throw new Error('HyperFrames did not report beat results.');
    const summary = beatSummary(JSON.parse(match[0]), JSON.parse(await readFile(path.join(temp, 'beats/music.wav.json'), 'utf8')));
    const raw = path.join(temp, 'music.f32');
    await run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 'f32le', raw], { quiet: true });
    const bytes = await readFile(raw), samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length - bytes.length % 4));
    const parent = path.join(project.root, 'reviews');
    await mkdir(parent, { recursive: true });
    const output = await mkdtemp(path.join(parent, 'beats-')), report = path.join(output, 'report.json');
    const result = { ok: true, file, duration, ...summary, ...musicMoments(envelope(samples)), detector: 'hyperframes@0.8.145 beats', report };
    await writeJson(report, result);
    return result;
  } finally { await rm(temp, { recursive: true, force: true }); }
}
