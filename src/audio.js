import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { probe, run } from './process.js';
import { writeJson } from './project.js';
import { readStoryboard } from './storyboard.js';

export const defaultLoudness = { integrated: -14, truePeak: -1, tolerance: 1 };
const RATE = 8000, WINDOW = 0.01, SILENCE_DB = -50;
const round = (value, places = 1) => value === null || !Number.isFinite(value) ? null : Number(value.toFixed(places));
const escapeXml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// Parse the summary block printed by ffmpeg's ebur128 filter. "-inf" (silence) becomes null.
export function parseLoudness(stderr) {
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  if (!summary.startsWith('Summary:')) throw new Error('ffmpeg did not report a loudness summary');
  const value = pattern => {
    const match = summary.match(pattern);
    return match && match[1] !== '-inf' ? Number(match[1]) : null;
  };
  return {
    integrated: value(/I:\s+(-?[\d.]+|-inf)\s+LUFS/),
    range: value(/LRA:\s+(-?[\d.]+|-inf)\s+LU\b/),
    samplePeak: value(/Sample peak:\s+Peak:\s+(-?[\d.]+|-inf)/),
    truePeak: value(/True peak:\s+Peak:\s+(-?[\d.]+|-inf)/),
  };
}

// 10 ms RMS windows over a mono downmix. Levels are approximate dBFS for evidence, not mastering.
export function envelope(samples, rate = RATE) {
  const hop = Math.round(rate * WINDOW), count = Math.floor(samples.length / hop);
  const db = new Array(count), peak = new Array(count);
  for (let w = 0; w < count; w++) {
    let sum = 0, max = 0;
    for (let i = w * hop; i < (w + 1) * hop; i++) { sum += samples[i] * samples[i]; max = Math.max(max, Math.abs(samples[i])); }
    const rms = Math.sqrt(sum / hop);
    db[w] = rms > 1e-6 ? 20 * Math.log10(rms) : -120;
    peak[w] = max;
  }
  return { window: WINDOW, db, peak };
}

export function silences(env, { threshold = SILENCE_DB, minimum = 0.5 } = {}) {
  const ranges = [];
  let start = null;
  for (let i = 0; i <= env.db.length; i++) {
    const quiet = i < env.db.length && env.db[i] < threshold;
    if (quiet && start === null) start = i;
    if (!quiet && start !== null) {
      if ((i - start) * env.window >= minimum) ranges.push({ from: round(start * env.window, 2), to: round(i * env.window, 2) });
      start = null;
    }
  }
  return ranges;
}

// Strongest onset within ±radius of each cut: level above the loudest window in the preceding 80 ms.
export function cutAccents(env, cuts, { radius = 0.2, minimumRise = 9 } = {}) {
  const rise = i => env.db[i] - Math.max(...env.db.slice(Math.max(0, i - 8), i));
  return cuts.map(cut => {
    let best = null;
    const center = Math.round(cut / env.window), span = Math.round(radius / env.window);
    for (let i = Math.max(1, center - span); i <= Math.min(env.db.length - 1, center + span); i++) {
      const value = rise(i);
      if (value >= minimumRise && (!best || value > best.rise)) best = { rise: value, at: i * env.window };
    }
    return best ? { cut, accentAt: round(best.at, 2), offsetMs: Math.round((best.at - cut) * 1000), riseDb: round(best.rise) } : { cut, accentAt: null, offsetMs: null, riseDb: null };
  });
}

function levelBetween(env, from, to) {
  const slice = env.db.slice(Math.floor(from / env.window), Math.max(Math.floor(from / env.window) + 1, Math.floor(to / env.window)));
  const power = slice.reduce((sum, db) => sum + 10 ** (db / 10), 0) / Math.max(1, slice.length);
  return round(power > 1e-12 ? 10 * Math.log10(power) : -120);
}

export function audioChecks(loudness, target) {
  const { integrated, truePeak } = loudness;
  return [
    { name: 'integratedLoudness', ok: integrated !== null && Math.abs(integrated - target.integrated) <= target.tolerance, measured: integrated, target: `${target.integrated} ±${target.tolerance} LUFS` },
    { name: 'truePeak', ok: truePeak !== null && truePeak <= target.truePeak, measured: truePeak, target: `<= ${target.truePeak} dBTP` },
  ];
}

