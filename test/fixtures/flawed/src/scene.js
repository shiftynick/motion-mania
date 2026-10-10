const root = document.getElementById('film');
const W = Number(root.dataset.width), H = Number(root.dataset.height);
const tl = gsap.timeline({ paused: true });
// Deliberate bug: the future fromTo immediately paints READY at frame zero.
tl.fromTo('.future', { opacity: 1, y: 0 }, { opacity: 1, y: -20, duration: 0.3, ease: 'power2.out' }, 1);
// This hides it on the next frame, making the early paint a one-frame pop.
tl.set('.future', { opacity: 0 }, 0.02);
// Deliberate bug: a spatial move travels at a constant speed.
tl.fromTo('.box', { x: 0 }, { x: Math.min(W, H) * 0.48, duration: 0.8, ease: 'none' }, 1);
// Deliberate bug: clear everything, then leave the next shot empty for 0.4s.
// The outgoing clip ends at 2s; the incoming clip starts empty.
tl.fromTo('.incoming', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' }, 2.4);
// The copy clips and off-grid boundary are declared in index.html/storyboard.json.
window.__timelines = window.__timelines || {};
window.__timelines['motion-mania'] = tl;
