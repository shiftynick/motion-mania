# Planted review defects

This is a deliberately flawed, silent six-second film based on the starter. It is a review/check fixture, not a production example. It builds and renders at 30 fps in 720×1280 and 1280×720. The bundled font and locally copied GSAP retain their notices; original shapes and copy are repository materials.

From the toolkit checkout:

```sh
node src/cli.js plan --project test/fixtures/flawed --json
node src/cli.js lint --project test/fixtures/flawed --format all --json
node src/cli.js verify --project test/fixtures/flawed --format all --json
node src/cli.js render --project test/fixtures/flawed --format all --quality draft --json
node src/cli.js picture --project test/fixtures/flawed --format all --json
node src/cli.js review --project test/fixtures/flawed --format all --around 0.033333,1.4,2,2.4,4.233333,4.5 --draft --json
node src/cli.js frame --project test/fixtures/flawed --format all --at 0 --json
node src/cli.js frame --project test/fixtures/flawed --format all --at 5.2 --json
```

Open the paths returned by the commands. `review` supplies adjacent-frame strips; `frame` at 5.2s shows the last three copy defects. `plan` can surface unsupported figures and insufficient reading time, but a successful render is expected. Checks may warn or fail: the fixture is intentionally unsuitable for delivery.

For a critic trial, show a fresh agent only the contact sheet first and save its one-sentence message/audience restatement. Then supply the review bundle, brief, and storyboard, ask for timestamped findings, and request muted viewing. Keep this README, `defects.json`, and source out of its context until it finishes. Compare findings with the answer key; don't claim recall from one trial or count stylistic disagreements as planted defects. Figures require source review, version stamps require release evidence, and beat alignment requires the declared grid; pixels alone cannot establish those facts.

## Answer key

`defects.json` is the machine-readable list with IDs, intervals, focus formats, and frame times. Times are seconds; the 4.233333s cut is frame 127, rounded to six decimals.

| Defect | Time | Evidence |
| --- | --- | --- |
| Immediate-render pop | Frame 0; disappears by 0.033333s | A future `fromTo` paints READY early, before its intended 1s entrance |
| Linear spatial move | 1–1.8s | The box travels at constant speed with `ease: 'none'` |
| Dead gap at a cut | 2–2.4s | All outgoing content is gone; incoming content is invisible for twelve frames |
| Insufficient copy hold | 4.233333–4.5s | Sixteen words appear for eight frames, about 0.267s |
| Portrait safe-area violation | 4.5–6s; inspect 5.2s | The CTA sits 2% from the bottom; the brief reserves the bottom 20% |
| Unsourced figure | 4.5–6s; inspect 5.2s | “97% fewer mistakes” has no source |
| Invented version stamp | 4.5–6s; inspect 5.2s | “Motion Mania v9.9.9” is invented |
| Off-full-beat cut | 4.233333s | At 120 BPM with zero offset, the nearest full beat is 4s; the cut is also within one frame of the accepted 4.25s quarter-beat |

The local frame/strip inspection confirmed the visible events in both layouts; the safe-area defect is specific to portrait. The unsupported claims and beat timing were compared with the brief/storyboard. An earlier run reported a blank encoded portrait frame 1, recorded separately under `renderObservations`. Integration re-rendering with HyperFrames 0.8.145 did not reproduce it: frames 0–4 in both snapshots and encodes retain the hook, and READY disappears after frame 0 as planted. Fresh starter and Loop encodes also retain their picture on frame 1 in both formats. No cause for the earlier transient artifact was established. No fresh critic trial or audio/playback assessment is recorded here. Outputs and review bundles are ignored and regenerated on demand.

Automated coverage is seven of eight planted cases: `plan` exposes reading time, unsourced metric, invented version and static linear-move advice; `lint` repeats the linear-move warning; `picture` and `review --draft` locate the frame-zero pop and bright 2–2.4s gap; vertical `review` locates the unsafe CTA. `verify` passes the authored fixture because these are advisory quality defects, not settled layout, assertion, seek or runtime failures. The regression then introduces a genuine settled heading overflow and requires verification to fail.

The full-beat timing case remains for a human or critic: the declared grid accepts full, half and quarter beats within one frame, so frame 127 is valid under that contract. A checker cannot establish that a constant-speed move, flash, gap or alleged claim is artistically wrong; reviewers must inspect the evidence and sources. This directory is outside the npm `files` allowlist. One integration test asserts the intended findings without requiring the planted defects to be fixed.
