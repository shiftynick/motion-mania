# Reproduce Proof

From the repository root, with Node and FFmpeg installed:

1. `node examples/proof/scripts/plan.mjs` regenerates the final storyboard and its motion assertions.
2. Create a Python venv with `kokoro-onnx soundfile faster-whisper av<17`. Set `HYPERFRAMES_PYTHON` to its Python.
3. `HYPERFRAMES_PYTHON=/path/to/python node examples/proof/scripts/voice.mjs --takes` regenerates the six pinned local Kokoro takes and assembled voice. Without `--takes`, assembles existing takes.
4. `node examples/proof/scripts/score.mjs` regenerates the original 120 BPM stereo score and measured analysis.
5. `node src/cli.js sound --project examples/proof --input examples/proof/cues.json --json` regenerates the seeded effects.
6. `/path/to/python examples/proof/scripts/transcribe.py` transcribes the assembled final take. `node src/cli.js captions --project examples/proof --input examples/proof/transcript.json --replace --json`, then `node examples/proof/scripts/captions-fix.mjs` applies documented recognition corrections and phrase groupings.
7. `node examples/proof/scripts/evidence.mjs` makes an isolated controlled draft in `.motion/controlled-project`, plants a one-frame rose patch (frame 24) at 0.8s, renders, runs picture detection and mastering, and captures the actual evidence. It preserves `reviews/controlled-draft.mp4` and report snapshots in assets/evidence. This remeasures the current production: numbers may differ from the original run. `bootstrap.mjs` is only for pre-evidence development; do not run it on a delivery project unless immediately regenerating evidence.
8. `node examples/proof/scripts/manifest.mjs` refreshes provenance after generating assets.
9. Run `plan`, `lint --format all`, `verify --format all`, and `review --format all --draft`. Inspect the returned paths. Review is a human/agent judgment, never a numerical grade.
10. `node src/cli.js render --project examples/proof --format all --quality delivery --json`, then `audio --format all --master` and `picture --format all` on fresh exports.
11. `node examples/proof/scripts/posters.mjs` extracts both poster frames at 38.7s from the encoded exports.

The raw transcript is retained. Caption corrections preserve actual ASR times except two initial words which incorrectly precede their source clips. Sound carve uses all three attributes required by the pinned renderer; narration is not carved.

`out/`, `reviews/`, `.motion/` are ignored. Every asset outside these directories has provenance. Local font OFL licences and GSAP Standard Licence are vendored. No remote media is used.

Revision 3 adds `scripts/seek-atlas.mjs`: after rendering the revised montage in both formats, run it to preserve those draft MP4s in reviews/revision-3/seek-sources and capture exactly 46 paired states from 11.0–15.5s into 8×6 atlases. The timeline selects these same real cells in forward and reverse order, displaying their source time. Regenerate evidence after the last picture change, then regenerate the manifest. `scripts/components.mjs` is an authoring QA helper using the pinned Chrome, producing native captures and 390px sheets. Its clip visibility shim makes a direct file preview comparable to HyperFrames; final review and verification use the CLI itself. Narration, source take assembly, caption wording/timing and score were unchanged in revision 3.
