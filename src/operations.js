import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { backendVersion, hf, probe, run } from './process.js';
import { buildProject as buildSource, withBuild as withSourceBuild, writeJson } from './project.js';
import { verificationFindings, writeMotionAssertions } from './motion-assertions.js';
import { groupLintAdvice } from './lint.js';
import { readStoryboard, critiqueTemplate } from './storyboard.js';
import { analyzeAudio } from './audio.js';
import { analyzePicture } from './picture.js';
import { preflightDelivery } from './delivery.js';
import { checkSafeArea, safeAreaMargins, safeAreaOverlay } from './safe-area.js';
import { captionSampleTimes, readCaptions } from './captions.js';
import { compareReference, referenceCritique } from './reference.js';

const buildProject = async (project, format, destination) => writeMotionAssertions(project, await buildSource(project, format, destination));
const withBuild = (project, format, action) => withSourceBuild(project, format, async build => action(await writeMotionAssertions(project, build)));

export function parseTimes(value, duration) {
  const times = String(value).split(',').map(s => s.trim() === '' ? NaN : Number(s));
  if (!times.length || times.some(t => !Number.isFinite(t) || t < 0 || t >= duration)) throw new Error(`Timestamps must be >= 0 and < ${duration}`);
  return times;
}

export function reviewTimes(duration, fps, around = [], keyframes = []) {
  const end = Math.max(0, duration - 1 / fps);
  const count = Math.min(24, Math.max(2, Math.ceil(duration)));
  const overview = [...new Set([...Array.from({ length: count }, (_, i) => Number((end * i / (count - 1)).toFixed(6))), ...keyframes.map(t => Number(Math.min(end, t).toFixed(6)))])].sort((a, b) => a - b);
  const strips = around.map(t => Array.from({ length: 9 }, (_, i) => Number(Math.max(0, Math.min(end, t + (i - 4) / fps)).toFixed(6))));
  return { overview, strips, all: [...new Set([...overview, ...strips.flat()])].sort((a, b) => a - b) };
}

export async function snapshot(directory, output, times) {
  await hf(['snapshot', directory, '--at', times.join(','), '--no-end', '--output', output, '--describe', 'false', '--no-browser-gpu']);
  const files = (await readdir(output)).filter(f => /^frame-\d+-at-.*\.png$/.test(f)).sort((a,b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  if (files.length !== times.length) throw new Error(`Expected ${times.length} snapshots, got ${files.length}`);
  return files.map((f, i) => ({ time: times[i], path: path.join(output, f) }));
}

async function sheet(frames, file, { width = 240, columns = 5, safeArea } = {}) {
  const first = await sharp(frames[0].path).metadata();
  const height = Math.round(width * first.height / first.width), label = 30, gap = 10;
  const cols = Math.min(columns, frames.length), rows = Math.ceil(frames.length / cols);
  const composites = [];
  for (const [i, frame] of frames.entries()) {
    const left = gap + i % cols * (width + gap), top = gap + Math.floor(i / cols) * (height + label + gap);
    composites.push({ input: await sharp(frame.path).resize(width, height).png().toBuffer(), left, top });
    if (safeArea) composites.push({ input: safeAreaOverlay(width, height, safeArea), left, top });
    const svg = `<svg width="${width}" height="${label}"><rect width="100%" height="100%" fill="#191b19"/><text x="10" y="21" fill="#f3f0e7" font-size="15" font-family="sans-serif">${frame.time.toFixed(3)}s</text></svg>`;
    composites.push({ input: Buffer.from(svg), left, top: top + height });
  }
  await sharp({ create: { width: cols * (width + gap) + gap, height: rows * (height + label + gap) + gap, channels: 3, background: '#191b19' } }).composite(composites).png().toFile(file);
  return file;
}

export async function doctor() {
  const checks = [{ name: 'Node.js', ok: Number(process.versions.node.split('.')[0]) >= 22, detail: process.version }];
  for (const command of ['ffmpeg', 'ffprobe']) {
    try { const r = await run(command, ['-version'], { quiet: true, timeout: 10_000 }); checks.push({ name: command, ok: true, detail: r.stdout.split('\n')[0] }); }
    catch (e) { checks.push({ name: command, ok: false, detail: e.message }); }
  }
  try {
    const r = await hf(['browser', 'path'], { quiet: true, timeout: 30_000 });
    checks.push({ name: 'Chrome', ok: true, detail: r.stdout.trim() });
  } catch (e) { checks.push({ name: 'Chrome', ok: false, detail: e.message, fix: 'Run motion-mania browser (or npx motion-mania browser).' }); }
  return { ok: checks.every(c => c.ok), backend: `hyperframes@${backendVersion}`, checks };
}

export async function captureFrame(project, format, time) {
  const parent = path.join(project.root, 'out');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, `frame-${format}-`));
  return withBuild(project, format, async build => ({ ok: true, format, frames: await snapshot(build, output, [time]) }));
}

