# Authoring contract

The installed toolkit pins HyperFrames 0.8.145. Its official references are [HyperFrames core](https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-core) and [CLI documentation](https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-cli). Upstream main may describe newer behavior; check the installed CLI's `--help` before relying on a new feature.

## Source and build

- `src/index.html` is the shared composition template. Keep `__WIDTH__`, `__HEIGHT__`, `__DURATION__`, and `__FPS__` on the root's corresponding `data-*` attributes. Motion Mania replaces them from `motion.json`.
- `src/scene.js` is the editable timeline entry. Keep its `<script src="scene.js"></script>` tag: the builder embeds that code so HyperFrames' static checker can see the timeline registration. Keep third-party libraries external and locally vendored.
- All other files under `src/` are copied into the prepared composition root, with `assets/` copied alongside them. References such as `assets/logo.svg` resolve there. Use local files, not symlinks.
- Use one paused GSAP timeline, registered as `window.__timelines['motion-mania']` or another key matching the root's `data-composition-id`.
- Declare timed `.clip` scenes with IDs, `data-start`, `data-duration`, and `data-track-index`. HyperFrames owns their visibility. Animate their child nodes with transforms and opacity.
- Register the timeline after its synchronous construction. Load local fonts via `@font-face`. Await asset readiness if your custom scene construction depends on loaded dimensions.

Plugin additions are optional; see [GSAP plugins](gsap-plugins.md) for local copies and a rendered SplitText/DrawSVG/MorphSVG/CustomEase example. Its font-ready callback registers only after construction and was tested without captions. The caption injection below still requires synchronous registration; pre-authored spans remain useful for that path.

## Timing and layout

The renderer seeks arbitrary times. Do not use wall-clock timers, unseeded randomness, accumulating simulation state, or infinite loops to determine rendered state. If noise is needed, derive it from stable inputs rather than a generator advanced differently on each seek.

The starter's CSS uses the shorter canvas dimension for typography and an orientation query for layout. Changing the output dimensions preserves aspect-aware layout; changing duration does not automatically retime authored scenes, audio, or storyboard entries. Revise those together.

Use transforms for animated movement, not `left`, `top`, or other properties that require layout. Make reference-led visual decisions; the demo's orange identity and editing rhythm are examples rather than universal requirements.

Audio needs a unique `id`, local `src`, and explicit timing. The starter's 120 BPM score is generated locally at initialization and mixes to about -14 LUFS. Replace it with appropriate supplied or authorized audio for other products. Adjust levels with `data-volume` or the source files, then measure the export with `motion-mania audio`; `audio --master` normalizes and limits the delivered MP4 while copying video. A mono file measures about 3 LU quieter than the same signal rendered to stereo. See [sound design and delivery](sound.md) for seeded cues, beat detection, mastering and listening limits.

Captions from `captions.json` are added at build time as `.mm-caption` clips on a free track, with tweens attached to the timeline registered under the root's `data-composition-id`. Register that timeline synchronously; captions fail the build if they cannot find it. Style them with the custom properties in [narration and captions](narration.md), not by editing the prepared copy.

Portrait and landscape must each be inspected. Check entrance and exit boundaries, actual phone-size readability, and the first and last frames. A planned loop needs explicit continuity work: mark it with `"loop": true` in `motion.json` and inspect the seam measurements from `picture` or `review --draft`. The starter is a finite film. Vertical phone previews include approximate platform safe-area guides and sampled text-box warnings; configure `safeArea` fractions in `motion.json` as described in [commands](commands.md). Keep important copy inside the guides and inspect entrances between samples.

## Static lint

Run `motion-mania lint --project ./videos/launch --format all --json` while authoring. It combines the pinned backend's findings with missing source checks, preserving backend codes and severity and grouping repeated sub-composition advice. Each finding names `file`, `line`, `rule`, `origin`, and why it matters; waived findings remain in `waived` with their reason. `plan` runs the fast lexical checks too, as questions/warnings, without preparing or rendering. `lint` fails on active errors; warnings do not fail it.

Rules include `non_deterministic_code` (Math.random, Date.now, performance.now, gsap.utils.random, and random(...) tween strings), `state_timer` (setTimeout/setInterval/requestAnimationFrame), `gsap_random_stagger`, `gsap_relative_value`, `gsap_function_value`, `gsap_infinite_repeat`, `gsap_non_transform_motion` (left/top/right/bottom/width/height/margin properties), `linear_spatial_ease`, `css_transition_used`, and `css_animation`. The backend supplies more specific findings such as `gsap_relative_value_second_writer`, `gsap_function_value_hazard`, and `requestanimationframe_in_composition`; equivalent local findings at that location are omitted. Tween property values such as `x: "+=20"` are distinct from valid timeline position parameters such as `"+=0.5"`. Initial layout set calls, opacity-only linear easing, seeded arithmetic, and explicitly paused CSS animations are allowed. A paused CSS animation still needs its time controlled for seeking.

Every static rule, including a backend code, accepts a local waiver on the finding's line or the immediately preceding line. Use the reported rule and a nonempty, specific reason:

```js
// motion-mania-ignore linear_spatial_ease: the playhead represents elapsed time
tl.fromTo('.playhead', { x: 0 }, { x: trackWidth, duration: 2, ease: 'none' }, 4.3);
```

CSS uses `/* motion-mania-ignore css_animation: the seek controller sets currentTime */`; HTML uses `<!-- motion-mania-ignore copy_provenance: this is the measured result from draft 2 -->`. Waivers apply to Motion Mania's `plan`/`lint` reporting. HyperFrames `check` and strict rendering enforce their own contracts and do not recognize these comments; a waived backend error can still fail `verify` or `render`. Fix genuine hazards. Document legitimate linear progress/pushes, pure function values, intentional geometry changes, and readiness-only timers instead of silencing them without evidence.

The dependency-free scan covers authored JS/HTML/CSS under `src/`, not vendored assets. It recognizes ordinary GSAP calls and simple vars objects; it cannot reliably resolve helper/spread-generated properties, aliases, computed keys, complex templates, regex literals, or arbitrary dataflow. CSS checks recognize declarations and an explicit paused play state in the same rule; they cannot prove a custom animation controller is correct. Seeded generators must use stable inputs rather than accumulate differently on each seek. Static success does not establish frame stability; run `verify` and inspect rendered evidence.
