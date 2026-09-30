import { access, mkdir, mkdtemp, open, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { probe, run } from './process.js';
import { writeJson } from './project.js';
import { readStoryboard } from './storyboard.js';

// Frames are compared 0.1 s apart on a small full-range grayscale copy, block by block. A frame is
// frozen when no 8×8 block (5% of the width) changes by 1/255 on average. Whole-frame averages would
// call a slow 4% push frozen, and miss that one small element is still moving.
// Holds shorter than 0.6 s read as pauses, not stalls.
export const pictureDefaults = { width: 160, block: 8, maxRate: 30, lag: 0.1, frozenThreshold: 1, holdMinimum: 0.6, darkLuma: 20 };
const round = (value, places = 2) => Number(value.toFixed(places));
const escapeXml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

// Runs of consecutive indexes where test(i) holds, as [first, last] pairs.
function runs(length, test) {
  const found = [];
  let start = null;
  for (let i = 0; i <= length; i++) {
    const on = i < length && test(i);
    if (on && start === null) start = i;
    if (!on && start !== null) { found.push([start, i - 1]); start = null; }
  }
  return found;
}

// Largest mean |Δluma| over the blocks of two frames (0–255). Edge blocks may be partial.
export function blockChange(frame, previous, width, height, block = pictureDefaults.block) {
  let largest = 0;
  for (let by = 0; by < height; by += block) for (let bx = 0; bx < width; bx += block) {
    let sum = 0, count = 0;
    for (let y = by; y < Math.min(height, by + block); y++) for (let x = bx; x < Math.min(width, bx + block); x++, count++) sum += Math.abs(frame[y * width + x] - previous[y * width + x]);
    largest = Math.max(largest, sum / count);
  }
  return largest;
}

// samples: { rate, luma: mean luma per frame (0–255), change: blockChange against the frame one lag earlier (null before the first lag) }
export function pictureFindings({ rate, luma, change }, { duration, shots = [] }, options = {}) {
  const o = { ...pictureDefaults, ...options };
  const lag = Math.max(1, Math.round(rate * o.lag)), end = Math.min(duration, luma.length / rate);
  const overlapping = (from, to) => shots.filter(s => s.from < to && s.to > from);
  let previousEnd = 0;
  const holds = runs(change.length, i => change[i] !== null && change[i] < o.frozenThreshold)
    // A frozen sample means frames one lag apart match, so a run starts a lag earlier; don't overlap the previous run.
    .map(([a, b]) => { const h = { from: round(Math.max(previousEnd, (a - lag) / rate)), to: round(Math.min(end, (b + 1) / rate)) }; previousEnd = h.to; return h; })
    .filter(h => h.to - h.from >= o.holdMinimum - 1e-9)
    .map(h => {
      const within = overlapping(h.from, h.to);
      return { ...h, seconds: round(h.to - h.from), shots: within.map(s => s.name), final: h.to >= end - 1 / rate - 1e-9, intended: within.length > 0 && within.every(s => s.hold) };
    });
  const dark = runs(luma.length, i => luma[i] < o.darkLuma)
    .map(([a, b]) => ({ from: round(a / rate), to: round(Math.min(end, (b + 1) / rate)), minLuma: round(Math.min(...luma.slice(a, b + 1)) / 2.55, 1) }));
  const sorted = [...luma].sort((x, y) => x - y), median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const darkFilm = median < 2 * o.darkLuma;
  const warnings = [];
  for (const h of holds) {
    if (h.final || h.intended) continue;
    warnings.push(`Picture is frozen from ${h.from}s to ${h.to}s (${h.seconds}s${h.shots.length ? `, ${h.shots.join(' → ')}` : ''}). Give it a reason to hold (mark the shot's "hold" in the storyboard), keep something alive, or shorten it.`);
  }
  if (darkFilm && dark.length) warnings.push(`The film is mostly dark (median luma ${round(median / 2.55, 1)}%); near-black ranges are listed but not flagged.`);
  else for (const d of dark) {
    const where = d.from === 0 ? `The film opens on near-black frames until ${d.to}s; frame 0 should usually be a finished composition` : d.to >= end - 1e-9 ? `The film ends on near-black frames from ${d.from}s` : `Near-black frames from ${d.from}s to ${d.to}s`;
    warnings.push(`${where} (${d.minLuma}% luma at darkest). On a phone this reads as a blank screen; confirm it is intentional.`);
  }
  const shotReport = shots.map(s => {
    const [a, b] = [Math.floor(s.from * rate), Math.min(luma.length, Math.ceil(s.to * rate))];
    const held = holds.reduce((sum, h) => sum + Math.max(0, Math.min(h.to, s.to) - Math.max(h.from, s.from)), 0);
    const slice = luma.slice(a, b);
    return { index: s.index, name: s.name, from: s.from, to: s.to, heldSeconds: round(held), meanLuma: slice.length ? round(slice.reduce((x, y) => x + y, 0) / slice.length / 2.55, 1) : null };
  });
  return { holds, heldSeconds: round(holds.reduce((sum, h) => sum + h.seconds, 0)), dark, medianLuma: round(median / 2.55, 1), shots: shotReport, warnings };
}

async function activityChart({ rate, luma, change }, file, { duration, shots, holds, dark, threshold, title }) {
  const width = 1600, plot = 160, band = 34, top = 30, height = top + plot + band;
  const xAt = t => (t / duration * width).toFixed(1);
  // Square-root scale keeps small but real motion visible next to hard cuts.
  const scale = value => Math.min(1, Math.sqrt(value / 60));
  const parts = [`<rect width="${width}" height="${height}" fill="#191b19"/>`];
  for (const h of holds) parts.push(`<rect x="${xAt(h.from)}" y="${top}" width="${(xAt(h.to) - xAt(h.from)).toFixed(1)}" height="${plot}" fill="${h.final || h.intended ? '#2a3230' : '#3a2a2a'}"/>`);
  for (const d of dark) parts.push(`<rect x="${xAt(d.from)}" y="${top + plot - 10}" width="${Math.max(2, xAt(d.to) - xAt(d.from)).toFixed(1)}" height="10" fill="#6a5acd"/>`);
  const points = change.map((c, i) => `${xAt(i / rate)},${(top + plot - scale(c ?? 0) * plot).toFixed(1)}`).join(' ');
  parts.push(`<line x1="0" x2="${width}" y1="${(top + plot - scale(threshold) * plot).toFixed(1)}" y2="${(top + plot - scale(threshold) * plot).toFixed(1)}" stroke="#6f6c64" stroke-dasharray="4 4"/>`);
  parts.push(`<polyline points="${points}" fill="none" stroke="#f3f0e7" stroke-width="1.5"/>`);
  parts.push(`<polyline points="${luma.map((l, i) => `${xAt(i / rate)},${(top + plot - l / 255 * plot).toFixed(1)}`).join(' ')}" fill="none" stroke="#6f9bd1" stroke-width="1" opacity="0.7"/>`);
  const tick = duration > 60 ? 10 : duration > 20 ? 5 : 1;
  for (let t = 0; t <= duration + 1e-9; t += tick) parts.push(`<line x1="${xAt(t)}" x2="${xAt(t)}" y1="${top + plot}" y2="${top + plot + 6}" stroke="#8d897f"/><text x="${xAt(t)}" y="${top + plot + 20}" text-anchor="${t === 0 ? 'start' : t > duration - tick / 2 ? 'end' : 'middle'}" fill="#8d897f" font-size="12" font-family="sans-serif">${t}s</text>`);
  for (const shot of shots) {
    if (shot.from > 0) parts.push(`<line x1="${xAt(shot.from)}" x2="${xAt(shot.from)}" y1="${top}" y2="${top + plot}" stroke="#ff5a2b" stroke-width="2"/>`);
    parts.push(`<text x="${(Number(xAt(shot.from)) + 5).toFixed(1)}" y="${top + 16}" fill="#ff5a2b" font-size="14" font-family="sans-serif">${escapeXml(shot.name)}</text>`);
  }
  parts.push(`<text x="10" y="20" fill="#f3f0e7" font-size="15" font-family="sans-serif">${escapeXml(title)}</text>`);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`)).png().toFile(file);
  return file;
}

// Measure one video file: frozen holds and near-black frames, plus a chart marked with shots.
export async function analyzePicture(file, { manifest, storyboard, output, label }) {
  const video = (await probe(file)).streams?.find(s => s.codec_type === 'video');
  if (!video) throw new Error(`No video stream in ${file}`);
  const [n, d] = String(video.avg_frame_rate).split('/').map(Number);
  const rate = Math.min(pictureDefaults.maxRate, d ? n / d : manifest.fps);
  const width = pictureDefaults.width, height = 2 * Math.max(1, Math.round(width * video.height / video.width / 2)), size = width * height;
  const raw = path.join(output, '.luma.gray');
  const luma = [], change = [], lag = Math.max(1, Math.round(rate * pictureDefaults.lag));
  try {
    await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', file, '-map', '0:v:0', '-vf', `fps=${rate},scale=${width}:${height}:flags=area,format=gray`, '-f', 'rawvideo', raw], { quiet: true });
    // Stream frames from disk so long films keep a small footprint; only the last lag frames stay in memory.
    const handle = await open(raw), recent = [];
    try {
      for (;;) {
        const frame = Buffer.alloc(size);
        const { bytesRead } = await handle.read(frame, 0, size, null);
        if (bytesRead < size) break;
        let sum = 0;
        for (let i = 0; i < size; i++) sum += frame[i];
        luma.push(sum / size);
        change.push(recent.length === lag ? blockChange(frame, recent[0], width, height) : null);
        recent.push(frame);
        if (recent.length > lag) recent.shift();
      }
    } finally { await handle.close(); }
  } finally { await rm(raw, { force: true }); }
  if (!luma.length) throw new Error(`Could not decode frames from ${file}`);
  const duration = manifest.duration, shots = storyboard?.shots ?? [];
  const samples = { rate, luma, change };
  const findings = pictureFindings(samples, { duration, shots });
  const title = `${label} · ${findings.heldSeconds}s frozen in holds of ${pictureDefaults.holdMinimum}s or more · ${findings.dark.length} near-black range(s)`;
  const chart = await activityChart(samples, path.join(output, 'activity.png'), { duration, shots, holds: findings.holds, dark: findings.dark, threshold: pictureDefaults.frozenThreshold, title });
  return {
    file, rate, ...findings, chart,
    scope: `Frames compared ${pictureDefaults.lag}s apart on a ${width}px grayscale copy at ${round(rate, 3)} fps. Frozen means no ${pictureDefaults.block}×${pictureDefaults.block} block changes by ${pictureDefaults.frozenThreshold}/255 on average; near-black means mean luma below ${round(pictureDefaults.darkLuma / 2.55, 1)}%. Evidence only: one small moving detail keeps a frame from counting as frozen, and a moving frame can still feel slow.`,
  };
}

export async function pictureReport(project, format, input) {
  const file = input ? path.resolve(input) : path.join(project.root, 'out', `${format}.mp4`);
  try { await access(file); }
  catch { throw new Error(input ? `Picture input not found: ${file}` : `No export at ${file}; run render first or pass --input <file>`); }
  const storyboard = await readStoryboard(project, { optional: true });
  const parent = path.join(project.root, 'reviews');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, `picture-${format}-`));
  const result = await analyzePicture(file, { manifest: project.manifest, storyboard, output, label: input ? path.basename(file) : format });
  const report = { ok: true, format, ...result, creativeReview: 'pending' };
  await writeJson(path.join(output, 'report.json'), report);
  return { ...report, report: path.join(output, 'report.json') };
}