// Pull the prioritized-revisions table rows out of a critique.md written from critiqueTemplate.
export function priorFindings(markdown) {
  const section = markdown.split(/^## Prioritized revisions\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return section.split('\n').filter(line => line.trim().startsWith('|')).map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()))
    .filter(cells => cells.some(Boolean) && !cells.every(cell => /^:?-+:?$/.test(cell)) && cells[0] !== 'Timestamp')
    .map(([timestamp = '', problem = '', change = '']) => ({ timestamp, problem, change }));
}

// The most recent earlier review of this format that recorded findings, so the next critique can
// verify them. A quick check in between (a review nobody filled in) must not break the chain.
export async function previousReview(parent, format) {
  let latest = null, reviewed = null;
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(`${format}-`)) continue;
    const directory = path.join(parent, entry.name);
    try {
      const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
      if (report.format !== format) continue;
      const critique = path.join(directory, 'critique.md');
      const found = { createdAt: report.createdAt, critique, findings: priorFindings(await readFile(critique, 'utf8')) };
      if (!latest || found.createdAt > latest.createdAt) latest = found;
      if (found.findings.length && (!reviewed || found.createdAt > reviewed.createdAt)) reviewed = found;
    } catch { /* incomplete or foreign directory */ }
  }
  return reviewed ?? latest;
}

export async function review(project, format, { around, draft = false, against, referenceTimes } = {}) {
  const storyboard = await readStoryboard(project, { optional: true });
  const captions = await readCaptions(project);
  const parent = path.join(project.root, 'reviews');
  await mkdir(parent, { recursive: true });
  const previous = await previousReview(parent, format);
  const output = await mkdtemp(path.join(parent, `${format}-`));
  return withBuild(project, format, async build => {
    const times = reviewTimes(project.manifest.duration, project.manifest.fps, around ?? storyboard?.automaticTransitions ?? [], [...storyboard?.shots.map(s => s.reviewAt) ?? [], ...(captions ? captionSampleTimes(captions.captions) : [])]);
    const frames = await snapshot(build, path.join(output, 'frames'), times.all);
    const at = list => list.map(t => frames.find(f => f.time === t));
    const contact = await sheet(at(times.overview), path.join(output, 'contact-sheet.png'));
    const dimensions = project.manifest.formats[format];
    const margins = dimensions.height > dimensions.width ? safeAreaMargins(project.manifest, dimensions) : undefined;
    const phone = await sheet(at(times.overview), path.join(output, 'phone-preview.png'), { width: 360, columns: 3, safeArea: margins });
    const safeArea = margins ? await checkSafeArea(build, output, margins, times.overview, project.manifest.duration, dimensions) : undefined;
    const strips = [];
    for (const [i, sequence] of times.strips.entries()) strips.push(await sheet(at(sequence), path.join(output, `transition-${i + 1}.png`), { width: 200, columns: 9 }));
    let draftPath, audio, picture, delivery;
    if (draft) {
      draftPath = path.join(output, 'draft.mp4');
      ({ delivery } = await renderBuild(build, draftPath, project, format, 'draft'));
      audio = await analyzeAudio(draftPath, { manifest: project.manifest, storyboard, output, label: `${format} draft` });
      picture = await analyzePicture(draftPath, { manifest: project.manifest, storyboard, output, label: `${format} draft` });
    }
    const reference = against ? await compareReference(project, format, build, output, against, { times: referenceTimes, storyboard }) : undefined;
    const report = { ok: true, format, ...(reference ? { reference } : {}), createdAt: new Date().toISOString(), manifest: project.manifest, contact, phone, ...(safeArea ? { safeArea } : {}), strips, frames, storyboard, transitionTimes: around ?? storyboard?.automaticTransitions ?? [], ...(captions ? { captions: { groups: captions.groups, warnings: captions.warnings } } : {}), ...(draftPath ? { draft: draftPath, audio, picture, delivery } : {}), ...(previous ? { previousCritique: previous.critique } : {}), creativeReview: 'pending', audioReview: 'pending', notes: 'Open the images and play the draft. Successful capture is not creative approval.' };
    await writeJson(path.join(output, 'report.json'), report);
    await writeFile(path.join(output, 'critique.md'), critiqueTemplate(storyboard, format, { audio, picture, safeArea, previous }) + (reference ? referenceCritique(reference) : ''));
    return { ...report, report: path.join(output, 'report.json'), critique: path.join(output, 'critique.md') };
  });
}

export function validateMedia(metadata, manifest, format) {
  const video = metadata.streams?.find(s => s.codec_type === 'video');
  const audio = metadata.streams?.some(s => s.codec_type === 'audio') ?? false;
  const dimensions = manifest.formats[format];
  if (!video || video.width !== dimensions.width || video.height !== dimensions.height) throw new Error('Export dimensions do not match motion.json');
  const [n,d] = String(video.avg_frame_rate).split('/').map(Number);
  if (Math.abs(n / d - manifest.fps) > 0.01) throw new Error('Export frame rate does not match motion.json');
  const duration = Number(video.duration ?? metadata.format?.duration);
  if (!Number.isFinite(duration) || Math.abs(duration - manifest.duration) > Math.max(0.1, 2 / manifest.fps)) throw new Error('Export duration does not match motion.json');
  if (manifest.audioRequired && !audio) throw new Error('Expected audio, but the export is silent (no audio stream)');
  return { width: video.width, height: video.height, duration, fps: n / d, audio };
}

