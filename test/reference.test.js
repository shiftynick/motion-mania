import test from 'node:test';
import assert from 'node:assert/strict';
import { cutPacing, sceneCutTimes, referenceCritique } from '../src/reference.js';

test('cut pacing sorts and deduplicates internal cuts, including full first and final shots', () => {
  const result = cutPacing([8, 0, 2, 2, 10, NaN, -1], 10);
  assert.deepEqual(result.cutTimes, [2, 8]);
  assert.deepEqual(result.shotLengths, [2, 6, 2]);
  assert.equal(result.cutsPerMinute, 12);
  assert.equal(result.meanShotLength, 10 / 3);
  assert.equal(result.medianShotLength, 2);
  assert.equal(cutPacing([5], 12).medianShotLength, 6);
  assert.deepEqual(cutPacing([], 12).shotLengths, [12]);
  assert.throws(() => cutPacing([], 0), /positive/);
});

test('scene logs preserve seconds and critique limits reference use to grammar', () => {
  assert.deepEqual(sceneCutTimes('[showinfo] pts_time:1.25 x\n[showinfo] pts_time:3.4e+1'), [1.25, 34]);
  const pacing = cutPacing([2], 5), critique = referenceCritique({ sheet: '/sheet.png', pacing: { reference: pacing, ours: null, method: 'heuristic' } });
  assert.match(critique, /never its content or identity/);
  assert.match(critique, /No storyboard/);
  assert.match(critique, /without time stretching/);
});
