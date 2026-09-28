import { readFile } from 'node:fs/promises';
import path from 'node:path';

const meaningful = value => typeof value === 'string' && value.trim().length > 0;
const fields = {
  goal: 'What should the viewer understand or feel after this shot?',
  focalPoint: 'What should the eye land on first at phone size?',
  transition: 'What carries into the next shot, and why does it change?',
  sound: 'What sound or intentional silence supports this beat?',
};

export function analyzeStoryboard(board, manifest) {
  if (!board || !Array.isArray(board.shots) || !board.shots.length || board.shots.length > 120) throw new Error('storyboard.json must contain 1–120 shots');
  const tolerance = 1 / manifest.fps + 1e-6;
  let end = 0;
  const warnings = [];
  const shots = board.shots.map((shot, i) => {
    const label = `Shot ${i + 1}`;
    if (!shot || !Number.isFinite(shot.from) || !Number.isFinite(shot.to) || shot.from < 0 || shot.to <= shot.from || shot.to > manifest.duration) throw new Error(`${label}: from/to must be increasing times within the film`);
    if (Math.abs(shot.from - end) > tolerance) throw new Error(`${label}: storyboard must cover the film in order without gaps or overlaps (expected ${end}s)`);
    if (!meaningful(shot.name) || !meaningful(shot.action)) throw new Error(`${label}: name and action are required`);
    if (shot.reviewAt !== undefined && (!Number.isFinite(shot.reviewAt) || shot.reviewAt < shot.from || shot.reviewAt >= shot.to)) throw new Error(`${label}: reviewAt must fall inside this shot`);
    end = shot.to;
    const questions = Object.entries(fields).filter(([key]) => !meaningful(shot[key])).map(([field, question]) => ({ field, question }));
    const words = typeof shot.copy === 'string' ? shot.copy.trim().split(/\s+/).filter(Boolean).length : 0;
    if (words / (shot.to - shot.from) > 3) warnings.push(`${label} (${shot.name}): ${words} copy words in ${(shot.to - shot.from).toFixed(2)}s; check the actual settled reading time.`);
    return { ...shot, index: i + 1, reviewAt: shot.reviewAt ?? (shot.from + shot.to) / 2, questions };
  });
  if (Math.abs(end - manifest.duration) > tolerance) throw new Error(`Storyboard ends at ${end}s; motion.json ends at ${manifest.duration}s`);
  const boundaries = shots.slice(1).map(s => s.from);
  // Keep an unattended review bounded. Explicit --around can select other cuts.
  const automaticTransitions = boundaries.length <= 24 ? boundaries : Array.from({ length: 24 }, (_, i) => boundaries[Math.round(i * (boundaries.length - 1) / 23)]);
  if (boundaries.length > 24) warnings.push(`Automatic strips sample 24 of ${boundaries.length} transitions; use --around to inspect additional cuts.`);
  return { shots, automaticTransitions, warnings, unanswered: shots.reduce((n, s) => n + s.questions.length, 0) };
}

export async function readStoryboard(project, { optional = false } = {}) {
  let source;
  try { source = await readFile(path.join(project.root, 'storyboard.json'), 'utf8'); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  return analyzeStoryboard(JSON.parse(source), project.manifest);
}

export async function plan(project) {
  const board = await readStoryboard(project);
  return { ok: true, project: project.root, ...board, creativeReview: 'pending', note: 'Timing is valid. Questions and reading-time warnings guide the agent; they are not a creative quality score.' };
}

export function critiqueTemplate(board, format) {
  const lines = [`# Review — ${format}`, '', 'Status: pending. Record only inspections actually performed.', '',
    'Inspection: [ ] full-size frames [ ] phone-size sheet [ ] transition strips [ ] video playback [ ] audio audition', '',
    '## Film-level decisions', '', 'Does the opening give a reason to watch? Is the product benefit demonstrated? Does the final hold make the next action clear?', '',
    '## Shot findings', ''];
  for (const shot of board?.shots ?? []) {
    lines.push(`### ${shot.from}–${shot.to}s · ${shot.name}`, '', `Intended action: ${shot.action}`, `Viewer goal: ${shot.goal || 'Not specified — establish this before judging the shot.'}`, `Focal point: ${shot.focalPoint || 'Not specified.'}`, `Transition: ${shot.transition || 'Not specified.'}`, `Sound: ${shot.sound || 'Not specified.'}`, '', 'Observed evidence / timestamp:', '', 'Highest-impact change:', '', 'Evidence after revision:', '');
  }
  lines.push('## Prioritized revisions', '', '| Timestamp | Observable problem | Specific change | Evidence after revision |', '| --- | --- | --- | --- |', '', '## Remaining limitations', '', 'List uninspected playback/audio, unresolved defects, and any intentional tradeoffs.', '');
  return lines.join('\n');
}
