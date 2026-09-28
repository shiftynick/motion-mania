import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStoryboard } from '../src/storyboard.js';
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
