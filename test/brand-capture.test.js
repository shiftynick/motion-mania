import test from 'node:test';
import assert from 'node:assert/strict';
import { captureUrl, summarizeCapture } from '../src/brand-capture.js';

test('capture requires explicit credential-free HTTP(S), including local test URLs', () => {
  assert.equal(captureUrl('http://127.0.0.1:8080'), 'http://127.0.0.1:8080/');
  for (const url of [undefined, 'example.com', 'file:///tmp/index.html', 'https://user:secret@example.com']) assert.throws(() => captureUrl(url));
});

test('capture summary preserves partial results and proposes only observed brand candidates', () => {
  const summary = summarizeCapture({ url: 'https://example.com', fonts: ['Demo Sans'], dropped: { images: 2 }, warnings: ['font not downloaded'], httpStatus: 200 }, { title: 'Demo', colors: ['#112233', '#112233'], cssVariables: { '--accent': 'rgb(2, 3, 4)', '--spacing': '20px' }, fonts: [{ family: 'Demo Sans' }, { family: 'Other' }] }, ['screenshots/full.png', 'assets/logo.svg', 'assets/hero.webp', 'assets/contact-sheet.jpg', 'assets/fonts/demo.woff2']);
  assert.deepEqual(summary.paletteCandidates, ['#112233', 'rgb(2, 3, 4)']);
  assert.deepEqual(summary.fontFamilies, ['Demo Sans', 'Other']);
  assert.deepEqual(summary.logoCandidates, ['assets/logo.svg']);
  assert.equal(summary.imageCandidates.length, 2);
  assert.deepEqual(summary.dropped, { images: 2 });
  assert.equal(summary.brandProposal.palette.candidate1, '#112233');
  assert.equal(summary.brandProposal.font, 'Demo Sans');
  assert.equal(summary.httpStatus, 200);
  assert.deepEqual(summarizeCapture({ ok: false }).paletteCandidates, []);
  assert.equal(summarizeCapture({ ok: false }).brandProposal.font, undefined);
});
