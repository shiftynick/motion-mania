import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeCaptions, captionSampleTimes, cleanWords, compareNarration, groupWords, importCaptions, injectCaptions } from '../src/captions.js';
import { initProject, loadProject, withBuild } from '../src/project.js';

const manifest = { duration: 6, fps: 30 };
const said = (text, start = 0.2, step = 0.3) => text.split(' ').map((word, i) => ({ text: word, start: Number((start + i * step).toFixed(3)), end: Number((start + i * step + 0.25).toFixed(3)) }));

test('transcripts are cleaned of noise tokens and sorted', () => {
  const words = cleanWords([{ text: ' b ', start: 1, end: 1.2 }, { text: '♪', start: 0, end: 1 }, { text: '', start: 2, end: 3 }, { text: 'a', start: 0.5, end: 0.4 }, { text: 'x', start: 'nope', end: 1 }]);
  assert.deepEqual(words, [{ text: 'a', start: 0.5, end: 0.5 }, { text: 'b', start: 1, end: 1.2 }]);
});

test('grouping breaks on sentences, pauses, and size limits, then holds each line', () => {
  const words = [...said('One two three four five six seven.'), ...said('After pause', 3.5)];
  const groups = groupWords(words, { duration: 6, maxWords: 5 });
  assert.deepEqual(groups.map(g => g.words.map(w => w.text).join(' ')), ['One two three four five', 'six seven.', 'After pause']);
  assert.equal(groups[0].end, groups[1].start);
  assert.equal(groups[1].end, Number((groups[1].words.at(-1).end + 0.3).toFixed(3)));
  assert.ok(groups.at(-1).end <= 6);
  const cues = groupWords(cleanWords([{ text: 'A whole subtitle cue', start: 0, end: 2 }, { text: 'Next', start: 2.1, end: 2.4 }]), { duration: 6 });
  assert.equal(cues.length, 2);
  assert.equal(groupWords(said('late words', 5.9), { duration: 6 }).length, 1);
});

test('caption files are validated and dense lines produce warnings', () => {
  const good = { groups: groupWords(said('Readable caption line here.'), { duration: 6 }) };
  assert.equal(analyzeCaptions(good, manifest).warnings.length, 0);
  const dense = { groups: [{ start: 0, end: 0.4, words: [{ text: 'An extraordinarily long caption that cannot be read', start: 0 }] }] };
  assert.equal(analyzeCaptions(dense, manifest).warnings.length, 3);
  for (const groups of [[{ start: 1, end: 0.5, words: [{ text: 'a', start: 1 }] }], [{ start: 0, end: 7, words: [{ text: 'a', start: 0 }] }], [{ start: 0, end: 1, words: [] }], [{ start: 0, end: 1, words: [{ text: 'a', start: 3 }] }], [{ start: 1, end: 2, words: [{ text: 'a', start: 1 }] }, { start: 0.5, end: 3, words: [{ text: 'b', start: 0.5 }] }]]) {
    assert.throws(() => analyzeCaptions({ groups }, manifest));
  }
  assert.throws(() => analyzeCaptions({}, manifest));
  assert.deepEqual(captionSampleTimes({ groups: [{ start: 0, end: 1, words: [{ text: 'a' }] }, { start: 2, end: 4, words: [{ text: 'longer' }] }] }, 1), [3]);
});

test('heard words are compared with each shot’s narration script', () => {
  const shots = [{ index: 1, name: 'Open', from: 0, to: 2, narration: 'Motion Mania turns a brief' }, { index: 2, name: 'Close', from: 2, to: 6, narration: 'into a finished film.' }];
  const captions = { groups: groupWords([...said('Motion Mania turns a brief'), ...said('into a finished film.', 2.5)], { duration: 6 }) };
  const report = compareNarration(shots, captions);
  assert.deepEqual(report.shots.map(s => s.similarity), [1, 1]);
  assert.deepEqual(report.warnings, []);
  const drifted = compareNarration(shots, { groups: groupWords(said('Motion Mania turns a brief', 1.2), { duration: 6 }) });
  assert.ok(drifted.warnings.some(w => w.includes('Open')));
  assert.ok(drifted.warnings.some(w => w.includes('Close')));
  assert.equal(compareNarration([{ from: 0, to: 6, name: 'x' }], captions), null);
});

test('injection adds escaped clips on a free track and attaches tweens after the timeline', () => {
  const html = '<html><head></head><body><main id="film" data-composition-id="demo" data-width="720" data-height="1280"><section class="clip" data-track-index="0"></section><audio data-track-index="3"></audio></main><script src="scene.js"></script></body></html>';
  const out = injectCaptions(html, { groups: [{ start: 0.5, end: 1.5, words: [{ text: '<b>&', start: 0.5 }, { text: 'ok', start: 1 }] }] });
  assert.match(out, /<main id="film"[^>]*>\n<div id="mm-caption-0" class="clip mm-caption" data-start="0.5" data-duration="1" data-track-index="4">/);
  assert.ok(out.includes('&lt;b&gt;&amp;'));
  assert.ok(out.indexOf('<style>') < out.indexOf('</head>'));
  assert.ok(out.indexOf('src="scene.js"') < out.indexOf('window.__timelines[id]'));
  assert.ok(out.includes('[[0.5,[0.5,1]]]'));
  // Project rules like `#film > .clip { inset: 0 }` must not pull captions to the top.
  assert.match(out, /\.mm-caption \{ position: absolute !important; inset: auto 0 var\(--mm-caption-bottom, 8%\) 0 !important;/);
  assert.throws(() => injectCaptions('<main></main>', { groups: [] }), /data-composition-id/);
});

test('import normalizes transcripts through the backend, refuses overwrites, and builds captions in', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-captions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'film');
  await initProject(target);
  const project = await loadProject(target);
  const srt = path.join(root, 'voice.srt');
  await writeFile(srt, '1\n00:00:00,500 --> 00:00:02,000\nYour code, in motion.\n\n2\n00:00:02,200 --> 00:00:03,500\nReview every frame.\n');
  const shots = [{ index: 1, name: 'Hook', from: 0, to: 15, narration: 'Your code, in motion. Review every frame.' }];
  const result = await importCaptions(project, srt, { shots });
  assert.equal(result.format, 'srt');
  assert.equal(result.groups, 2);
  assert.ok(result.warnings.some(w => w.includes('Phrase-level')));
  assert.equal(result.narration[0].similarity, 1);
  await assert.rejects(importCaptions(project, srt), /--replace/);
  await assert.rejects(importCaptions(project, path.join(root, 'voice.wav'), { replace: true }), /transcripts/);
  const words = path.join(root, 'words.json');
  await writeFile(words, JSON.stringify(said('Your code in motion.')));
  assert.equal((await importCaptions(project, words, { replace: true, maxWords: 2 })).groups, 2);
  const saved = JSON.parse(await readFile(path.join(target, 'captions.json'), 'utf8'));
  assert.equal(saved.source, 'words.json');
  await withBuild(project, 'vertical', async directory => {
    const html = await readFile(path.join(directory, 'index.html'), 'utf8');
    assert.ok(html.includes('id="mm-caption-1"'));
    assert.ok(html.includes('data-track-index="2"'));
  });
  await writeFile(path.join(target, 'captions.json'), JSON.stringify({ groups: [{ start: 20, end: 21, words: [{ text: 'late', start: 20 }] }] }));
  await assert.rejects(withBuild(project, 'vertical', () => {}), /Caption 1/);
});
