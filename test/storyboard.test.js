import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeStoryboard, critiqueTemplate, plan, staccatoRun } from '../src/storyboard.js';
import { initProject, loadProject, provenanceWarnings } from '../src/project.js';
import { reviewTimes } from '../src/operations.js';
const manifest = { duration: 4, fps: 30 };
const board = { shots: [
  { from: 0, to: 1, name: 'Hook', action: 'Open the panel', copy: 'One two three four', reviewAt: .8 },
  { from: 1, to: 4, name: 'Proof', action: 'Show the result', goal: 'Understand the benefit', focalPoint: 'Result', transition: 'Hold', sound: 'Silence' },
] };

test('planning separates missing intent from valid timing and flags dense copy', () => {
  const report = analyzeStoryboard(board, manifest);
  assert.equal(report.unanswered, 4);
  assert.equal(report.warnings.length, 1);
  assert.deepEqual(report.automaticTransitions, [1]);
  assert.deepEqual(report.shots.map(s => s.reviewAt), [.8, 2.5]);
  assert.equal(report.shots[1].questions.length, 0);
});

test('storyboard rejects gaps, overlaps, stale durations and invalid review points', () => {
  for (const patch of [{ from: 1.2 }, { from: .7 }, { to: 3 }, { to: 5 }, { from: NaN }, { reviewAt: 4 }, { action: '' }]) {
    const changed = structuredClone(board);
    Object.assign(changed.shots[1], patch);
    assert.throws(() => analyzeStoryboard(changed, manifest));
  }
  assert.throws(() => analyzeStoryboard({ shots: [] }, manifest));
});

test('review includes authored keyframes, automatic cut strips, and deduplicates captures', () => {
  const report = analyzeStoryboard(board, manifest);
  const times = reviewTimes(4, 30, report.automaticTransitions, report.shots.map(s => s.reviewAt));
  assert.ok(times.overview.includes(.8));
  assert.ok(times.overview.includes(2.5));
  assert.equal(times.strips[0][4], 1);
  assert.equal(new Set(times.all).size, times.all.length);
  assert.equal(times.all[0], 0);
  assert.ok(times.all.at(-1) < 4);
});

test('long storyboards bound automatic strip cost and disclose the omitted cuts', () => {
  const shots = Array.from({ length: 40 }, (_, i) => ({ from: i, to: i + 1, name: `${i}`, action: 'Move' }));
  const report = analyzeStoryboard({ shots }, { duration: 40, fps: 30 });
  assert.equal(report.automaticTransitions.length, 24);
  assert.equal(report.automaticTransitions[0], 1);
  assert.equal(report.automaticTransitions.at(-1), 39);
  assert.ok(report.warnings.some(w => w.includes('24 of 39')));
});

test('narration pace, spoken fragments, and unsourced figures are flagged without failing the plan', () => {
  const spoken = structuredClone(board);
  spoken.shots[0].narration = 'This sentence has far too many words to say in one second.';
  spoken.shots[1].narration = 'Fast. Simple. Yours. It cuts review time by 40% in 3x fewer steps.';
  const report = analyzeStoryboard(spoken, manifest);
  assert.ok(report.warnings.some(w => w.startsWith('Shot 1') && w.includes('wpm')));
  assert.ok(report.warnings.some(w => w.startsWith('Shot 2') && w.includes('fragments')));
  assert.ok(report.warnings.some(w => w.includes('40%, 3x')));
  assert.equal(report.narration.words, 25);
  assert.ok(critiqueTemplate(report, 'vertical').includes('Narration: Fast. Simple.'));
  assert.equal(staccatoRun('This tool renders the film. Then it checks the frames.'), 0);
  assert.equal(analyzeStoryboard(board, manifest).narration, undefined);
  spoken.shots[0].narration = 42;
  assert.throws(() => analyzeStoryboard(spoken, manifest), /narration/);
});

test('provenance warnings cover unlisted, missing, external, and generated assets', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-provenance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initProject(path.join(root, 'film'));
  const project = await loadProject(path.join(root, 'film'));
  assert.deepEqual(await provenanceWarnings(project), []);
  const manifestPath = path.join(project.root, 'assets/manifest.json');
  const assets = JSON.parse(await readFile(manifestPath, 'utf8'));
  assets.assets.push({ path: 'gone.png', origin: 'x' }, { path: 'clip.mp4', origin: 'Wikimedia Commons', sourceUrl: 'https://example.org', license: 'CC BY 4.0' }, { path: 'key.png', origin: 'Generated', generator: { tool: 'image model' } });
  await writeFile(manifestPath, JSON.stringify(assets));
  for (const file of ['clip.mp4', 'key.png', 'stray.wav']) await writeFile(path.join(project.root, 'assets', file), 'x');
  const warnings = await provenanceWarnings(project);
  assert.equal(warnings.length, 4);
  for (const expected of ['stray.wav has no provenance', 'gone.png does not match', 'requires attribution', 'generator.model']) assert.ok(warnings.some(w => w.includes(expected)), expected);
  const planned = await plan(project);
  assert.ok(planned.warnings.some(w => w.includes('stray.wav')));
});
