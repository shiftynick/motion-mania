import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareNarration, readCaptions } from './captions.js';
import { provenanceWarnings } from './project.js';
import { shotAssertions } from './motion-assertions.js';
import { copyProvenance } from './copy-provenance.js';
import { authoredSources } from './source.js';
import { lintSource } from './lint.js';

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
export function readingTime(copy) {
  const lines = (Array.isArray(copy) ? copy : typeof copy === 'string' ? copy.split(/\n+|(?<=[.!?])\s+/) : []).map(s => s.trim()).filter(Boolean);
  return { lines: lines.map(text => ({ text, floor: Math.max(0.70, 0.25 + [...text].length / 17), comfortable: 0.3 * countWords(text) + 1.5 })), floor: lines.reduce((sum, text) => sum + Math.max(0.70, 0.25 + [...text].length / 17), 0) };
}

export function beatCut(time, bpm, beatOffset, fps) {
  const step = 60 / bpm / 4, subdivision = Math.round((time - beatOffset) / step);
  const exact = beatOffset + subdivision * step;
  const nearestFrame = Math.round(exact * fps), cutFrame = Math.round(time * fps);
  return { time, nearestBeat: Number(exact.toFixed(6)), nearestFrame, offsetFrames: cutFrame - nearestFrame, subdivision };
}

const fields = {
  goal: 'What should the viewer understand or feel after this shot?',
  focalPoint: 'What should the eye land on first at phone size?',
  transition: 'What carries into the next shot, and why does it change?',
  sound: 'What sound or intentional silence supports this beat?',
};

