const root = document.getElementById('film');
const W = Number(root.dataset.width), H = Number(root.dataset.height);
const REM = Math.min(W, H) / 67.5;
document.documentElement.style.fontSize = `${REM}px`;
const $ = selector => root.querySelector(selector), $$ = selector => [...root.querySelectorAll(selector)];

// Real evidence from an earlier draft of this film (scripts/evidence.mjs).
const E = window.LOOP_EVIDENCE;
// Shot boundaries (storyboard.json).
const CUTS = [6.5, 12.5, 19, 26, 32], FILM = 36;
const NAMES = ['Brief', 'Plan', 'Build', 'Evidence', 'Second opinion', 'Ship'];

// ---- Evidence: contact sheet, cut strip, and the draft's waveform and activity ----
const image = (src, label) => {
  const el = document.createElement('div');
  el.className = 'shot-thumb';
  el.innerHTML = `<img src="${src}" alt="">${label ? `<b>${label}</b>` : ''}`;
  return el;
};
const thumbs = E.sheet.map((t, i) => $('.thumbs').appendChild(image(`assets/evidence/sheet-${String(i + 1).padStart(2, '0')}.jpg`, `${t.toFixed(1)}s`)));
const stripFrames = E.strip.map((_, i) => $('.frames').appendChild(image(`assets/evidence/strip-${i + 1}.jpg`)));
const minus = value => String(value).replace('-', '−');
$('.wave-title').textContent = `waveform.png · ${minus(E.loudness.integrated)} LUFS · ${minus(E.loudness.truePeak)} dBTP`;
$('.activity-title').textContent = `activity.png · ${E.heldSeconds}s frozen in holds of 0.6s or more`;

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = (name, attrs) => { const el = document.createElementNS(SVG, name); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
// Same layout as the CLI's charts: time across, cuts in orange with shot names.
function chartFrame(plot) {
  const { width, height } = plot.getBoundingClientRect();
  plot.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const xAt = t => t / FILM * width;
  CUTS.forEach(t => plot.appendChild(svgEl('line', { x1: xAt(t), x2: xAt(t), y1: 0, y2: height, stroke: '#ff5a2b', 'stroke-width': 2 })));
  [0, ...CUTS].forEach((t, i) => {
    const label = svgEl('text', { x: xAt(t) + 5, y: 0.95 * REM, fill: '#ff5a2b', 'font-size': 0.8 * REM, 'font-family': 'JetBrains Mono, monospace' });
    label.textContent = NAMES[i];
    plot.appendChild(label);
  });
  return { width, height, xAt, top: 1.4 * REM };
}
{
  const plot = $('.wave-chart .plot'), { height, xAt, top } = chartFrame(plot), { peaks, levels } = E.waveform;
  const mid = (top + height) / 2, half = (height - top) / 2, x = c => xAt((c + 0.5) / peaks.length * FILM);
  const shape = values => [...values.map((v, c) => `${x(c)},${mid - Math.min(1, v) * half}`), ...values.map((v, c) => `${x(c)},${mid + Math.min(1, v) * half}`).reverse()].join(' ');
  plot.insertBefore(svgEl('polygon', { points: shape(levels), fill: '#f3f0e7' }), plot.firstChild);
  plot.insertBefore(svgEl('polygon', { points: shape(peaks), fill: '#6f6c64' }), plot.firstChild);
}
const FROZEN = E.holds.find(h => !h.intended && !h.final);
const frozenBox = (() => {
  const plot = $('.activity-chart .plot'), { height, xAt, top } = chartFrame(plot), { rate, change } = E.activity;
  const y = v => height - Math.min(1, Math.sqrt(v / 60)) * (height - top);
  let red = null;
  for (const h of E.holds) {
    const rect = svgEl('rect', { x: xAt(h.from), y: top, width: xAt(h.to) - xAt(h.from), height: height - top, fill: h.intended || h.final ? '#2a3230' : '#6a2a22' });
    plot.insertBefore(rect, plot.firstChild);
    if (h === FROZEN) red = rect;
  }
  plot.appendChild(svgEl('line', { x1: 0, x2: xAt(FILM), y1: y(1), y2: y(1), stroke: '#6f6c64', 'stroke-dasharray': '4 4' }));
  plot.appendChild(svgEl('polyline', { points: change.map((v, k) => `${xAt((k + 1) / rate)},${y(v)}`).join(' '), fill: 'none', stroke: '#f3f0e7', 'stroke-width': 1.5 }));
  return red;
})();
$('.frozen-note').textContent = `frozen ${FROZEN.from}–${FROZEN.to}s · no hold intended`;

// ---- Measure every destination before any tween moves anything ----
const film = root.getBoundingClientRect();
const box = (el, pad = 0) => { const r = el.getBoundingClientRect(); return { x: r.left - film.left - pad, y: r.top - film.top - pad, width: r.width + 2 * pad, height: r.height + 2 * pad }; };
const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const P = 0.55 * REM;
const at = {
  benefit: box($('.line.benefit'), P),
  cell1: box($('.c1 .thumb'), P), cell3: box($('.c3 .thumb'), P),
  preview: box($('.preview'), P),
  thumb: box(thumbs[1], P * 0.7),
  frozen: box(frozenBox, P * 0.6),
  row1: box($('.f1')), row2: box($('.f2')), row3: box($('.f3')),
  badge3: box($('.f3 .status.open'), P * 0.8),
  verdict: box($('.verdict'), P),
  land: box($('.ex-land .ex-screen'), P), vert: box($('.ex-vert .ex-screen'), P),
  cmd: box($('.lock-cmd span'), P),
  doc: box($('#brief .doc')), board: box($('.board')), cell3Center: center(box($('.c3 .thumb'))),
};
// Finding rows get a little room on either side.
for (const key of ['row1', 'row2', 'row3']) Object.assign(at[key], { x: at[key].x - P * 1.4, width: at[key].width + P * 2.8, y: at[key].y + P * 0.3, height: at[key].height - P * 0.6 });
const statusPoint = row => { const r = box($(`.${row} .status.open`)); return { x: r.x + r.width * 0.55, y: r.y + r.height * 0.6 }; };
const frozenNote = $('.frozen-note'), activity = box($('.activity-chart'));
// The label hangs just below the chart, aligned to the stretch, so it covers none of the data.
frozenNote.style.left = `${at.frozen.x - activity.x}px`;
frozenNote.style.top = `${activity.height + 0.7 * REM}px`;
const slot = $('.v-slot').getBoundingClientRect().height, mask = $('.title-mask').getBoundingClientRect().height;

const frame = $('.f-main'), twin = $('.f-twin');
const rect = r => ({ x: r.x, y: r.y, width: r.width, height: r.height });
const tl = gsap.timeline({ paused: true });
const fly = (target, time, duration = 0.65, ease = 'power3.inOut', el = frame) => tl.to(el, { ...rect(target), duration, ease }, time);
// Swap two stacked texts in place through a mask: the old one leaves upward as the new one rises.
const swap = (from, to, time, distance) => {
  tl.to(from, { y: -distance, duration: 0.28, ease: 'power3.in' }, time - 0.28);
  // One frame of overlap: the new line enters as the old one's last edge leaves, so the slot is never empty.
  tl.fromTo(to, { y: distance, opacity: 1 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, time - 0.04);
};

// ---- Titles: one slot, never empty ----
// Titles change with the layout; at the flash cut they switch instantly under the white.
tl.set('.t1', { opacity: 1 }, 0);
swap('.t1', '.t2', 6.0, mask);
swap('.t2', '.t3', 12.1, mask);
tl.set('.t3', { y: -mask }, 18.96);
tl.set('.t4', { y: 0, opacity: 1 }, 18.96);
swap('.t4', '.t5', 25.5, mask);
tl.to('.t5', { y: -mask, duration: 0.3, ease: 'power3.in' }, 31.4);

// ---- 1 · Brief: the benefit line becomes the frame ----
// A slow push keeps the page alive; the frame takes the same push about the page's center.
const docCenter = center(at.doc), PUSH_END = 5.75, pushed = t => 1 + 0.07 * t / PUSH_END;
tl.set('#brief .doc', { opacity: 1 }, 0);
tl.set(frame, { ...rect(at.benefit), opacity: 0, backgroundColor: 'rgba(255, 90, 43, 0)', scale: 1, transformOrigin: `${docCenter.x - at.benefit.x}px ${docCenter.y - at.benefit.y}px` }, 0);
tl.set(twin, { ...rect(at.verdict), opacity: 0 }, 0);
$$('#brief .line').slice(3).forEach((line, i) => tl.fromTo(line, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.45, ease: 'power1.out' }, 0.3 + i * 0.5));
tl.fromTo('#brief .doc', { scale: 1 }, { scale: pushed(PUSH_END), duration: PUSH_END, ease: 'none' }, 0);
tl.fromTo(frame, { scale: pushed(1.45) }, { scale: pushed(PUSH_END), duration: PUSH_END - 1.45, ease: 'none', immediateRender: false }, 1.45);
tl.to(frame, { opacity: 1, backgroundColor: 'rgba(255, 90, 43, .12)', duration: 0.35, ease: 'power2.out' }, 1.45);
tl.to('#brief .doc', { x: -40, opacity: 0, duration: 0.3, ease: 'power2.in' }, 5.6);
tl.to(frame, { ...rect(at.cell1), scale: 1, backgroundColor: 'rgba(255, 90, 43, 0)', duration: 0.7, ease: 'power3.inOut' }, 5.85);

// ---- 2 · Plan: select a shot, fill its intent, check the plan ----
tl.fromTo('.cell', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, 5.95);
tl.fromTo('.detail', { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: 'power3.out' }, 6.2);
$$('.v-1').forEach((v, i) => tl.fromTo(v, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.42, ease: 'power1.out' }, 7.0 + i * 0.5));
fly(at.cell3, 8.55, 0.5);
tl.to('.sel-1, .v-1', { opacity: 0, duration: 0.2 }, 8.95);
tl.fromTo('.sel-3', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 9.0);
$$('.v-3').forEach((v, i) => tl.fromTo(v, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' }, 9.1 + i * 0.18));
tl.fromTo('.plan-term', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 9.85);
tl.fromTo('.plan-term .cmd', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.55, ease: 'steps(17)' }, 10.3);
tl.fromTo('.plan-term .result', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2.2)' }, 11.0);
// Push into the selected cell: the board scales about it as the frame opens into the preview.
tl.set('.board', { transformOrigin: `${at.cell3Center.x - at.board.x}px ${at.cell3Center.y - at.board.y}px` }, 0);
tl.to('.board', { scale: 1.12, opacity: 0, duration: 0.4, ease: 'power2.in' }, 11.65);
tl.to('.detail, .plan-term', { x: 30, opacity: 0, duration: 0.35, ease: 'power2.in' }, 11.65);
fly(at.preview, 11.75, 0.7);

// ---- 3 · Build: each highlighted line moves something in the preview ----
tl.fromTo('.editor', { x: -36, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 12.12);
tl.fromTo('.preview', { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'none' }, 12.25);
const highlight = (line, from, to) => {
  tl.fromTo(line, { '--hl': 0 }, { '--hl': 1, duration: 0.18, ease: 'none', immediateRender: false }, from);
  tl.to(line, { '--hl': 0, duration: 0.25, ease: 'none' }, to);
};
highlight('.l1', 12.8, 13.35); highlight('.l2', 13.4, 14.55); highlight('.l3', 14.6, 15.75); highlight('.l4', 15.8, 16.85); highlight('.l5', 16.9, 17.7);
tl.fromTo('.p-title', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 13.6);
tl.fromTo('.p-bars i', { scaleY: 0 }, { scaleY: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(1.6)' }, 14.8);
const track = $('.p-track').getBoundingClientRect().width - $('.p-dot').getBoundingClientRect().width;
tl.fromTo('.p-dot', { x: 0 }, { x: track, duration: 1, ease: 'power3.inOut' }, 16.0);
tl.fromTo('.build-term .cmd', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'steps(27)' }, 17.05);
tl.fromTo('.build-term .result', { opacity: 0 }, { opacity: 1, duration: 0.25 }, 17.75);
// The draft replays the preview once, then a camera flash and a hard cut to the evidence.
tl.to('.p-dot', { x: 0, duration: 0.5, ease: 'power2.inOut' }, 17.85);
tl.to('.p-bars i', { scaleY: 0.3, duration: 0.25, stagger: 0.04, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 17.85);
tl.to('.p-title', { x: 24, duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 17.9);
tl.fromTo('#flash', { opacity: 0 }, { opacity: 1, duration: 0.07, ease: 'none', immediateRender: false }, 18.88);
tl.to('#flash', { opacity: 0, duration: 0.3, ease: 'power2.out' }, 19.0);
tl.set('.editor, .preview', { opacity: 0 }, 18.96);

// ---- 4 · Evidence: the draft's own frames, then its charts find a stall ----
tl.set([...thumbs, '#evidence .cap'], { opacity: 1 }, 18.96);
fly(at.thumb, 18.97, 0.45, 'power3.out');
tl.fromTo(stripFrames, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.045, ease: 'power2.out' }, 19.35);
tl.fromTo('.wave-chart', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 19.7);
tl.fromTo('.wave-chart .plot', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'power1.inOut' }, 19.95);
tl.fromTo('.activity-chart', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, 20.3);
tl.fromTo('.activity-chart .plot', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'power1.inOut' }, 20.55);
fly(at.frozen, 22.0, 0.6);
tl.fromTo(frozenNote, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, 22.55);
tl.fromTo(frozenBox, { opacity: 0.7 }, { opacity: 1, duration: 0.6, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, 22.7);
tl.to('#evidence .sheet, #evidence .strip, #evidence .chart', { opacity: 0, duration: 0.25, ease: 'power2.in' }, 25.2);

// ---- 5 · Second opinion: a critic's findings, verified in the next round ----
fly(at.row1, 25.45, 0.55);
tl.fromTo('.critique', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out' }, 25.36);
['.f1', '.f2', '.f3'].forEach((row, i) => tl.fromTo(row, { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 25.6 + i * 0.3));
tl.fromTo('.verdict', { scale: 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' }, 25.75);
tl.to('.r1', { opacity: 0, y: -8, duration: 0.25 }, 27.1);
tl.fromTo('.r2', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 27.2);
const cursor = $('.cursor'), p1 = statusPoint('f1'), p2 = statusPoint('f2'), p3 = statusPoint('f3');
tl.fromTo(cursor, { x: W + 40, y: p1.y + 80, opacity: 1 }, { x: p1.x, y: p1.y, opacity: 1, duration: 0.85, ease: 'power3.out' }, 27.25);
const counts = ['.n3', '.n2', '.n1', '.ship'];
[['f1', p1, 28.15, at.row1], ['f2', p2, 29.0, at.row2], ['f3', p3, 29.85, at.row3]].forEach(([row, point, time, target], i) => {
  if (i) { tl.to(cursor, { x: point.x, y: point.y, duration: 0.4, ease: 'power2.inOut' }, time - 0.45); fly(target, time - 0.45, 0.4, 'power2.inOut'); }
  tl.to(`.${row} .status.open`, { opacity: 0, duration: 0.12 }, time + 0.08);
  tl.fromTo(`.${row} .status.fixed`, { scale: 1.35, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2.4)' }, time + 0.1);
  tl.fromTo(cursor, { scale: 1 }, { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1, ease: 'power1.inOut', immediateRender: false }, time);
  swap(counts[i], counts[i + 1], time + 0.45, slot);
});
tl.to(cursor, { x: W + 40, opacity: 0, duration: 0.45, ease: 'power2.in' }, 30.3);
// The frame lets go of the last row and reappears on the verdict, so its edge never crosses text.
tl.to(frame, { opacity: 0, duration: 0.15, ease: 'none' }, 30.25);
tl.set(frame, { ...rect(at.verdict), scale: 1.06, transformOrigin: '50% 50%' }, 30.41);
tl.to(frame, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' }, 30.42);
tl.fromTo('.ship', { scale: 1 }, { scale: 1.05, duration: 0.45, yoyo: true, repeat: 1, ease: 'sine.inOut', immediateRender: false }, 30.95);
tl.to('.critique', { x: -30, opacity: 0, duration: 0.4, ease: 'power2.in' }, 31.55);
tl.to('.verdict', { opacity: 0, duration: 0.3, ease: 'none' }, 31.75);

// ---- 6 · Ship: the frame splits into the two formats, which fold into the command ----
tl.set(twin, { ...rect(at.verdict), opacity: 1 }, 31.72);
fly(at.land, 31.72, 0.7);
fly(at.vert, 31.78, 0.7, 'power3.inOut', twin);
tl.fromTo('.export', { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.06 }, 32.15);
tl.fromTo('.export p', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, stagger: 0.12, ease: 'steps(24)' }, 32.5);
tl.fromTo('.ex-screen img', { scale: 1.08 }, { scale: 1, duration: 1.1, ease: 'power2.out' }, 32.15);
tl.to('.export', { scale: 0.94, opacity: 0, duration: 0.25, ease: 'power2.in' }, 33.15);
fly(at.cmd, 33.2, 0.55);
fly(at.cmd, 33.24, 0.51, 'power3.inOut', twin);
tl.to(twin, { opacity: 0, duration: 0.2 }, 33.75);
tl.fromTo('.lock-cmd', { opacity: 0 }, { opacity: 1, duration: 0.35 }, 33.6);
tl.fromTo('.lock-mark', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 33.78);
tl.fromTo('.lock-word', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 33.88);
tl.fromTo('.lock-tag', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 34.05);
tl.fromTo('.footer', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 34.3);

window.__timelines = window.__timelines || {};
window.__timelines.loop = tl;
