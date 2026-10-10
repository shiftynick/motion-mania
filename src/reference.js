import { mkdir, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { hf, probe, run } from './process.js';
import { writeJson } from './project.js';
import { recordAssets } from './asset-records.js';

export const referenceRule = "Take the reference's grammar (pacing, framing, rhythm), never its content or identity. Detected scene changes and sampled stills do not establish creative similarity.";

export function cutPacing(cuts, duration) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Cut pacing requires a positive duration');
  const cutTimes = [...new Set(cuts.filter(t => Number.isFinite(t) && t > 0 && t < duration))].sort((a, b) => a - b);
  const boundaries = [0, ...cutTimes, duration], shotLengths = boundaries.slice(1).map((t, i) => Number((t - boundaries[i]).toFixed(6)));
  const sorted = [...shotLengths].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { duration, cutTimes, cutCount: cutTimes.length, cutsPerMinute: cutTimes.length * 60 / duration, shotLengths, meanShotLength: duration / shotLengths.length, medianShotLength: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2, shortestShot: sorted[0], longestShot: sorted.at(-1) };
}

export function sceneCutTimes(log) {
  return [...String(log).matchAll(/\bpts_time:([\d.e+-]+)/g)].map(match => Number(match[1])).filter(Number.isFinite);
}

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export async function pairedSheet(pairs, output, labels = ['reference', 'ours']) {
  const width = 480, height = 270, bar = 32, gap = 12, cells = [];
  for (const [row, pair] of pairs.entries()) for (const [column, file] of pair.paths.entries()) {
    const left = gap + column * (width + gap), top = gap + row * (height + bar + gap);
    cells.push({ input: await sharp(file).resize(width, height, { fit: 'contain', background: '#191b19' }).png().toBuffer(), left, top });
    cells.push({ input: Buffer.from(`<svg width="${width}" height="${bar}"><rect width="100%" height="100%" fill="#191b19"/><text x="12" y="23" fill="#f3f0e7" font-size="18" font-family="sans-serif">${escape(labels[column])} | ${pair.time.toFixed(3)}s</text></svg>`), left, top: top + height });
  }
  await sharp({ create: { width: 2 * (width + gap) + gap, height: pairs.length * (height + bar + gap) + gap, channels: 3, background: '#191b19' } }).composite(cells).png().toFile(output);
  return output;
}

export async function compareReference(project, format, build, output, input, { times, storyboard } = {}) {
  const reference = await realpath(path.resolve(input)), metadata = await probe(reference);
  const video = metadata.streams?.find(stream => stream.codec_type === 'video');
  const duration = Number(video?.duration ?? metadata.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0) throw new Error('--against requires a video with a known positive duration');
  const commonDuration = Math.min(duration, project.manifest.duration), end = Math.max(0, commonDuration - 1 / project.manifest.fps);
  const sampled = times ?? Array.from({ length: 6 }, (_, i) => Number((end * i / 5).toFixed(6)));
  if (!sampled.length || sampled.some(t => !Number.isFinite(t) || t < 0 || t >= commonDuration)) throw new Error(`Reference timestamps must be >= 0 and < ${commonDuration} (the shared duration)`);
  const directory = path.join(output, 'reference-frames');
  await mkdir(directory, { recursive: true });
  await hf(['snapshot', build, '--at', sampled.join(','), '--no-end', '--against', reference, '--output', directory, '--describe', 'false', '--no-browser-gpu']);
  const files = await readdir(directory), pairs = sampled.map((time, i) => {
    const find = prefix => files.find(file => new RegExp(`^${prefix}-0*${i}-at-.*\\.png$`).test(file));
    const ours = find('frame'), theirs = find('ref');
    if (!ours || !theirs) throw new Error(`Missing comparison frame at ${time}s`);
    return { time, paths: [path.join(directory, theirs), path.join(directory, ours)] };
  });
  const sheet = await pairedSheet(pairs, path.join(output, 'reference-comparison.png'));
  const detection = await run('ffmpeg', ['-hide_banner', '-i', reference, '-an', '-vf', "scale=320:-2,select='gt(scene,0.3)',showinfo", '-fps_mode', 'vfr', '-f', 'null', '-'], { quiet: true });
  const pacing = { reference: cutPacing(sceneCutTimes(detection.stderr), duration), ours: storyboard ? cutPacing(storyboard.shots.slice(1).map(shot => shot.from), project.manifest.duration) : null, method: 'FFmpeg scene score > 0.3 at 320px width; ours uses declared storyboard boundaries. Fades and animation may be missed or counted as cuts.' };
  const relative = path.relative(project.root, reference), kept = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  if (kept) {
    const entry = { path: relative.split(path.sep).join('/'), origin: 'Reference supplied for visual grammar study', usage: 'Reference only; do not copy content or identity', capturedAt: new Date().toISOString() };
    if (relative.startsWith(`assets${path.sep}`)) await recordAssets(project, [{ ...entry, path: entry.path.slice(7) }]);
    else await recordAssets(project, [], [entry]);
  }
  const result = { source: reference, keptInProject: kept, sheet, times: sampled, pairs: pairs.map(pair => ({ time: pair.time, reference: pair.paths[0], ours: pair.paths[1] })), pacing, rule: referenceRule };
  const report = path.join(output, 'reference-pacing.json');
  await writeJson(report, result);
  return { ...result, report };
}

export function referenceCritique(comparison) {
  const { reference, ours } = comparison.pacing;
  const line = (name, pacing) => `${name}: ${pacing.cutCount} cuts, ${pacing.cutsPerMinute.toFixed(2)} cuts/min, mean shot ${pacing.meanShotLength.toFixed(2)}s, median ${pacing.medianShotLength.toFixed(2)}s.`;
  return `\n## Reference grammar\n\n${referenceRule}\n\nSheet: ${comparison.sheet}\n\n${line('Reference (detected)', reference)}\n${ours ? line('Ours (storyboard)', ours) : 'No storyboard available for our cut pacing.'}\n\n${comparison.pacing.method}\n\nRecord timestamped differences in pacing, framing, and rhythm; decide which principles serve this film. Sampling compares the same seconds within the shared duration, without time stretching.\n`;
}
