# Motion Mania demo review

The sample is an original 15-second explanation of the toolkit, with a shared scene timeline and separate portrait/landscape layouts. Its file cards are illustrative diagrams, not recordings of an editor.

## Deliverables

- `examples/launch/out/vertical.mp4`: 720×1280, 30 fps, 15 seconds, audio.
- `examples/launch/out/landscape.mp4`: 1280×720, 30 fps, 15 seconds, audio.
- `examples/launch/out/poster-vertical.png` and `poster-landscape.png`: 13.5s brand lockup.
- `examples/launch/out/contact-vertical.png` and `contact-landscape.png`: final contact sheets.

These generated artifacts are ignored by Git. Recreate the videos with `npm run demo:render` and the review evidence with `motion-mania review --project examples/launch --format all --around 3,6.5,10.5 --json`. Use `frame --at 13.5` for a new poster.

## Review and revisions

Contact sheets were inspected in both aspect ratios. Selected consecutive-frame strips were inspected around the review and delivery cuts. The Studio preview was opened and playback reached the end of the timeline.

| Observation | Revision |
| --- | --- |
| Initial frame lacked a strong readable hook | Keep the headline visible at time zero and animate position |
| Playhead used a layout property that could produce frame-capture stutter | Animate its transform instead |
| Short blank frames appeared at scene boundaries | Show incoming text/cards from the cut while their transforms settle |
| Secondary copy was small in portrait | Increase the file-description and review-label sizes in portrait CSS |
| Headline and wordmark underused the landscape canvas | Increase their landscape sizes |

The sequence is a functional starter film. It is not a seamless loop or a substitute for a product-specific concept and assets.

## Technical evidence

Both formats pass HyperFrames' browser checks with zero errors. Six advisory lint warnings remain: repeated logo assets, four timed scenes on one track, and suggestions to split the flat scene structure into sub-compositions. The visible repeated logos are intentional. Runtime, layout, and contrast checks run after lint and pass.

For each format, decoded RGBA pixels at 3.75s, 7.5s, and 12.75s match exactly between fresh forward-order and reverse-order capture sessions. This is a sampled, single-machine check, not a universal determinism guarantee.

Exports are probed before replacing the final paths. FFprobe verifies dimensions, frame rate, duration, and audio presence. The soundtrack is original code-generated audio. A level analysis of the landscape mix found mean volume -26.8 dB and maximum -11.8 dB; it is conservative in level and has not been loudness-mastered. Audio was not auditioned, so subjective sound quality and perceptual synchronization remain for listening review.

The automated cross-repo test initializes a disposable Git repo, captures frames, builds a review bundle and draft, verifies seek stability, exports an MP4, then deliberately breaks the fixture and confirms the previous good MP4 is retained. A separate packed-package installation also successfully initializes and captures a frame outside this checkout.

## Local installation

The CLI is linked through `npm link` in the active Node installation. The skill is linked at `~/.codex/skills/motion-mania` to this checkout's `skills/motion-mania` directory. Keep the checkout in place while using those links. A newly started agent session may be needed to discover the added skill.
