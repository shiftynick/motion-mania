import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareNarration, readCaptions } from './captions.js';
import { provenanceWarnings } from './project.js';

const meaningful = value => typeof value === 'string' && value.trim().length > 0;
const countWords = text => typeof text === 'string' ? text.trim().split(/\s+/).filter(Boolean).length : 0;
// Comfortable narration is roughly 130–160 words per minute; faster reads as rushed.
export const narrationWordsPerSecond = 160 / 60;

// Three or more consecutive sentences of one to three words read as clipped slogans when spoken.
export function staccatoRun(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  let run = 0, longest = 0;
  for (const sentence of sentences) { run = countWords(sentence) <= 3 ? run + 1 : 0; longest = Math.max(longest, run); }
  return longest;
}

export const figuresIn = text => typeof text === 'string' ? [...new Set(text.match(/[$€£]?\d(?:[\d,.]*\d)?\s?(%|x\b|×|k\b|m\b|ms\b|s\b)?/gi) ?? [])].map(f => f.trim()) : [];
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
    if (shot.narration !== undefined && typeof shot.narration !== 'string') throw new Error(`${label}: narration must be a string`);
    end = shot.to;
    const questions = Object.entries(fields).filter(([key]) => !meaningful(shot[key])).map(([field, question]) => ({ field, question }));
    const length = shot.to - shot.from, words = countWords(shot.copy), spoken = countWords(shot.narration);
    if (words / length > 3) warnings.push(`${label} (${shot.name}): ${words} copy words in ${length.toFixed(2)}s; check the actual settled reading time.`);
    if (spoken / length > narrationWordsPerSecond) warnings.push(`${label} (${shot.name}): ${spoken} narration words in ${length.toFixed(2)}s is about ${Math.round(spoken / length * 60)} wpm; trim the line or lengthen the shot (aim for 130–160 wpm).`);
    if (meaningful(shot.narration) && staccatoRun(shot.narration) >= 3) warnings.push(`${label} (${shot.name}): narration strings together short fragments; spoken aloud they sound like slogans. Join them into connected sentences.`);
    const figures = [...figuresIn(shot.copy), ...figuresIn(shot.narration)];
    if (figures.length) warnings.push(`${label} (${shot.name}): contains figures (${[...new Set(figures)].join(', ')}); confirm each against a source or remove it.`);
    return { ...shot, index: i + 1, reviewAt: shot.reviewAt ?? (shot.from + shot.to) / 2, questions };
  });
  if (Math.abs(end - manifest.duration) > tolerance) throw new Error(`Storyboard ends at ${end}s; motion.json ends at ${manifest.duration}s`);
  const boundaries = shots.slice(1).map(s => s.from);
  // Keep an unattended review bounded. Explicit --around can select other cuts.
  const automaticTransitions = boundaries.length <= 24 ? boundaries : Array.from({ length: 24 }, (_, i) => boundaries[Math.round(i * (boundaries.length - 1) / 23)]);
  if (boundaries.length > 24) warnings.push(`Automatic strips sample 24 of ${boundaries.length} transitions; use --around to inspect additional cuts.`);
  const narrationWords = shots.reduce((n, s) => n + countWords(s.narration), 0);
  const narration = narrationWords ? { words: narrationWords, wordsPerMinute: Math.round(narrationWords / manifest.duration * 60) } : undefined;
  return { shots, automaticTransitions, warnings, unanswered: shots.reduce((n, s) => n + s.questions.length, 0), ...(narration ? { narration } : {}) };
}

export async function readStoryboard(project, { optional = false } = {}) {
  let source;
  try { source = await readFile(path.join(project.root, 'storyboard.json'), 'utf8'); }
  catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  return analyzeStoryboard(JSON.parse(source), project.manifest);
}

export async function plan(project) {
  const board = await readStoryboard(project);
  const captions = await readCaptions(project);
  const narration = captions && compareNarration(board.shots, captions.captions);
  const provenance = await provenanceWarnings(project);
  const warnings = [...board.warnings, ...(captions?.warnings ?? []).map(w => `Captions: ${w}`), ...(narration?.warnings ?? []), ...provenance];
  return {
    ok: true, project: project.root, ...board, warnings,
    ...(captions ? { captions: { groups: captions.groups, words: captions.words, ...(narration ? { narration: narration.shots } : {}) } } : {}),
    creativeReview: 'pending', note: 'Timing is valid. Questions and warnings guide the agent; they are not a creative quality score.',
  };
}

export function critiqueTemplate(board, format, audio) {
  const measured = !audio ? [] : audio.hasAudio
    ? ['## Audio measurements', '', `Draft: ${audio.loudness.integrated ?? '-inf'} LUFS integrated, ${audio.loudness.truePeak ?? '-inf'} dBTP true peak (target ${audio.target.integrated} ±${audio.target.tolerance} LUFS, <= ${audio.target.truePeak} dBTP). ${audio.advice}`, `Waveform with cuts: ${path.basename(audio.waveform)}`, ...audio.warnings.map(w => `- ${w}`), '', 'Measurements do not replace listening.', '']
    : ['## Audio measurements', '', ...audio.warnings, ''];
  const lines = [`# Review — ${format}`, '', 'Status: pending. Record only inspections actually performed.', '',
    'Inspection: [ ] full-size frames [ ] phone-size sheet [ ] transition strips [ ] video playback [ ] audio audition', '', ...measured,
    '## Film-level decisions', '', 'Does the opening give a reason to watch? Is the product benefit demonstrated? Does the final hold make the next action clear?', '',
    '## Shot findings', ''];
  for (const shot of board?.shots ?? []) {
    lines.push(`### ${shot.from}–${shot.to}s · ${shot.name}`, '', `Intended action: ${shot.action}`, `Viewer goal: ${shot.goal || 'Not specified — establish this before judging the shot.'}`, `Focal point: ${shot.focalPoint || 'Not specified.'}`, `Transition: ${shot.transition || 'Not specified.'}`, `Sound: ${shot.sound || 'Not specified.'}`, ...(meaningful(shot.narration) ? [`Narration: ${shot.narration}`] : []), '', 'Observed evidence / timestamp:', '', 'Highest-impact change:', '', 'Evidence after revision:', '');
  }
  lines.push('## Prioritized revisions', '', '| Timestamp | Observable problem | Specific change | Evidence after revision |', '| --- | --- | --- | --- |', '', '## Remaining limitations', '', 'List uninspected playback/audio, unresolved defects, and any intentional tradeoffs.', '');
  return lines.join('\n');
}