export function audioAdvice(loudness, target) {
  if (loudness.integrated === null) return 'No measurable program loudness; the audio is silent.';
  const gain = round(target.integrated - loudness.integrated);
  if (Math.abs(gain) <= target.tolerance && loudness.truePeak <= target.truePeak) return 'Within the loudness target.';
  const peakAfter = loudness.truePeak === null ? null : round(loudness.truePeak + gain);
  if (peakAfter !== null && peakAfter > target.truePeak) return `Apply ${gain} dB of gain, but peaks would reach about ${peakAfter} dBTP; reduce peaks (limiting or a quieter transient) before raising level.`;
  return `Apply about ${gain} dB of gain to the mix (source audio or data-volume), then measure again.`;
}

async function waveform(env, file, { duration, shots = [], silent = [], accents = [], title }) {
  const width = 1600, plot = 240, band = 34, top = 30, height = top + plot + band;
  const mid = top + plot / 2, columns = [];
  const perColumn = env.peak.length / width;
  for (let x = 0; x < width; x++) {
    const from = Math.floor(x * perColumn), to = Math.max(from + 1, Math.floor((x + 1) * perColumn));
    let peak = 0, db = -120;
    for (let i = from; i < Math.min(to, env.peak.length); i++) { peak = Math.max(peak, env.peak[i]); db = Math.max(db, env.db[i]); }
    columns.push({ peak: Math.min(1, peak), rms: Math.min(1, 10 ** (db / 20)) });
  }
  const shape = key => [...columns.map((c, x) => `${x},${(mid - c[key] * plot / 2).toFixed(1)}`), ...columns.map((c, x) => `${x},${(mid + c[key] * plot / 2).toFixed(1)}`).reverse()].join(' ');
  const xAt = t => (t / duration * width).toFixed(1);
  const tick = duration > 60 ? 10 : duration > 20 ? 5 : 1;
  const parts = [`<rect width="${width}" height="${height}" fill="#191b19"/>`];
  for (const s of silent) parts.push(`<rect x="${xAt(s.from)}" y="${top}" width="${(xAt(s.to) - xAt(s.from)).toFixed(1)}" height="${plot}" fill="#3a2a2a"/>`);
  parts.push(`<polygon points="${shape('peak')}" fill="#6f6c64"/>`, `<polygon points="${shape('rms')}" fill="#f3f0e7"/>`);
  for (let t = 0; t <= duration + 1e-9; t += tick) parts.push(`<line x1="${xAt(t)}" x2="${xAt(t)}" y1="${top + plot}" y2="${top + plot + 6}" stroke="#8d897f"/><text x="${xAt(t)}" y="${top + plot + 20}" text-anchor="${t === 0 ? 'start' : t > duration - tick / 2 ? 'end' : 'middle'}" fill="#8d897f" font-size="12" font-family="sans-serif">${t}s</text>`);
  for (const shot of shots) {
    if (shot.from > 0) parts.push(`<line x1="${xAt(shot.from)}" x2="${xAt(shot.from)}" y1="${top}" y2="${top + plot}" stroke="#ff5a2b" stroke-width="2"/>`);
    parts.push(`<text x="${(Number(xAt(shot.from)) + 5).toFixed(1)}" y="${top + 16}" fill="#ff5a2b" font-size="14" font-family="sans-serif">${escapeXml(shot.name)}</text>`);
  }
  for (const a of accents) if (a.accentAt !== null) parts.push(`<circle cx="${xAt(a.accentAt)}" cy="${top + plot - 8}" r="5" fill="#ffd166"/>`);
  parts.push(`<text x="10" y="20" fill="#f3f0e7" font-size="15" font-family="sans-serif">${escapeXml(title)}</text>`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`)).png().toFile(file);
  return file;
}

// Measure one media file. Returns evidence plus pass/fail checks against the loudness target.
export async function analyzeAudio(file, { manifest, storyboard, output, label }) {
  const target = { ...defaultLoudness, ...manifest.loudness };
  const metadata = await probe(file);
  if (!metadata.streams?.some(s => s.codec_type === 'audio')) {
    return { ok: !manifest.audioRequired, file, hasAudio: false, target, checks: [], warnings: [manifest.audioRequired ? 'motion.json requires audio, but this file has no audio stream.' : 'No audio stream; loudness checks skipped.'] };
  }
  const measured = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true+sample', '-f', 'null', '-'], { quiet: true });
  const loudness = parseLoudness(measured.stderr);
  const raw = path.join(output, '.envelope.f32');
  let samples;
  try {
    await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', raw], { quiet: true });
    const bytes = await readFile(raw);
    samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length - bytes.length % 4));
  } finally { await rm(raw, { force: true }); }
  const env = envelope(samples);
  const duration = manifest.duration, audioEnd = env.db.length * env.window;
  const silent = silences(env);
  const shots = storyboard?.shots ?? [];
  const accents = cutAccents(env, shots.slice(1).map(s => s.from));
  const endingLevel = levelBetween(env, Math.max(0, audioEnd - 0.1), audioEnd);
  const warnings = [];
  for (const s of silent) {
    if (s.from > 0.05 && s.to < audioEnd - 0.05) warnings.push(`Silent from ${s.from}s to ${s.to}s; confirm the gap is intentional.`);
    else if (s.from > 0.05) warnings.push(`Sound ends at ${s.from}s, ${round(duration - s.from, 2)}s before the film ends.`);
  }
  if (endingLevel > -30) warnings.push(`Final 0.1s is still at about ${endingLevel} dBFS; the ending may cut off abruptly. Use a fade or a held tail.`);
  if (audioEnd < duration - 0.25) warnings.push(`Audio stream ends at ${round(audioEnd, 2)}s; the film runs ${duration}s.`);
  // A mix that barely varies reads as a flat wall of sound; calm beds sit around 1.5–3 LU, energetic scores higher.
  if (loudness.range !== null && loudness.range < 1.5 && duration >= 10) warnings.push(`Loudness range is only ${loudness.range} LU; the mix barely varies and may sound like a flat wall. Calm beds usually vary 1.5–3 LU and energetic scores 3 LU or more.`);
  if (loudness.samplePeak !== null && loudness.samplePeak >= -0.1) warnings.push(`Sample peak reaches ${loudness.samplePeak} dBFS; listen for clipping.`);
  const checks = audioChecks(loudness, target);
  const title = `${label} · ${loudness.integrated ?? '-inf'} LUFS integrated · ${loudness.truePeak ?? '-inf'} dBTP · target ${target.integrated} LUFS / ${target.truePeak} dBTP`;
  const image = await waveform(env, path.join(output, 'waveform.png'), { duration, shots, silent, accents, title });
  return {
    ok: checks.every(c => c.ok), file, hasAudio: true, target, loudness, checks, advice: audioAdvice(loudness, target),
    silences: silent, endingLevelDb: endingLevel,
    shots: shots.map(s => ({ index: s.index, name: s.name, from: s.from, to: s.to, levelDb: levelBetween(env, s.from, s.to), sound: s.sound ?? null })),
    cuts: accents, waveform: image, warnings,
    scope: 'Loudness from ffmpeg ebur128; levels, silences, and cut accents from a mono 8 kHz envelope. Evidence only: listening is still required.',
  };
}

export async function audioReport(project, format, input) {
  const file = input ? path.resolve(input) : path.join(project.root, 'out', `${format}.mp4`);
  try { await access(file); }
  catch { throw new Error(input ? `Audio input not found: ${file}` : `No export at ${file}; run render first or pass --input <file>`); }
  const storyboard = await readStoryboard(project, { optional: true });
  const parent = path.join(project.root, 'reviews');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, `audio-${format}-`));
  const result = await analyzeAudio(file, { manifest: project.manifest, storyboard, output, label: input ? path.basename(file) : format });
  const report = { format, ...result, audioReview: 'pending' };
  await writeJson(path.join(output, 'report.json'), report);
  return { ...report, report: path.join(output, 'report.json') };
}
