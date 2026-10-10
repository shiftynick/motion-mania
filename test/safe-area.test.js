import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSafeAreaFindings, safeAreaFindings, safeAreaMargins } from '../src/safe-area.js';

test('vertical safe-area margins use 9:16 defaults, tighter other sides, and explicit overrides', () => {
  assert.deepEqual(safeAreaMargins({}, { width: 1080, height: 1920 }), { top: 0.13, bottom: 0.19, left: 0.06, right: 0.06 });
  assert.equal(safeAreaMargins({}, { width: 1080, height: 1350 }).left, 0.04);
  assert.equal(safeAreaMargins({ safeArea: { top: 0, left: 0.1 } }, { width: 720, height: 1280 }).top, 0);
  for (const safeArea of [false, { top: -1 }, { bottom: 0.5 }, { left: '6%' }, { typo: 0.1 }]) assert.throws(() => safeAreaMargins({ safeArea }, { width: 720, height: 1280 }), /safeArea/);
});

test('repeated safe-area collisions become one element with edges, range and count', () => {
  assert.deepEqual(groupSafeAreaFindings([{ selector: '#cta', text: 'Ship', edge: 'bottom', at: 1 }, { selector: '#cta', text: 'Ship', edge: 'bottom', at: 3 }, { selector: '#cta', text: 'Ship', edge: 'right', at: 3 }]), [{ selector: '#cta', text: 'Ship', edges: ['bottom', 'right'], from: 1, to: 3, occurrences: 3 }]);
});

test('safe-area reports only measured caption-zone text collisions, preserving location', () => {
  const payload = { layout: { findings: [{ code: 'overlap', time: 1 }, { code: 'caption_zone_collision', time: 2, selector: '#title', text: 'Hi', bbox: { x: 2, y: 3, width: 4, height: 5 } }] } };
  assert.deepEqual(safeAreaFindings(payload, 'top'), [{ edge: 'top', at: 2, selector: '#title', text: 'Hi', bbox: { x: 2, y: 3, width: 4, height: 5 }, rect: undefined }]);
});

test('a full-width text wrapper is filtered when its measured text range stays inside the guides', () => {
  const dimensions = { width: 1000, height: 2000 }, margins = { top: 0.13, bottom: 0.19, left: 0.06, right: 0.06 };
  const f = rect => ({ code: 'caption_zone_collision', time: 1, selector: '#text', text: 'Hi', rect });
  const payload = { layout: { findings: [f({ left: 300, top: 600, width: 400, height: 80 }), f({ left: 20, top: 500, width: 150, height: 80 }), f({ left: 300, top: 1700, width: 400, height: 80 })] } };
  assert.equal(safeAreaFindings(payload, 'left', dimensions, margins).length, 1);
  assert.equal(safeAreaFindings(payload, 'bottom', dimensions, margins).length, 1);
  assert.equal(safeAreaFindings(payload, 'top', dimensions, margins).length, 0);
  assert.equal(safeAreaFindings(payload, 'right', dimensions, margins).length, 0);
});
