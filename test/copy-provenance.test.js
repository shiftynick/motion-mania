import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFindings, sourceText } from '../src/copy-provenance.js';

test('copy provenance questions distinguish supplied text, furniture, and new labels', () => {
  const source = '<main><h1>Your code in motion.</h1><p>Invented benefit here</p><span>v0.6.2 BETA</span><span>01 / 02 / 03</span><span>01:23:45</span><p>99% faster</p></main>';
  const report = copyFindings(source, 'src/index.html', ['Your code in motion.', '99% faster']);
  assert.equal(report.findings.length, 5);
  assert.ok(report.findings.some(f => f.category === 'secondary' && f.occurrences === 1));
  for (const value of ['v0.6.2 BETA', '01 / 02 / 03', '01:23:45', '99% faster']) assert.ok(report.findings.some(f => f.text === value && f.message.includes('sourced?')));
});

test('HTML inline spans form a line; hidden/code/style content and tiny labels stay quiet', () => {
  const source = '<html><head><title>Browser title</title><style>.x{content:"fake words"}</style></head><body><p>Read <b>this line</b> now.</p><div hidden>Secret words</div><div aria-hidden="true">Decorative words</div><pre>sample code here</pre><div style="display:none">Hidden words</div><i>1</i><span>$</span><script>const x = "not visible";</script></body></html>';
  assert.deepEqual(copyFindings(source, 'src/index.html', ['Read this line now.']).findings, []);
  assert.ok(sourceText(source, 'src/index.html').some(s => s.text === 'Read this line now.'));
});

test('literal text assignments are checked, interpolated text is left for review, and local comments waive questions', () => {
  const grouped = copyFindings('node.textContent = "New on screen"; other.innerText = "Known copy"; node.innerHTML = "<b>Bold new copy</b>"; node.textContent = `count ${n}`;', 'src/scene.js', ['Known copy']);
  assert.equal(grouped.findings.length, 1);
  assert.equal(grouped.findings[0].occurrences, 2);
  assert.equal(copyFindings('// motion-mania-ignore copy_provenance: version identifies the real supplied release\nnode.textContent = "v0.6.2";', 'src/scene.js', []).findings.length, 0);
  const report = copyFindings('<!-- motion-mania-ignore copy_provenance: measured result from the supplied brief -->\n<p>99% faster</p>', 'src/index.html', []);
  assert.equal(report.findings.length, 0);
  assert.equal(report.waived.length, 1);
});