async function renderBuild(build, output, project, format, quality) {
  const temp = path.join(path.dirname(output), `.${path.basename(output)}-${randomUUID()}.mp4`);
  try {
    await hf(['render', build, '--output', temp, '--fps', String(project.manifest.fps), '--quality', quality, '--workers', '1', '--no-browser-gpu', '--strict']);
    const delivery = await preflightDelivery(temp, project.manifest, project.manifest.formats[format]);
    const metadata = validateMedia(await probe(temp), project.manifest, format);
    // Rename on the same filesystem: preserve the previous good export on any failure.
    await rename(temp, output);
    return { ...metadata, delivery, warnings: delivery.warnings };
  } finally { await rm(temp, { force: true }); }
}

export async function render(project, format, quality = 'looks') {
  if (!['draft', 'looks', 'delivery'].includes(quality)) throw new Error('quality must be draft, looks, or delivery');
  const parent = path.join(project.root, 'out');
  await mkdir(parent, { recursive: true });
  const output = path.join(parent, `${format}.mp4`);
  return withBuild(project, format, async build => {
    const metadata = await renderBuild(build, output, project, format, quality);
    return { ok: true, format, output, ...metadata };
  });
}

async function pixelHash(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return createHash('sha256').update(`${info.width}x${info.height}:`).update(data).digest('hex');
}

export async function verify(project, format, { captionZone } = {}) {
  const parent = path.join(project.root, 'reviews');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, `verify-${format}-`));
  return withBuild(project, format, async build => {
    const board = await readStoryboard(project, { optional: true });
    const settledTimes = board?.shots.map(s => s.reviewAt) ?? Array.from({ length: 9 }, (_, i) => Number(((i + 0.5) / 9 * project.manifest.duration).toFixed(6)));
    const check = await hf(['check', build, '--at', settledTimes.join(','), '--at-transitions', '--max-issues', '10000', '--no-browser-gpu', ...(captionZone ? ['--caption-zone', captionZone] : []), '--json'], { quiet: true, allowFailure: true });
    await writeFile(path.join(output, 'backend-check.json'), check.stdout);
    await writeFile(path.join(output, 'backend-check.log'), check.stderr);
    let payload;
    try { payload = JSON.parse(check.stdout); } catch { throw new Error(`HyperFrames returned invalid check JSON; inspect ${output}`); }
    const findings = groupLintAdvice(verificationFindings(payload, settledTimes)), motion = payload.motion;
    const incomplete = payload.browserSkipped || !payload.layout?.samples?.length || payload.layout.truncated || (check.code !== 0 && payload.ok !== false);
    if (incomplete || payload.error || findings.some(f => f.severity === 'error')) return { ok: false, format, settledTimes, report: path.join(output, 'backend-check.json'), findings, motion, transitionSamples: payload.layout?.transitionSamples, transitionSamplesDropped: payload.layout?.transitionSamplesDropped, reason: findings.filter(f => f.severity === 'error').map(f => `[${f.code}] ${f.selector ? `${f.selector}: ` : ''}${f.message}`).join('; ') || payload.error || 'HyperFrames check did not completely inspect frames; inspect its report.' };
    const duration = project.manifest.duration;
    const times = [0.25, 0.5, 0.85].map(f => Number((duration * f).toFixed(6)));
    const forward = await snapshot(build, path.join(output, 'forward'), times);
    const reverse = await snapshot(build, path.join(output, 'reverse'), [...times].reverse());
    const comparisons = [];
    for (const frame of forward) {
      const other = reverse.find(f => f.time === frame.time);
      const firstHash = await pixelHash(frame.path), secondHash = await pixelHash(other.path);
      comparisons.push({ time: frame.time, equal: firstHash === secondHash, firstHash, secondHash });
    }
    const report = { ok: comparisons.every(c => c.equal), format, settledTimes, comparisons, findings, motion, transitionSamples: payload.layout.transitionSamples, transitionSamplesDropped: payload.layout.transitionSamplesDropped, backendCheck: path.join(output, 'backend-check.json'), scope: 'Layout errors gate at storyboard reviewAt frames (shot midpoint by default; nine uniform midpoints without a storyboard). Other sampled geometry is transition advice; explicit caption zones, motion assertions and runtime/contract errors still gate. Choose settled reviewAt frames and inspect transitions. Three fresh-session forward/reverse seek comparisons; not a full-film or cross-machine guarantee.' };
    await writeJson(path.join(output, 'report.json'), report);
    return { ...report, report: path.join(output, 'report.json') };
  });
}

export async function prepare(project, format) {
  const parent = path.join(project.root, '.motion');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, `preview-${format}-`));
  await buildProject(project, format, output);
  return { ok: true, format, directory: output, note: 'Prepared snapshot of source. Re-run prepare after edits; preview with the pinned HyperFrames CLI.' };
}
