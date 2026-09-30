const root = document.getElementById('film');
const W = Number(root.dataset.width), H = Number(root.dataset.height), portrait = H > W;
document.documentElement.style.fontSize = `${Math.min(W, H) / 67.5}px`;

// Fixed-seed generator used only while building the scene, so every seek sees the same layout.
let seed = 11;
const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
// Same arrival curve as scripts/score.mjs, so each card lands on its ping.
const CARDS = 40, arrival = i => 0.1 + 5.3 * Math.sqrt(i / CARDS);
const CUT = 6;

// Icon colors are dark enough for white initials to pass WCAG AA.
const apps = [
  ['Stackline', '#2f5fe0', 'Build finished with 3 warnings'], ['Pingboard', '#d93a40', 'Priya reacted to your message'],
  ['Mailroom', '#0f7f58', 'Twelve ideas for your weekend'], ['Streakly', '#b25500', "Don't break your 48-day streak!"],
  ['Cartful', '#7c3aed', 'Your cart misses you'], ['Newsdrop', '#0069a8', 'Markets open higher this morning'],
  ['Gridly', '#b8237a', 'Sam edited “Q3 plan”'], ['Tallytime', '#0f6e67', 'Your screen time report is ready'],
  ['Mailroom', '#0f7f58', 'Flash sale ends in 2 hours'], ['Pingboard', '#d93a40', '@you in #launch-room'],
  ['Snapwise', '#8a5a00', 'Someone viewed your profile'], ['Stackline', '#2f5fe0', '3 new comments on PR #481'],
];

// Storm cards on a jittered grid, arriving in shuffled order; later arrivals stack on top.
const stage = document.querySelector('.stage');
const cols = portrait ? 4 : 7, rows = portrait ? 10 : 6, slots = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) slots.push({ x: (c + 0.5 + (rand() - 0.5) * 0.7) / cols * W, y: (r + 0.5 + (rand() - 0.5) * 0.7) / rows * H });
for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
const cards = Array.from({ length: CARDS }, (_, i) => {
  const [name, color, message] = apps[i % apps.length];
  const el = document.createElement('div');
  el.className = 'note';
  // A deliberate collage of overlapping, off-canvas cards: excluded from layout audits.
  el.setAttribute('data-layout-ignore', '');
  el.innerHTML = `<span class="app" style="--c:${color}">${name[0]}</span><div class="note-body"><div class="note-top"><b>${name}</b><small>now</small></div><p>${message}</p></div>${i % 3 === 2 ? `<span class="badge">${1 + Math.floor(rand() * 9)}</span>` : ''}`;
  const at = i === 0 ? { x: W / 2, y: H * 0.46 } : slots[i];
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  stage.appendChild(el);
  return { el, ...at, rotation: i === 0 ? 0 : (rand() - 0.5) * 18, scale: i === 0 ? 1.3 : 0.9 + rand() * 0.2, drift: (rand() - 0.5) * 0.12 };
});

// Measure the digest panel at its final layout before any tween moves it.
const panel = document.querySelector('.panel'), head = panel.querySelector('.panel-head');
const box = panel.getBoundingClientRect(), headHeight = head.offsetHeight, radius = parseFloat(getComputedStyle(panel).borderRadius);
const toCenter = { x: W / 2 - (box.left + box.width / 2), y: H / 2 - (box.top + headHeight / 2) };
const closed = `inset(0px 0px ${box.height - headHeight}px 0px round ${radius}px)`, open = `inset(0px 0px 0px 0px round ${radius}px)`;
const R = Math.hypot(W, H) / 2 + 40;
const wave = document.querySelector('.wave');
Object.assign(wave.style, { width: `${2 * R}px`, height: `${2 * R}px`, marginLeft: `${-R}px`, marginTop: `${-R}px` });

const tl = gsap.timeline({ paused: true });

