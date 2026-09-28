# Authoring contract

The installed toolkit pins HyperFrames 0.8.81. Its official references are [HyperFrames core](https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-core) and [CLI documentation](https://github.com/heygen-com/hyperframes/tree/main/skills/hyperframes-cli). Upstream main may describe newer behavior; check the installed CLI's `--help` before relying on a new feature.

## Source and build

- `src/index.html` is the shared composition template. Keep `__WIDTH__`, `__HEIGHT__`, `__DURATION__`, and `__FPS__` on the root's corresponding `data-*` attributes. Motion Mania replaces them from `motion.json`.
- `src/scene.js` is the editable timeline entry. Keep its `<script src="scene.js"></script>` tag: the builder embeds that code so HyperFrames' static checker can see the timeline registration. Keep third-party libraries external and locally vendored.
- All other files under `src/` are copied into the prepared composition root, with `assets/` copied alongside them. References such as `assets/logo.svg` resolve there. Use local files, not symlinks.
- Use one paused GSAP timeline, registered as `window.__timelines['motion-mania']` or another key matching the root's `data-composition-id`.
- Declare timed `.clip` scenes with IDs, `data-start`, `data-duration`, and `data-track-index`. HyperFrames owns their visibility. Animate their child nodes with transforms and opacity.
- Register the timeline after its synchronous construction. Load local fonts via `@font-face`. Await asset readiness if your custom scene construction depends on loaded dimensions.

## Timing and layout

The renderer seeks arbitrary times. Do not use wall-clock timers, unseeded randomness, accumulating simulation state, or infinite loops to determine rendered state. If noise is needed, derive it from stable inputs rather than a generator advanced differently on each seek.

The starter's CSS uses the shorter canvas dimension for typography and an orientation query for layout. Changing the output dimensions preserves aspect-aware layout; changing duration does not automatically retime authored scenes, audio, or storyboard entries. Revise those together.

Use transforms for animated movement, not `left`, `top`, or other properties that require layout. Make reference-led visual decisions; the demo's orange identity and editing rhythm are examples rather than universal requirements.

Audio needs a unique `id`, local `src`, and explicit timing. The starter's 120 BPM score is generated locally at initialization. Replace it with appropriate supplied or authorized audio for other products. Beat detection and loudness mastering are not built into this first release.

Portrait and landscape must each be inspected. Check entrance and exit boundaries, actual phone-size readability, and the first and last frames. A planned loop needs explicit continuity work; the starter is a finite film, not a seamless loop.
