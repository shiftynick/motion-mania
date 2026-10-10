import test from 'node:test';
import assert from 'node:assert/strict';
import { variableDeclarations, validateVariants, parseBatchOutput } from '../src/variants.js';

const declarations = [{ id: 'title', label: 'Title', type: 'string', default: 'Normal' }, { id: 'count', type: 'number', default: 2, min: 1, max: 5 }, { id: 'shown', type: 'boolean', default: true }];
const variants = () => ({ schemaVersion: 1, reviewAt: 0, variants: [{ name: 'a', variables: { title: 'First', count: 1, shown: false } }, { name: 'b', label: 'Second copy', variables: { title: 'Second' } }] });

test('composition variables are arrays with typed defaults, with HTML entities supported', () => {
  assert.deepEqual(variableDeclarations(`<main data-composition-variables='${JSON.stringify(declarations)}'>`), declarations);
  assert.deepEqual(variableDeclarations(`<main data-composition-variables="${JSON.stringify(declarations).replaceAll('"', '&quot;')}">`), declarations);
  for (const html of ['<main>', '<main data-composition-variables="{}">', '<main data-composition-variables="[]">', `<main data-composition-variables='[{"id":"title","type":"string","default":2}]'>`]) assert.throws(() => variableDeclarations(html));
});

test('named variants reject unsafe names, duplicates, unknown variables, type mismatches and invalid labels', () => {
  assert.equal(validateVariants(variants(), declarations).variants.length, 2);
  for (const change of [v => v.variants[0].name = '../outside', v => v.variants[1].name = 'a', v => v.variants[0].variables.missing = 'x', v => v.variants[0].variables.count = 9, v => v.variants[0].variables.shown = 'yes', v => v.variants[0].label = 'a,b', v => v.variants[0].variables = {}, v => v.reviewAt = -1, v => v.unknown = true]) {
    const value = variants(); change(value); assert.throws(() => validateVariants(value, declarations));
  }
  assert.throws(() => validateVariants({ schemaVersion: 1, variants: [] }, declarations));
});

test('batch parser accepts contaminated stdout only when the final record is complete', () => {
  const batch = { type: 'batch-complete', total: 2, completed: 2, failed: 0, skipped: 0, rows: [{ status: 'completed' }, { status: 'completed' }] };
  assert.deepEqual(parseBatchOutput(`[BrowserManager] launched\n${JSON.stringify(batch)}\n`), batch);
  assert.throws(() => parseBatchOutput('log without JSON'), /end with/);
  assert.throws(() => parseBatchOutput(JSON.stringify({ ...batch, failed: 1 })), /incomplete/);
  assert.throws(() => parseBatchOutput(`${JSON.stringify(batch)}\ntrailing chatter`), /end with/);
  assert.throws(() => parseBatchOutput(JSON.stringify({ ...batch, rows: [{ status: 'failed' }, { status: 'completed' }] })), /incomplete/);
});