export function analyzeStoryboard(board, manifest) {
  if (!board || !Array.isArray(board.shots) || !board.shots.length || board.shots.length > 120) throw new Error('storyboard.json must contain 1–120 shots');
  if (board.bpm !== undefined && (!Number.isFinite(board.bpm) || board.bpm <= 0 || board.bpm > 1000)) throw new Error('bpm must be > 0 and <= 1000');
  if (board.beatOffset !== undefined && !Number.isFinite(board.beatOffset)) throw new Error('beatOffset must be a finite time in seconds');
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
    if (shot.hold !== undefined && typeof shot.hold !== 'boolean' && !meaningful(shot.hold)) throw new Error(`${label}: hold must be true or a reason for the held frame`);
    if (shot.copy !== undefined && typeof shot.copy !== 'string' && (!Array.isArray(shot.copy) || shot.copy.some(s => typeof s !== 'string'))) throw new Error(`${label}: copy must be a string or an array of lines`);
    if (shot.offBeat !== undefined && typeof shot.offBeat !== 'boolean' && !meaningful(shot.offBeat)) throw new Error(`${label}: offBeat must be true or a reason for the deliberate off-grid entrance`);
    if (shot.anchor !== undefined && (!shot.anchor || !meaningful(shot.anchor.text) || !Number.isFinite(shot.anchor.at) || shot.anchor.at < shot.from || shot.anchor.at >= shot.to || ['before', 'after'].some(k => shot.anchor[k] !== undefined && (!Number.isFinite(shot.anchor[k]) || shot.anchor[k] < 0)))) throw new Error(`${label}: anchor needs text and at inside the shot; optional before/after tolerances must be nonnegative seconds`);
    shotAssertions(shot, label);
    end = shot.to;
    const questions = Object.entries(fields).filter(([key]) => !meaningful(shot[key])).map(([field, question]) => ({ field, question }));
    const length = shot.to - shot.from, reading = readingTime(shot.copy), spoken = countWords(shot.narration);
    if (reading.floor > length) warnings.push(`${label} (${shot.name}): per-line reading heuristic suggests at least ${reading.floor.toFixed(2)}s for ${reading.lines.length} line(s); ${length.toFixed(2)}s is ${(reading.floor - length).toFixed(2)}s short. These are authoring heuristics, not measured readability; check the settled hold.`);
    if (spoken / length > narrationWordsPerSecond) warnings.push(`${label} (${shot.name}): ${spoken} narration words in ${length.toFixed(2)}s is about ${Math.round(spoken / length * 60)} wpm; trim the line or lengthen the shot (aim for 130–160 wpm).`);
    if (meaningful(shot.narration) && staccatoRun(shot.narration) >= 3) warnings.push(`${label} (${shot.name}): narration strings together short fragments; spoken aloud they sound like slogans. Join them into connected sentences.`);
    const figures = [...figuresIn(Array.isArray(shot.copy) ? shot.copy.join(' ') : shot.copy), ...figuresIn(shot.narration)];
    if (figures.length) warnings.push(`${label} (${shot.name}): contains figures (${[...new Set(figures)].join(', ')}); confirm each against a source or remove it.`);
    return { ...shot, ...(reading.lines.length ? { reading } : {}), index: i + 1, reviewAt: shot.reviewAt ?? (shot.from + shot.to) / 2, questions };
  });
  if (Math.abs(end - manifest.duration) > tolerance) throw new Error(`Storyboard ends at ${end}s; motion.json ends at ${manifest.duration}s`);
  const beatGrid = board.bpm ? shots.slice(1).filter(s => !s.offBeat).map(s => ({ shot: s.index, ...beatCut(s.from, board.bpm, board.beatOffset ?? 0, manifest.fps) })) : [];
  for (const cut of beatGrid.filter(c => Math.abs(c.offsetFrames) > 1)) warnings.push(`Shot ${cut.shot} cut at ${cut.time}s is off the quarter-beat grid: nearest beat ${cut.nearestBeat}s (frame ${cut.nearestFrame}), offset ${cut.offsetFrames > 0 ? '+' : ''}${cut.offsetFrames} frames. Set offBeat on this shot for a deliberate off-grid entrance.`);
  const boundaries = shots.slice(1).map(s => s.from);
  // Keep an unattended review bounded. Explicit --around can select other cuts.
  const automaticTransitions = boundaries.length <= 24 ? boundaries : Array.from({ length: 24 }, (_, i) => boundaries[Math.round(i * (boundaries.length - 1) / 23)]);
  if (boundaries.length > 24) warnings.push(`Automatic strips sample 24 of ${boundaries.length} transitions; use --around to inspect additional cuts.`);
  const narrationWords = shots.reduce((n, s) => n + countWords(s.narration), 0);
  const narration = narrationWords ? { words: narrationWords, wordsPerMinute: Math.round(narrationWords / manifest.duration * 60) } : undefined;
  return { shots, automaticTransitions, ...(board.bpm ? { bpm: board.bpm, beatOffset: board.beatOffset ?? 0, beatGrid } : {}), warnings, unanswered: shots.reduce((n, s) => n + s.questions.length, 0), ...(narration ? { narration } : {}) };
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
  const copy = await copyProvenance(project, board, captions?.captions);
  const sources = await authoredSources(project), sourceReports = sources.map(s => lintSource(s.source, s.file));
  const voiceWithoutTiming = !captions && board.narration && sources.some(s => /<audio\b[^>]*(?:voice|narration)/i.test(s.source)) ? ['Voice take present without captions.json; import word timings to measure narration bounds. Audio duration alone cannot locate each shot’s words.'] : [];
  const sourceLint = { findings: sourceReports.flatMap(r => r.findings), waived: sourceReports.flatMap(r => r.waived) };
  const warnings = [...board.warnings, ...voiceWithoutTiming, ...(captions?.warnings ?? []).map(w => `Captions: ${w}`), ...(narration?.warnings ?? []), ...provenance, ...copy.findings.map(f => `${f.file}:${f.line} [${f.rule}] ${f.message}`), ...sourceLint.findings.map(f => `${f.file}:${f.line} [${f.rule}] ${f.message}`)];
  return {
    ok: true, project: project.root, ...board, warnings, copyProvenance: copy, sourceLint,
    ...(captions ? { captions: { groups: captions.groups, words: captions.words, ...(narration ? { narration: narration.shots } : {}) } } : {}),
    creativeReview: 'pending', note: 'Timing is valid. Questions and warnings guide the agent; they are not a creative quality score.',
  };
}

