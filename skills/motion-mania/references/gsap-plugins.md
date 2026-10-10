# GSAP plugins for seeked films

[GSAP 3.13 made the former bonus plugins freely available](https://gsap.com/docs/v3/Installation/). Motion Mania pins 3.15.0, whose npm package includes their browser builds under `gsap/dist/`. Free availability does not change the GSAP Standard License; see the repository's `THIRD_PARTY_NOTICES.md`. `init` copies only `gsap.min.js`, preserving its header.

## Vendor only what the film uses

From a toolkit checkout with dependencies installed, copy the tested plugins into an initialized project. This uses the same package resolution as `src/project.js`; change the project path for your film.

```sh
node --input-type=module <<'JS'
import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const project = '/tmp/motion-plugin-proof';
for (const name of ['SplitText', 'DrawSVGPlugin', 'MorphSVGPlugin', 'CustomEase']) {
  await copyFile(require.resolve(`gsap/dist/${name}.min.js`), `${project}/assets/vendor/${name}.min.js`);
}
JS
```

Record each copy's package version and license in `assets/manifest.json`, alongside the core library. Preserve original headers. In `src/index.html`, load core, then plugins, then the existing scene entry:

```html
<script src="assets/vendor/gsap.min.js"></script>
<script src="assets/vendor/SplitText.min.js"></script>
<script src="assets/vendor/DrawSVGPlugin.min.js"></script>
<script src="assets/vendor/MorphSVGPlugin.min.js"></script>
<script src="assets/vendor/CustomEase.min.js"></script>
<script src="scene.js"></script>
```

## Tested path

A four-second local composition with bundled Liberation Sans, SVG paths, and the following timeline passed HyperFrames 0.8.145 checks and Motion Mania's three forward/reverse seek comparisons in portrait and landscape. Both MP4s rendered. This establishes the sampled path on one machine, not arbitrary plugin settings or exhaustive determinism.

```js
gsap.registerPlugin(SplitText, DrawSVGPlugin, MorphSVGPlugin, CustomEase);
CustomEase.create('filmEntrance', '0.16,1,0.3,1');
const tl = gsap.timeline({ paused: true });
document.fonts.ready.then(() => {
  const split = SplitText.create('#title', { type: 'words,chars', autoSplit: false });
  tl.fromTo(split.chars, { y: 20, opacity: 0 }, {
    y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: 'filmEntrance'
  }, 0);
  tl.fromTo('#draw', { drawSVG: '0%' }, {
    drawSVG: '100%', duration: 2, ease: 'power2.inOut'
  }, 0);
  tl.to('#morph', {
    morphSVG: 'M 130 10 L 200 100 L 60 100 Z', duration: 2, ease: 'power2.inOut'
  }, 0);
  window.__timelines = window.__timelines || {};
  window.__timelines['motion-mania'] = tl;
});
```

Here `#title` is HTML text, `#draw` is an unfilled stroked SVG path, and `#morph` is a filled SVG path. SplitText replaces hand-built letter spans; DrawSVG can draw an underline or circle for emphasis; MorphSVG connects compatible visual ideas; CustomEase supplies the film's signature curve.

Split only after local fonts are ready. Never use `autoSplit` in a rendered film: font/resize events must not replace timeline targets while seeking. Keep the split nodes for the whole render; don't revert them in a completion callback. Register the populated timeline at the end of the callback. Registering an empty timeline before it caused a backend lint failure in this experiment.

This font-ready example had **no `captions.json`**. Motion Mania's current caption injection requires synchronous timeline registration. Do not combine that injection with this async example unchanged; use the synchronous authoring path (such as pre-authored spans) when captions require it.

## Candidates requiring their own verification

The package also contains `Flip.min.js`, `MotionPathPlugin.min.js`, `CustomWiggle.min.js`, `CustomBounce.min.js`, `ScrambleTextPlugin.min.js`, and `Physics2DPlugin.min.js` (the Physics2D plugin's actual filename). These were **not rendered or seek-tested here**; their presence is not approval to use them unchecked.

Flip can replace manual layout handovers; MotionPath can guide a cursor or persistent actor. Resolve fonts and asset dimensions, measure the starting and destination layouts before building the timeline, and build once per composition. Re-measuring or changing layout in seek callbacks risks different results by seek order. Add their animations to the paused timeline rather than starting independent playback.

CustomBounce and CustomWiggle are possible signature eases; they depend on CustomEase, so load/register it first. Avoid ScrambleText and random-driven options unless the same time produces identical output after every seek and in fresh sessions. The installed ScrambleText source calls `Math.random()` during rendering, and CustomWiggle's random mode uses it during curve creation. Physics2D needs the same review discipline; an accumulating simulation is unsuitable.

Run `motion-mania verify --project <dir> --format all --json` after plugin changes, then inspect adjacent frames and the encoded film. Add focused captures beyond the three verifier samples; neither a plugin's availability nor a passing sample proves the whole film.
