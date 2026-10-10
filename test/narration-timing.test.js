import test from 'node:test';
import assert from 'node:assert/strict';
import { measuredNarration } from '../src/narration-timing.js';
import { compareNarration } from '../src/captions.js';
const shots = [{ index: 1, name: 'Open', from: 0, to: 2, narration: 'Hello world' }, { index: 2, name: 'Close', from: 2, to: 4, narration: 'Here we go' }];
const captions = words => ({ groups: [{ words }] });
const w = (text, start, end = start + .2) => ({ text, start, end });

test('measured script bounds follow matched words across cuts and expose both overruns', () => {
  const spoken = captions([w('Hello', .3), w('world', 1.8, 2.1), w('Here', 1.9), w('we', 2.2), w('go', 3.9, 4.1)]);
  const report = compareNarration(shots, spoken);
  assert.equal(report.shots[0].start, .3);
  assert.equal(report.shots[0].end, 2.1);
  assert.equal(report.shots[1].start, 1.9);
  assert.ok(report.warnings.some(s => s.includes('Open') && s.includes('0.10s past')));
  assert.ok(report.warnings.some(s => s.includes('Close') && s.includes('0.10s before')));
  assert.ok(report.warnings.some(s => s.includes('Close') && s.includes('0.10s past')));
});

test('short leading/trailing pads warn, sufficient pads stay quiet, and missing ends remain uncertain', () => {
  const short = measuredNarration(shots.slice(0, 1), captions([w('Hello', .05), w('world', 1.8, 1.9)]));
  assert.equal(short.warnings.length, 2);
  const comfortable = measuredNarration(shots.slice(0, 1), captions([w('Hello', .3), w('world', 1.4)]));
  assert.deepEqual(comfortable.warnings, []);
  const missingEnd = measuredNarration(shots.slice(0, 1), captions([w('Hello', .3), { text: 'world', start: 1.4 }]));
  assert.equal(missingEnd.shots[0].end, undefined);
  assert.ok(missingEnd.warnings.some(s => s.includes('no end time')));
});

test('alignment tolerates a minor omission, rejects low coverage, and stays ordered on repeated lines', () => {
  const script = [{ index: 1, name: 'Open', from: 0, to: 4, narration: 'One two three four five' }];
  assert.equal(measuredNarration(script, captions([w('one', .4), w('two', .6), w('four', .8), w('five', 1)])).shots[0].coverage, .8);
  const missingEdge = measuredNarration(script, captions([w('two', .4), w('three', .6), w('four', .8), w('five', 1)]));
  assert.equal(missingEdge.shots[0].boundsComplete, false);
  assert.ok(missingEdge.warnings.some(s => s.includes('complete speech bounds uncertain')));
  const low = measuredNarration(script, captions([w('one', .4)]));
  assert.equal(low.shots[0].start, undefined);
  assert.ok(low.warnings.some(s => s.includes('uncertain')));
  const repeats = [{ index: 1, name: 'A', from: 0, to: 2, narration: 'Hello world' }, { index: 2, name: 'B', from: 2, to: 4, narration: 'Hello world' }];
  assert.deepEqual(measuredNarration(repeats, captions([w('Hello', .4), w('world', .8), w('Hello', 2.4), w('world', 2.8)])).shots.map(s => s.start), [.4, 2.4]);
});

test('word/phrase anchors use the spoken start, default early window, and configurable tolerance', () => {
  const shot = { index: 1, name: 'Open', from: 0, to: 4, narration: 'Hello beautiful world', anchor: { text: 'beautiful world', at: 1.4 } };
  const spoken = captions([w('Hello', .4), w('beautiful', 2), w('world', 2.4)]);
  let report = measuredNarration([shot], spoken);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.shots[0].anchor.preferredAt, 1.4);
  shot.anchor.at = 2.3;
  assert.ok(measuredNarration([shot], spoken).warnings.some(s => s.includes('visual anchor')));
  shot.anchor.after = .5;
  assert.deepEqual(measuredNarration([shot], spoken).warnings, []);
  shot.anchor.text = 'missing';
  assert.ok(measuredNarration([shot], spoken).warnings.some(s => s.includes('not aligned')));
});
