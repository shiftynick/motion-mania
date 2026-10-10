import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { lint, lintSource, mergeLintFindings } from '../src/lint.js';
import { initProject, loadProject } from '../src/project.js';

const timeline = code => `const tl = gsap.timeline({ paused: true });\n${code}\nwindow.__timelines.demo = tl;`;
const rules = code => lintSource(timeline(code)).findings.map(f => f.rule);
const cases = [
  ['non_deterministic_code', 'tl.to("#a", { x: Math.random() });', 'const random = seed => seed * 16807 % 2147483647; tl.to("#a", { x: random(7) });'],
  ['non_deterministic_code', 'tl.to("#a", { x: Date.now() });', 'const date = new Date(123);'],
  ['non_deterministic_code', 'tl.to("#a", { x: performance.now() });', 'const at = tl.time();'],
  ['non_deterministic_code', 'tl.to("#a", { x: gsap.utils.random(0, 1) });', 'tl.to("#a", { x: 1 });'],
  ['non_deterministic_code', 'tl.to("#a", { x: "random(0, 1)" });', 'const label = "Math.random()";'],
  ['state_timer', 'setTimeout(() => { node.textContent = "done"; }, 20);', 'tl.set("#a", { opacity: 1 }, 2);'],
  ['state_timer', 'setInterval(() => node.x++, 20);', 'tl.to("#a", { x: 20 });'],
  ['state_timer', 'requestAnimationFrame(tick);', 'const t = tl.time();'],
  ['gsap_random_stagger', 'tl.to("#a", { x: 20, stagger: { from: "random" } });', 'tl.to("#a", { x: 20, stagger: { from: "center" } });'],
  ['gsap_relative_value', 'tl.to("#a", { x: "+=20" });', 'tl.to("#a", { x: 20 }, "+=0.5");'],
  ['gsap_relative_value', 'tl.fromTo("#a", { x: 0 }, { x: "-=20" });', 'tl.addLabel("go", "+=0.5");'],
  ['gsap_function_value', 'tl.to("#a", { x: (i) => i * 20 });', 'tl.to("#a", { x: 20, onComplete: () => console.log("done") });'],
  ['gsap_function_value', 'const move = () => 12; tl.to("#a", { x: move });', 'const move = 12; tl.to("#a", { x: move });'],
  ['gsap_infinite_repeat', 'tl.to("#a", { x: 20, repeat: -1 });', 'tl.to("#a", { x: 20, repeat: 2 });'],
  ['gsap_non_transform_motion', 'tl.to("#a", { left: 20, top: 30, width: 50, height: 50, marginLeft: 20 });', 'tl.set("#a", { left: 20 }); tl.to("#a", { x: 20, scale: 2 });'],
  ['linear_spatial_ease', 'tl.to("#a", { x: 20, ease: "linear" });', 'tl.to("#a", { opacity: 1, ease: "none" });'],
  ['linear_spatial_ease', 'tl.fromTo("#a", { scale: 1 }, { scale: 1.1, ease: "none" });', 'tl.to("#a", { x: 20, ease: "power2.inOut" });'],
];
for (const [rule, bad, good] of cases) test(`${rule}: ${bad}`, () => {
  assert.ok(rules(bad).includes(rule));
  assert.ok(!rules(good).includes(rule));
  const waived = lintSource(timeline(`// motion-mania-ignore ${rule}: intentional stable inputs\n${bad}`));
  assert.ok(!waived.findings.some(f => f.rule === rule));
  assert.ok(waived.waived.some(f => f.rule === rule));
});

test('CSS transitions and free-running animations have local waivers and paused variants', () => {
  for (const [rule, bad, good] of [['css_transition_used', '.a { transition: transform .2s; }', '.a { transition: none; }'], ['css_animation', '.a { animation: spin 2s infinite; }', '.a { animation: spin 2s infinite; animation-play-state: paused; }']]) {
    assert.ok(lintSource(bad, 'src/scene.css').findings.some(f => f.rule === rule));
    assert.ok(!lintSource(good, 'src/scene.css').findings.some(f => f.rule === rule));
    assert.equal(lintSource(`/* motion-mania-ignore ${rule}: seek controls its play time */\n${bad}`, 'src/scene.css').findings.length, 0);
    assert.equal(lintSource(`<div style="${rule === 'css_animation' ? 'animation: spin 2s' : 'transition: opacity .2s'}"></div>`, 'src/index.html').findings.length, 1);
  }
});

test('literals, comments, positions and setup geometry stay inert; vars objects are checked', () => {
  assert.deepEqual(rules('// Math.random()\nconst words = "setTimeout(() => x++, 20)"; tl.to("#a", { x: 20 }, "+=0.5");'), []);
  assert.deepEqual(rules('const box = { width: 20, height: 20 }; node.style.left = "10px";'), []);
  assert.ok(rules('const vars = { x: "+=20" }; tl.to("#a", vars);').includes('gsap_relative_value'));
  assert.equal(lintSource('<!-- Math.random() --><p>Math.random()</p>', 'src/index.html').findings.length, 0);
  const noReason = lintSource(timeline('// motion-mania-ignore state_timer:\nsetTimeout(tick, 20);'));
  assert.equal(noReason.findings.length, 1);
});

test('backend findings replace equivalent supplements at the same source location', () => {
  const local = { code: 'gsap_relative_value', file: 'src/scene.js', line: 2 };
  const backend = { code: 'gsap_relative_value_second_writer', file: 'src/scene.js', line: 2, origin: 'hyperframes' };
  assert.deepEqual(mergeLintFindings([local], [backend]), [backend]);
  assert.equal(mergeLintFindings([{ ...local, line: 3 }], [backend]).length, 2);
});

test('lint exposes actual backend rules, maps authored lines, covers extra scripts and honors waivers', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-lint-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initProject(path.join(root, 'film'));
  const project = await loadProject(path.join(root, 'film'));
  const entry = path.join(project.root, 'src/scene.js'), original = await readFile(entry, 'utf8');
  await writeFile(entry, `${original}\nconst extra = Math.random();\n`);
  let report = await lint(project, 'landscape');
  assert.equal(report.ok, false);
  const clock = report.findings.filter(f => f.code === 'non_deterministic_code');
  assert.equal(clock.length, 1);
  assert.equal(clock[0].origin, 'hyperframes');
  assert.equal(clock[0].file, 'src/scene.js');
  assert.equal(clock[0].line, original.split('\n').length + 1);
  await writeFile(entry, `${original}\n// motion-mania-ignore non_deterministic_code: telemetry value never controls pixels\nconst extra = Math.random();\n`);
  report = await lint(project, 'landscape');
  assert.equal(report.ok, true);
  assert.ok(report.waived.some(f => f.code === 'non_deterministic_code'));
  await writeFile(path.join(project.root, 'src/extra.js'), 'const value = Date.now();\n');
  report = await lint(project, 'landscape');
  assert.ok(report.findings.some(f => f.file === 'src/extra.js' && f.code === 'non_deterministic_code'));
});
