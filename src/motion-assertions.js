import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const text = value => typeof value === 'string' && value.trim().length > 0;
const keys = { appearsBy: ['kind', 'selector', 'bySec'], before: ['kind', 'a', 'b'], staysInFrame: ['kind', 'selector'], keepsMoving: ['kind', 'withinSelector', 'maxStaticSec'] };

export function shotAssertions(shot, label = 'Shot') {
  if (shot.assertions === undefined) return [];
  if (!Array.isArray(shot.assertions) || shot.assertions.length > 32) throw new Error(`${label}: assertions must be an array of up to 32 motion assertions`);
  return shot.assertions.map((a, i) => {
    const at = `${label} assertion ${i + 1}`;
    if (!a || !Object.hasOwn(keys, a.kind) || Object.keys(a).some(k => !keys[a.kind].includes(k))) throw new Error(`${at}: use appearsBy, before, staysInFrame, or keepsMoving with only their documented fields`);
    if (['appearsBy', 'staysInFrame'].includes(a.kind) && !text(a.selector)) throw new Error(`${at}: selector must be a nonempty string`);
    if (a.kind === 'appearsBy' && (!Number.isFinite(a.bySec) || a.bySec < 0 || a.bySec >= shot.to - shot.from)) throw new Error(`${at}: bySec must be seconds from this shot's start, inside the shot`);
    if (a.kind === 'before' && (!text(a.a) || !text(a.b))) throw new Error(`${at}: a and b must be nonempty selectors`);
    if (a.kind === 'keepsMoving' && ((a.withinSelector !== undefined && (!text(a.withinSelector) || a.withinSelector.trim() === '*')) || (a.maxStaticSec !== undefined && (!Number.isFinite(a.maxStaticSec) || a.maxStaticSec <= 0)))) throw new Error(`${at}: withinSelector must be a selector other than *, and maxStaticSec must be positive`);
    return { ...a, ...(a.kind === 'appearsBy' ? { bySec: Number((shot.from + a.bySec).toFixed(6)) } : {}) };
  });
}

export async function writeMotionAssertions(project, build) {
  let board;
  try { board = JSON.parse(await readFile(path.join(project.root, 'storyboard.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return build; throw error; }
  const assertions = (board.shots ?? []).flatMap((shot, i) => shotAssertions(shot, `Shot ${i + 1}`));
  if (assertions.length) await writeFile(path.join(build, 'index.motion.json'), JSON.stringify({ version: 1, duration: project.manifest.duration, assertions }, null, 2) + '\n');
  return build;
}

export function backendFindings(payload) {
  return ['lint', 'runtime', 'layout', 'motion', 'contrast'].flatMap(section => (payload[section]?.findings ?? []).map(f => ({ ...f, section })));
}

export function verificationFindings(payload, settledTimes) {
  const geometry = new Set(['text_box_overflow', 'text_occluded', 'canvas_overflow', 'container_overflow', 'escaped_container', 'panel_out_of_canvas', 'content_overlap']);
  const findings = backendFindings(payload).map(f => {
    const times = f.times ?? [f.time];
    const settled = times.some(t => settledTimes.some(s => Math.abs(t - s) < 0.001));
    const transient = f.section === 'layout' && geometry.has(f.code) && !settled;
    const { times: sampled, ...finding } = f;
    return { ...finding, ...(sampled ? { firstSeen: times[0], lastSeen: times.at(-1), occurrences: times.length } : {}), ...(!settled && (transient || f.section === 'contrast') ? { inspection: 'transition' } : {}), ...(transient && f.severity === 'error' ? { severity: 'warning', originalSeverity: 'error', review: 'Outside the storyboard inspection frames; inspect this transition in the rendered strip.' } : {}) };
  });
  const groups = new Map(), result = [];
  for (const f of findings) {
    if (f.inspection !== 'transition' || f.severity === 'error') { result.push(f); continue; }
    const key = `${f.section}:${f.code}:${f.severity}`, group = groups.get(key) ?? { ...f, firstSeen: f.firstSeen ?? f.time, lastSeen: f.lastSeen ?? f.time, occurrences: 0, selectors: [], elements: new Set() };
    group.firstSeen = Math.min(group.firstSeen, f.firstSeen ?? f.time); group.lastSeen = Math.max(group.lastSeen, f.lastSeen ?? f.time);
    group.occurrences += f.occurrences ?? 1;
    group.elements.add(`${f.sourceFile}:${f.selector}`);
    if (group.selectors.length < 3 && !group.selectors.includes(f.selector)) group.selectors.push(f.selector);
    groups.set(key, group);
  }
  return [...result, ...[...groups.values()].map(({ elements, ...f }) => ({ ...f, elementCount: elements.size, ...(elements.size > 1 ? { message: `${elements.size} elements: ${f.message} Outside the inspection frames; inspect transitions and the complete backend report.` } : {}) }))];
}
