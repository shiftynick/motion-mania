import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hf } from './process.js';

const round = value => Number(value.toFixed(3));
const escapeHtml = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const groupText = group => group.words.map(w => w.text).join(' ');
const tokens = text => text.toLowerCase().replace(/[’']/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];

// Drop empty entries and ASR music/noise tokens before they reach the film.
export function cleanWords(words) {
  return words
    .map(w => ({ text: String(w.text ?? '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter(w => w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && !/^[♪�♪-♯\s]+$/.test(w.text))
    .map(w => ({ ...w, end: Math.max(w.start, w.end) }))
    .sort((a, b) => a.start - b.start);
}

// Break on sentence ends, pauses, and size limits. Phrase-level cues (SRT/VTT) stay whole.
export function groupWords(words, { duration, maxWords = 5, maxChars = 32, pause = 0.25, hold = 0.3, minimum = 0.8 } = {}) {
  const groups = [];
  let current = null;
  for (const word of words) {
    if (word.start >= duration) continue;
    const cue = /\s/.test(word.text), last = current?.words.at(-1);
    const full = current && (cue || current.cue || current.words.length >= maxWords || groupText(current).length + 1 + word.text.length > maxChars || word.start - last.end >= pause || /[.!?…]["”’)]?$/.test(last.text));
    if (!current || full) { current = { cue, words: [] }; groups.push(current); }
    current.words.push({ text: word.text, start: round(word.start), end: round(Math.min(word.end, duration)) });
  }
  return groups.map((group, i) => {
    const start = group.words[0].start, spoken = group.words.at(-1).end;
    const limit = Math.min(duration, groups[i + 1]?.words[0].start ?? duration);
    return { start, end: round(Math.max(start + 0.05, Math.min(limit, Math.max(spoken + hold, start + minimum)))), words: group.words };
  });
}

export function analyzeCaptions(captions, manifest) {
  if (!captions || !Array.isArray(captions.groups) || captions.groups.length > 5000) throw new Error('captions.json must contain a groups array (up to 5000 groups)');
  const warnings = [], tolerance = 1e-3;
  let previous = 0, words = 0;
  captions.groups.forEach((group, i) => {
    const label = `Caption ${i + 1}`;
    if (!group || !Number.isFinite(group.start) || !Number.isFinite(group.end) || group.start < 0 || group.end <= group.start || group.end > manifest.duration + tolerance) throw new Error(`${label}: start/end must be increasing times within the film`);
    if (group.start < previous - tolerance) throw new Error(`${label}: groups must be in order without overlaps`);
    if (!Array.isArray(group.words) || !group.words.length) throw new Error(`${label}: words must be a nonempty array`);
    for (const word of group.words) {
      if (!word || typeof word.text !== 'string' || !word.text.trim() || !Number.isFinite(word.start) || word.start < group.start - 0.05 || word.start > group.end) throw new Error(`${label}: each word needs text and a start inside its group`);
    }
    previous = group.end;
    words += group.words.length;
    const text = groupText(group), length = group.end - group.start;
    if (length < 0.5) warnings.push(`${label} at ${group.start}s is on screen for ${length.toFixed(2)}s; it will flash by.`);
    if (text.length / length > 20) warnings.push(`${label} at ${group.start}s: ${text.length} characters in ${length.toFixed(2)}s is hard to read.`);
    if (text.length > 42) warnings.push(`${label} at ${group.start}s has ${text.length} characters; it may wrap to three lines at phone size.`);
  });
  return { groups: captions.groups.length, words, warnings };
}

function lcs(a, b) {
  let row = new Array(b.length + 1).fill(0);
  for (const x of a) {
    const next = [0];
    for (let j = 1; j <= b.length; j++) next[j] = x === b[j - 1] ? row[j - 1] + 1 : Math.max(row[j], next[j - 1]);
    row = next;
  }
  return row[b.length];
}

// Compare the words heard in each shot (by word midpoint) with the storyboard's narration script.
export function compareNarration(shots, captions) {
  if (!shots?.some(s => typeof s.narration === 'string' && s.narration.trim())) return null;
  const heard = captions.groups.flatMap(g => g.words).map(w => ({ at: (w.start + (w.end ?? w.start)) / 2, tokens: tokens(w.text) }));
  const warnings = [];
  const results = shots.map(shot => {
    const expected = tokens(shot.narration ?? ''), got = heard.filter(w => w.at >= shot.from && w.at < shot.to).flatMap(w => w.tokens);
    const similarity = expected.length + got.length ? Number((2 * lcs(expected, got) / (expected.length + got.length)).toFixed(2)) : 1;
    if (!expected.length && got.length) warnings.push(`Shot ${shot.index ?? ''} (${shot.name}): ${got.length} spoken words but no planned narration; narration may be drifting across the cut.`);
    else if (similarity < 0.8) warnings.push(`Shot ${shot.index ?? ''} (${shot.name}): heard words match the narration script at ${Math.round(similarity * 100)}%; check timing drift, misrecognition, or an outdated script.`);
    return { index: shot.index, name: shot.name, expectedWords: expected.length, heardWords: got.length, similarity };
  });
  return { shots: results, warnings };
}

export async function readCaptions(project) {
  let source;
  try { source = await readFile(path.join(project.root, 'captions.json'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const captions = JSON.parse(source);
  return { captions, ...analyzeCaptions(captions, project.manifest) };
}

// Midpoints of the longest caption groups: worst cases for wrapping and safe-area review.
export function captionSampleTimes(captions, count = 3) {
  return [...captions.groups].sort((a, b) => groupText(b).length - groupText(a).length).slice(0, count).map(g => round((g.start + g.end) / 2));
}

export async function importCaptions(project, input, { maxWords = 5, replace = false, shots } = {}) {
  const file = path.resolve(input);
  if (!['.json', '.srt', '.vtt'].includes(path.extname(file).toLowerCase())) throw new Error('captions imports transcripts (.json, .srt, .vtt). Run speech recognition first, then import its output.');
  if (!Number.isInteger(maxWords) || maxWords < 1 || maxWords > 12) throw new Error('--max-words must be an integer from 1 to 12');
  await access(file).catch(() => { throw new Error(`Transcript not found: ${file}`); });
  const target = path.join(project.root, 'captions.json');
  if (!replace && await access(target).then(() => true, () => false)) throw new Error(`${target} exists; pass --replace to overwrite edited captions`);
  const parent = path.join(project.root, '.motion');
  await mkdir(parent, { recursive: true });
  const work = await mkdtemp(path.join(parent, 'transcript-'));
  let imported, format;
  try {
    // The pinned backend normalizes whisper.cpp, OpenAI-style, word-array, SRT, and VTT transcripts.
    const result = await hf(['transcribe', file, '--dir', work, '--json'], { quiet: true });
    format = JSON.parse(result.stdout.trim().split('\n').at(-1)).format;
    imported = JSON.parse(await readFile(path.join(work, 'transcript.json'), 'utf8'));
  } finally { await rm(work, { recursive: true, force: true }); }
  const words = cleanWords(imported);
  if (!words.length) throw new Error('The transcript contains no usable words');
  const dropped = words.filter(w => w.start >= project.manifest.duration).length;
  const captions = { schemaVersion: 1, source: path.basename(file), format, groups: groupWords(words, { duration: project.manifest.duration, maxWords }) };
  const analysis = analyzeCaptions(captions, project.manifest);
  if (dropped) analysis.warnings.unshift(`${dropped} words start after the film ends and were dropped.`);
  if (captions.groups.some(g => g.words.some(w => /\s/.test(w.text)))) analysis.warnings.unshift('Phrase-level timing (SRT/VTT): captions show whole cues without word-by-word highlighting.');
  const narration = compareNarration(shots, captions);
  await writeFile(target, JSON.stringify(captions, null, 2) + '\n');
  return { ok: true, captions: target, format, ...analysis, warnings: [...analysis.warnings, ...(narration?.warnings ?? [])], ...(narration ? { narration: narration.shots } : {}), note: 'Edit captions.json to correct misheard words or regroup lines, then review frames at caption times.' };
}

const captionCss = `
.mm-caption { position: absolute; left: 0; right: 0; bottom: var(--mm-caption-bottom, 8%); text-align: center; z-index: 100; pointer-events: none; }
@media (orientation: portrait) { .mm-caption { bottom: var(--mm-caption-bottom-portrait, 20%); } }
.mm-caption-line { display: inline-block; max-width: var(--mm-caption-width, 84%); box-sizing: border-box; padding: .22em .55em; border-radius: .35em;
  font-family: var(--mm-caption-font, inherit); font-weight: var(--mm-caption-weight, 700); font-size: var(--mm-caption-size, var(--mm-caption-auto, 5vmin)); line-height: 1.25;
  color: var(--mm-caption-color, #fff); background: var(--mm-caption-bg, rgba(0, 0, 0, .64)); }
.mm-word { opacity: .55; }`;

// Build-time only: add caption clips on a free track and attach their tweens to the registered timeline.
export function injectCaptions(html, captions) {
  const root = html.match(/<([a-zA-Z][\w-]*)\b[^>]*\bdata-composition-id\s*=\s*(["'])(.*?)\2[^>]*>/);
  if (!root) throw new Error('captions.json requires a root element with data-composition-id');
  const id = root[3];
  const track = Math.max(-1, ...[...html.matchAll(/data-track-index\s*=\s*["']?(\d+)/g)].map(m => Number(m[1]))) + 1;
  const clips = captions.groups.map((g, i) => `<div id="mm-caption-${i}" class="clip mm-caption" data-start="${g.start}" data-duration="${round(g.end - g.start)}" data-track-index="${track}"><span class="mm-caption-line">${g.words.map(w => `<span class="mm-word">${escapeHtml(w.text)}</span>`).join(' ')}</span></div>`).join('\n');
  const timings = JSON.stringify(captions.groups.map(g => [g.start, g.words.map(w => w.start)]));
  const script = `<script>(function () {
  var id = ${JSON.stringify(id)}, tl = window.__timelines && window.__timelines[id];
  if (!tl) throw new Error('Motion Mania captions: register the paused timeline synchronously as window.__timelines["' + id + '"]');
  var root = document.querySelector('[data-composition-id="' + id + '"]');
  root.style.setProperty('--mm-caption-auto', Math.min(Number(root.dataset.width), Number(root.dataset.height)) * 0.05 + 'px');
  ${timings}.forEach(function (group, i) {
    var clip = document.getElementById('mm-caption-' + i), words = clip.querySelectorAll('.mm-word');
    tl.fromTo(clip.firstElementChild, { opacity: 0, yPercent: 25 }, { opacity: 1, yPercent: 0, duration: 0.15, ease: 'power2.out' }, group[0]);
    group[1].forEach(function (start, j) { tl.fromTo(words[j], { opacity: 0.55 }, { opacity: 1, duration: 0.08, ease: 'none' }, start); });
  });
})();</script>`;
  const at = root.index + root[0].length;
  let result = `${html.slice(0, at)}\n${clips}\n${html.slice(at)}`;
  result = result.includes('</head>') ? result.replace('</head>', () => `<style>${captionCss}</style>\n</head>`) : `<style>${captionCss}</style>\n${result}`;
  const body = result.lastIndexOf('</body>');
  return body === -1 ? result + script : `${result.slice(0, body)}${script}\n${result.slice(body)}`;
}