const cell = text => String(text).replaceAll('|', '\\|');

export function critiqueTemplate(board, format, { audio, picture, safeArea, previous } = {}) {
  const verification = !previous ? [] : ['## Previous findings', '', `Previous review: ${previous.critique}`, '',
    ...(previous.findings.length
      ? ['Verify each item against this review\'s evidence: FIXED, PARTLY, or STILL PRESENT. Carry anything unresolved into the prioritized revisions below, and look for regressions the fixes caused.', '',
        '| Timestamp | Previous problem | Status | Evidence in this review |', '| --- | --- | --- | --- |', ...previous.findings.map(f => `| ${cell(f.timestamp)} | ${cell(f.problem)} | | |`)]
      : ['It recorded no prioritized revisions. Read it before judging this round.']), ''];
  const measured = !audio ? [] : audio.hasAudio
    ? ['## Audio measurements', '', `Draft: ${audio.loudness.integrated ?? '-inf'} LUFS integrated, ${audio.loudness.truePeak ?? '-inf'} dBTP true peak (target ${audio.target.integrated} ±${audio.target.tolerance} LUFS, <= ${audio.target.truePeak} dBTP). ${audio.advice}`, `Waveform with cuts: ${path.basename(audio.waveform)}`, ...audio.warnings.map(w => `- ${w}`), '', 'Measurements do not replace listening.', '']
    : ['## Audio measurements', '', ...audio.warnings, ''];
  const pictured = !picture ? [] : ['## Picture measurements', '', `Draft: ${picture.heldSeconds}s frozen in holds of 0.6s or more; ${picture.dark.length} near-black range(s); ${picture.transients?.length ?? 0} pop/flash candidate(s).`, `Activity chart with cuts: ${path.basename(picture.chart)}`, ...picture.warnings.map(w => `- ${w}`), '', 'These locate picture changes; they do not judge pacing or intentional flashes.', ''];
  const safe = !safeArea ? [] : ['## Vertical safe area', '', ...safeArea.warnings.map(w => `- ${w}`), ...safeArea.findings.map(f => `- ${f.selector}: ${f.edges.join('/')} band, ${f.from}–${f.to}s (${f.occurrences} sampled collisions).`), '', 'Guides are approximate; inspect the phone preview and moving text.', ''];
  const lines = [`# Review — ${format}`, '', 'Status: pending. Record only inspections actually performed.', '',
    'Inspection: [ ] full-size frames [ ] phone-size sheet [ ] transition strips [ ] video playback [ ] audio audition', '', ...verification, ...measured, ...pictured, ...safe,
    '## Film-level decisions', '', 'Does the opening give a reason to watch? Is the product benefit demonstrated? Does the final hold make the next action clear?', '',
    '## Shot findings', ''];
  for (const shot of board?.shots ?? []) {
    lines.push(`### ${shot.from}–${shot.to}s · ${shot.name}`, '', `Intended action: ${shot.action}`, `Viewer goal: ${shot.goal || 'Not specified — establish this before judging the shot.'}`, `Focal point: ${shot.focalPoint || 'Not specified.'}`, `Transition: ${shot.transition || 'Not specified.'}`, `Sound: ${shot.sound || 'Not specified.'}`, ...(shot.hold ? [`Intended hold: ${shot.hold === true ? 'yes' : shot.hold}`] : []), ...(meaningful(shot.narration) ? [`Narration: ${shot.narration}`] : []), '', 'Observed evidence / timestamp:', '', 'Highest-impact change:', '', 'Evidence after revision:', '');
  }
  lines.push('## Prioritized revisions', '', '| Timestamp | Observable problem | Specific change | Evidence after revision |', '| --- | --- | --- | --- |', '', '## Remaining limitations', '', 'List uninspected playback/audio, unresolved defects, and any intentional tradeoffs.', '');
  return lines.join('\n');
}