// 1 · Storm: accelerating arrivals, camera pressure, a shake, and a red edge before the cut.
cards.forEach((card, i) => {
  tl.fromTo(card.el, { xPercent: -50, yPercent: -50, x: 0, y: 36, scale: card.scale * 0.45, rotation: card.rotation * 2.4, opacity: 0 },
    { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: card.scale, rotation: card.rotation, opacity: 1, duration: 0.32, ease: 'back.out(2.2)' }, arrival(i));
});
tl.fromTo(stage, { scale: 1 }, { scale: 1.1, duration: CUT - 0.05, ease: 'power1.in' }, 0);
tl.fromTo('.alarm', { opacity: 0 }, { opacity: 1, duration: 2, ease: 'power2.in' }, 3.95);
for (let k = 0; k < 24; k++) {
  const amount = (k + 1) / 24 * 14;
  tl.to(stage, { x: (k % 2 ? 1 : -1) * amount * (0.6 + 0.4 * ((k * 7) % 5) / 4), y: (k % 3 - 1) * amount * 0.6, duration: 0.05, ease: 'none' }, 4.75 + k * 0.05);
}
tl.to(stage, { x: 0, y: 0, scale: 1, duration: 0.6, ease: 'power2.out' }, CUT);

// 2 · The lull: a dark wave from the center pulls every card into one digest.
tl.fromTo('#calm', { clipPath: 'circle(0px at 50% 50%)' }, { clipPath: `circle(${R}px at 50% 50%)`, duration: 1.25, ease: 'power2.out' }, CUT);
tl.fromTo(wave, { scale: 0, opacity: 1 }, { scale: 1, opacity: 1, duration: 1.25, ease: 'power2.out' }, CUT);
tl.to(wave, { opacity: 0, duration: 0.45 }, CUT + 0.8);
const far = Math.hypot(W, H) / 2;
cards.forEach(card => {
  const start = CUT + 0.05 + Math.hypot(card.x - W / 2, card.y - H / 2) / far * 0.5;
  tl.to(card.el, { x: W / 2 - card.x, y: H / 2 - card.y, rotation: card.drift * 40, scale: 0.4, duration: 0.7, ease: 'power3.in' }, start);
  tl.to(card.el, { opacity: 0, duration: 0.1, ease: 'none' }, start + 0.62);
});
tl.fromTo(panel, { x: toCenter.x, y: toCenter.y, scale: 0.55, opacity: 0, clipPath: closed }, { x: toCenter.x, y: toCenter.y, scale: 1, opacity: 1, clipPath: closed, duration: 0.5, ease: 'back.out(1.7)' }, 6.95);
const held = document.querySelector('.held'), counter = { n: 0 };
tl.fromTo(counter, { n: 0 }, { n: CARDS, duration: 0.9, ease: 'power2.out', onUpdate: () => { held.textContent = `${Math.round(counter.n)} held`; } }, 6.95);
// The ring holds the gathered card during the lull, then tightens into the boundary for shot 4.
tl.set('.ring', { scale: 2, opacity: 0 }, 0);
tl.fromTo('.ring', { scale: 2, opacity: 0 }, { scale: 1.4, opacity: 0.55, duration: 1.4, ease: 'power3.out', immediateRender: false }, 6.9);
tl.fromTo('.ring', { scale: 1.4 }, { scale: 1.45, duration: 1.1, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, 8.3);
tl.fromTo(panel, { scale: 1 }, { scale: 1.05, duration: 5.4, ease: 'sine.inOut', immediateRender: false }, 7.45);
tl.fromTo('.blob-a', { x: -60, y: -30 }, { x: 90, y: 50, duration: 11, yoyo: true, repeat: 1, ease: 'sine.inOut' }, CUT);
tl.fromTo('.blob-b', { x: 50, y: 40 }, { x: -80, y: -40, duration: 11, yoyo: true, repeat: 1, ease: 'sine.inOut' }, CUT);
tl.fromTo('.h-held', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 7.6);
tl.to('.h-held', { y: -24, opacity: 0, duration: 0.45, ease: 'power2.in' }, 12.45);

// 3 · The digest opens, sorted: people who need a decision first.
tl.to(panel, { x: 0, y: 0, scale: 1, duration: 0.95, ease: 'power3.inOut' }, 12.95);
tl.to(panel, { clipPath: open, duration: 0.95, ease: 'power3.inOut' }, 13.15);
tl.to('.ring', { scale: 1.15, opacity: 0.15, duration: 0.8 }, 12.95);
tl.fromTo('.panel .section h3, .panel .item, .panel .pill', { x: 26, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, stagger: 0.14, ease: 'power3.out' }, 13.55);
tl.fromTo('.needs-glow', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut' }, 14.2);
tl.fromTo('.h-first', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 13.4);
tl.to('.h-first', { y: -24, opacity: 0, duration: 0.45, ease: 'power2.in' }, 17.7);
tl.to(panel, { y: 40, scale: 0.94, opacity: 0, duration: 0.55, ease: 'power2.in' }, 17.85);

// 4 · Break through: ordinary notifications dissolve at the ring; the chosen person passes.
const ringRadius = document.querySelector('.ring').offsetWidth / 2;
tl.to('.ring', { scale: 1, opacity: 0.9, duration: 0.6 }, 17.95);
tl.fromTo('.ring', { scale: 1 }, { scale: 1.03, duration: 1.1, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, 18.6);
tl.fromTo('.h-wait', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 18.25);
const ghosts = [['.g1', { x: -W * 0.62, y: -ringRadius * 0.2 }, { x: -ringRadius * 1.05, y: -ringRadius * 0.1 }, 18.25],
  ['.g2', { x: W * 0.62, y: ringRadius * 0.35 }, { x: ringRadius * 1.05, y: ringRadius * 0.25 }, 18.75],
  ['.g3', { x: -ringRadius * 0.2, y: H * 0.6 }, { x: -ringRadius * 0.1, y: ringRadius * 1.15 }, 19.15]];
for (const [selector, from, to, at] of ghosts) {
  tl.fromTo(selector, { xPercent: -50, yPercent: -50, ...from, opacity: 0.9, scale: 1 }, { xPercent: -50, yPercent: -50, ...to, opacity: 0.9, duration: 0.5, ease: 'power2.out' }, at);
  tl.to(selector, { opacity: 0, scale: 0.86, duration: 0.3, ease: 'power1.in' }, at + 0.45);
}
// The gold card takes the same path as the ghost from the right, but crosses the ring instead of stopping at it.
tl.fromTo('.gold-card', { xPercent: -50, yPercent: -50, x: W * 0.7, y: 0, opacity: 1 }, { xPercent: -50, yPercent: -50, x: 0, y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' }, 19.35);
tl.fromTo('.shock', { scale: 0.7, opacity: 0.95 }, { scale: 1.9, opacity: 0, duration: 1.1, ease: 'power2.out', immediateRender: false }, 20.0);
tl.to('.ring', { borderColor: 'rgba(255, 200, 97, .85)', duration: 0.25 }, 20.0);
tl.to('.ring', { borderColor: 'rgba(201, 194, 255, .75)', duration: 1.2 }, 21.2);
tl.fromTo('.through-label', { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }, 20.45);
tl.to('.h-wait, .through-label', { opacity: 0, duration: 0.45, ease: 'power2.in' }, 22.85);
tl.to('.gold-card', { opacity: 0, scale: 0.94, duration: 0.45, ease: 'power2.in' }, 22.9);

// 5 · Wordmark in silence.
tl.to('.ring', { scale: 0.62, opacity: 0.4, duration: 1.3, ease: 'power2.inOut' }, 23.2);
tl.fromTo('.word span', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out' }, 23.6);
tl.fromTo('.tagline', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, 24.35);
tl.fromTo('.footer', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 25.0);
tl.fromTo('.word', { scale: 1 }, { scale: 1.035, duration: 4.3, ease: 'sine.out' }, 23.6);

window.__timelines = window.__timelines || {};
window.__timelines.lull = tl;
