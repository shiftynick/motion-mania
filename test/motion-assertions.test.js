import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { backendFindings, verificationFindings, shotAssertions, writeMotionAssertions } from '../src/motion-assertions.js';

test('shot deadlines become absolute backend time and other semantics remain composition-wide', () => {
  assert.deepEqual(shotAssertions({ from: 3, to: 6, assertions: [{ kind: 'appearsBy', selector: '#title', bySec: .5 }, { kind: 'before', a: '#title', b: '#cta' }, { kind: 'keepsMoving', withinSelector: '#actor', maxStaticSec: 1 }] }), [{ kind: 'appearsBy', selector: '#title', bySec: 3.5 }, { kind: 'before', a: '#title', b: '#cta' }, { kind: 'keepsMoving', withinSelector: '#actor', maxStaticSec: 1 }]);
});

test('only transient geometry is advisory; settled layout, explicit gates and assertions still fail', () => {
  const finding = (code, times) => ({ code, severity: 'error', time: times[0], times });
  const report = verificationFindings({ layout: { findings: [finding('text_box_overflow', [1, 1.1]), finding('text_occluded', [1, 2]), finding('caption_zone_collision', [1])] }, motion: { findings: [finding('motion_off_frame', [1])] }, runtime: { findings: [finding('runtime_error', [1])] } }, [2]);
  assert.equal(report.find(f => f.code === 'text_box_overflow').severity, 'warning');
  assert.equal(report.find(f => f.code === 'text_box_overflow').occurrences, 2);
  for (const code of ['text_occluded', 'caption_zone_collision', 'motion_off_frame', 'runtime_error']) assert.equal(report.find(f => f.code === code).severity, 'error');
});

test('transition advice groups covered children without hiding settled findings or errors', () => {
  const finding = (selector, times, code = 'text_occluded') => ({ selector, code, severity: 'error', time: times[0], times });
  const report = verificationFindings({ layout: { findings: [finding('#a', [1, 1.1]), finding('#b', [1.05]), finding('#c', [2]), finding('#caption', [1], 'caption_zone_collision')] } }, [2]);
  const grouped = report.find(f => f.inspection === 'transition');
  assert.equal(grouped.elementCount, 2);
  assert.equal(grouped.occurrences, 3);
  assert.deepEqual([grouped.firstSeen, grouped.lastSeen], [1, 1.1]);
  assert.deepEqual(grouped.selectors, ['#a', '#b']);
  assert.deepEqual(report.filter(f => f.severity === 'error').map(f => f.selector), ['#c', '#caption']);
});

test('prepared backend sidecars avoid the manifest filename and are absent without intent', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-assertions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const build = path.join(root, 'build'); await mkdir(build);
  const project = { root, manifest: { duration: 6 } };
  assert.equal(await writeMotionAssertions(project, build), build);
  await assert.rejects(readFile(path.join(build, 'index.motion.json')), /ENOENT/);
  await writeFile(path.join(root, 'storyboard.json'), JSON.stringify({ shots: [{ from: 3, to: 6, assertions: [{ kind: 'appearsBy', selector: '#title', bySec: .5 }] }] }));
  await writeMotionAssertions(project, build);
  assert.deepEqual(JSON.parse(await readFile(path.join(build, 'index.motion.json'), 'utf8')), { version: 1, duration: 6, assertions: [{ kind: 'appearsBy', selector: '#title', bySec: 3.5 }] });
  await assert.rejects(readFile(path.join(build, 'motion.json')), /ENOENT/);
});

test('backend motion errors retain code, selector and message beside other check findings', () => {
  assert.deepEqual(backendFindings({ lint: { findings: [{ code: 'css_transition_used' }] }, motion: { findings: [{ code: 'motion_appears_late', selector: '#title', message: 'appears too late' }] } }).map(f => [f.section, f.code]), [['lint', 'css_transition_used'], ['motion', 'motion_appears_late']]);
});
