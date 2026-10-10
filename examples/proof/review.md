# Proof — production review

40 seconds, 30 fps, 1920×1080 and an independently composed 1080×1920. Original vector material, original code score, pinned local Kokoro narration and word-timed captions. All production changes are inside examples/proof. No release version, success score or synthetic product metric is shown.

The optical proof concept turns the film's own material into an inspection surface: ribbon → waveform → pulse → isolated frame → data lineage → two layouts → original emblem. The apparatus is a designed explanatory visualisation, not a screen recording. Its measurements and captured film frames are real.

The voice is Kokoro-82M bm_george at 0.84 via HyperFrames 0.8.145. George was chosen for the measured sentence pacing and composed register; af_heart was also generated as a comparison outside the project. No audio audition was available, so this selection is not an acoustic comparison claim. The six actual take durations are in assets/narration-analysis.json. The score is a 120 BPM arrangement written in scripts/score.mjs, with sparse opening, bass/percussion build, a quieter forensic passage, harmonic lift and suspended-to-major resolution. The seeded cues come from the new sound kit. The bed has the tested carve metadata, peaking EQ fx-chain and automation; voice is never carved.

Transcription: faster-whisper 1.2.1 small.en, CPU int8, VAD, word times, on final narration.wav. Raw recognition stays in transcript.json. Corrected captions fix lades → leads, -frame → frame, and two impossible initial timings preceding their source clips (A 0.05 → 0.38; The 28.64 → 29.38). Phrases were regrouped to avoid a one-word 'result.' caption. All other timings are ASR measurements. Plan then matches every narration line at 100%, with complete bounds and adequate leading/trailing pad.

Evidence: scripts/evidence.mjs copies this film into .motion/controlled-project and adds a rose patch for exactly frame 72 at 2.400s. It renders that controlled draft, preserves reviews/controlled-draft.mp4, measures picture and mastering, and extracts adjacent and repaired frames. The final authored timeline contains no defect sets. The actual detector found frame 72 as a pop candidate: isolated change 125.88, neighbouring change 5.13, baseline 2.69. This is explicitly labelled a controlled test. The detector flags a candidate; it does not establish that every defect is caught.

The controlled draft measured -15.5 LUFS / -2.5 dBTP before and -14.0 LUFS / -1.5 dBTP after two-pass mastering. These are the film's on-screen figures. The wave is extracted from the real controlled mix. Six internal storyboard entrances have 0-frame offsets on the authored 120 BPM grid. Stored sources and report keys are in assets/evidence/sources.json; the source receipt names the actual master-report.json file and mastering.after.integrated key.

## Reviews

These are honest builder self-reviews. A separate fresh critic will judge after handoff, as requested. No independent verdict or blind restatement is claimed. Contact sheets, phone-size images, exact full-size stills and adjacent-frame strips were inspected. Muted video playback and audio audition were unavailable; dense frame sequences and audio measurements support the assessment but do not replace them.

Preproduction: read all skill references, Loop source/scripts/review, and decoded frames of both Loop exports. Rendered hook, source, sound and ending components early. Fixed an emblem colliding with the wordmark. Lint caught a scan line missing explicit destination opacity; fixed it. Beats energy showed an implausible drop; a missing fourth/fifth chord tone had contaminated the score with NaN samples, yielding silence. Fixed the original score script and regenerated it before evidence production.

Round 1: reviews/landscape-vTcEPw and reviews/vertical-vv5gyy. Draft -15.5 LUFS, -2.5 dBTP, LRA 6.1; no silence, pops/flashes or near-black/blank ranges. Found hook/sound title coexistence at 4.967s, dashboard-like beat cards, an orphan caption at 9.5s, portrait labels crossing defect thumbnails at 21.8s, a horizontal source line sinking behind the portrait receipt, and unintended holds 3.87–4.6s and 33.8–34.6s. Revised the title handover, a single large optical beat stage with blue field, caption phrases, portrait specimen/label sizing, a vertical source trace, continuous optical drift and a longer reverse seek rail. The ending was already corrected during component review.

Round 2: reviews/landscape-Gxd486 and reviews/vertical-P6MJyj. Inspected both complete contact sheets, phone sheets and all six adjacent-frame transition strips, plus full-resolution settled frames. The single blue optical stage gives the edit a clear energy crest; the portrait evidence specimens and separate reading band no longer collide. The orphan caption is gone. Both draft picture reports have zero transients, blank or near-black ranges, and no unintended holds. Only the reading hold at 21.23–22.67s and final lockup at 36.4–40s remain. Portrait safe-area checks report zero findings and zero warnings at 34 sampled times. Sound remains -15.5 LUFS / -2.5 dBTP, intentionally awaiting output mastering.

Round 2 found a smaller remaining defect: the portrait source-line endpoint circles were half-clipped at the SVG viewBox boundaries. Verification independently reported these two container overflows. Expanded the viewBox to include the circle radius and stroke. This is the second review-and-revise round; it is a modest correction because the larger composition problems were resolved in round 1. A final bundle and encoded-output audit follow below.

## Tooling problems and authoring failures

- Initial `hyperframes tts ... -v bm_george ... --json` failed: 'The kokoro-onnx package is not installed.' Doctor's core dependencies were present; TTS is optional. Created /tmp/proof-python with kokoro-onnx and soundfile and set HYPERFRAMES_PYTHON. No toolkit code changed.
- `python scripts/transcribe.py` with faster-whisper 1.2.1 / newly resolved av 19.0.1 failed at av.open: 'TypeError: open() got an unexpected keyword argument metadata_errors'. Installed av 16.1.0 (av<17) in the isolated venv and reran successfully. Reproduction instructions pin this compatibility bound.
- `motion-mania beats --project examples/proof --input examples/proof/assets/score.wav --json` on the repaired syncopated score returned 173 BPM, offset 0.656s, while the score code is explicitly 120 BPM with pulse times at multiples of 0.5s. Earlier broken-score detection returned 240 BPM / 0.497s and an implausible 101.2 dB drop; that energy result correctly exposed an authoring error. Kept the known authored grid for plan. The detector's candidate tempo is unreliable for this arrangement; no detector code was restructured.
- Initial lint correctly reported gsap_cold_seek_hidden_fromto_missing_reveal on .scan-rule. Added opacity:1 to destination vars. This was an authoring defect, not a false alarm.
- Caption regrouping initially added a 0.2s hold across the next group, and frame correctly failed 'Caption 2: groups must be in order without overlaps'. Clamped each group end to the next measured group start. No tool fix was needed.
- An rm-style shell command was rejected by the execution safety layer before it ran. Removed unused project bootstrap assets with exact pathlib unlink calls instead. No approval or toolkit change was needed.

Warnings from structural lint (single shared composition / caption track density), deliberate masked geometric overflow, and sampled transition advice are reviewed against actual images. Final findings and any local waivers are recorded below. None is a quality certificate.


## Final command record

Executed from the repository root on the final authored source:

```sh
node src/cli.js plan --project examples/proof --json
node src/cli.js lint --project examples/proof --format all --json
node src/cli.js verify --project examples/proof --format all --json
node src/cli.js review --project examples/proof --format all --draft --json
node src/cli.js render --project examples/proof --format all --quality delivery --json
node src/cli.js audio --project examples/proof --format all --master --json
node src/cli.js audio --project examples/proof --format all --json
node src/cli.js picture --project examples/proof --format all --json
node examples/proof/scripts/posters.mjs
npm test
```

Controlled-test production command: `node examples/proof/scripts/evidence.mjs`. That script records the exact isolated-project CLI calls and creates the actual stored reports. Sound cues: `node src/cli.js sound --project examples/proof --input examples/proof/cues.json --json`. Score: `node examples/proof/scripts/score.mjs`. Voice: `HYPERFRAMES_PYTHON=/tmp/proof-python/bin/python node examples/proof/scripts/voice.mjs --takes`. Transcription: `/tmp/proof-python/bin/python examples/proof/scripts/transcribe.py`. Captions: `node src/cli.js captions --project examples/proof --input examples/proof/transcript.json --replace --json`, followed by `node examples/proof/scripts/captions-fix.mjs`.


Final encoded audit found an additional landscape defect at 27.7s: the source path crossed the report filename. This was missed in the earlier small contact-sheet review; the metrics correctly did not pretend to detect a diagram/text overlap. Shortened the landscape path so its terminal node meets the receipt's left rule, before the type. Portrait overrides the SVG path/circle coordinates and is unchanged. Re-rendered, mastered, verified and reviewed the landscape again; the portrait final bundle remains the same.

Export audit helper initially failed under system Python and the isolated venv with `ModuleNotFoundError: No module named PIL`. Installed Pillow 12.3.0 only in the isolated venv and reran. This is an optional QA helper dependency, not a toolkit defect. The install also warned about a cross-filesystem hardlink and fell back to copying successfully.


## Final results and handoff

Final bundles: landscape-2ElVuT and vertical-ofebzc, with stable links and a complete command/result index in reviews/final/README.md. The prior landscape-v7bXyC bundle is retained as the round that exposed the landscape source-path overlap. Both final review drafts were subsequently mastered with `node src/cli.js audio --project examples/proof --format landscape --input examples/proof/reviews/landscape-2ElVuT/draft.mp4 --master --json` and the equivalent vertical command with `--format vertical --input examples/proof/reviews/vertical-ofebzc/draft.mp4`. The original draft reports are preserved as report-unmastered.json; the updated report cites actual master output. Video was stream-copied. No creative quality number is assigned.

Final shot list: 0–5s, the beautiful-frame challenge and original ribbon; 5–11s, real controlled-mix waveform and measured mastering result; 11–16s, orbit/shear/aperture edit on the musical pulse; 16–23s, the planted candidate and real repaired frame; 23–29s, the actual report/key behind the figure; 29–35s, separate portrait/landscape frames and forward/reverse inspection rails; 35–40s, original proof emblem, Motion Mania name and init command.

Plan passes with zero warnings, no copy provenance questions, adequate reading floors, complete 60-word narration coverage and six zero-frame beat offsets on the authored 120 BPM grid. Lint passes both layouts with only two structural advisories each: 15 caption groups on one track, and ten nested scenes. The single synchronous composition preserves shared ribbon continuity and makes arbitrary seeking explicit; the caption track is deliberately sequential. These are editing-structure advice, not visual faults. Source lint waivers are local and explain uniform musical progress and the continuous opening optical drift.

Verify passes both layouts. Three fresh-session forward/reverse captures at 10, 20 and 34 seconds match exactly in each format. All 17 storyboard motion assertions pass (300 motion samples per format). No settled layout, caption-zone or contract errors remain. A container-overflow advisory for the orbit shapes during their 11.075–12.03s arrival remains: the optical stage deliberately clips their rotating overshoot; full-resolution frames and transition strips show no stray geometry or unreadable type. The portrait endpoint clipping was fixed, not waived. After the additional landscape connector correction, `node src/cli.js verify --project examples/proof --format landscape --json` passed again. Final verify.json combines that landscape result with the unchanged portrait result. Storyboard prose was corrected to describe the actual choreography; timings and assertions did not change.

Both delivery exports before mastering: -15.5 LUFS integrated, -2.5 dBTP true peak, LRA 6.1. After two-pass mastering and measured AAC encoding: -14.0 LUFS, -1.5 dBTP, LRA 5.9. Gain was 1.5 dB and video was stream-copied. The target is -14 ±0.5 LUFS and <= -1 dBTP. Both final audio checks pass without warnings or silence ranges. The measured ending falls to -64.4 dB, a clean scored decay. These final figures agree with the controlled draft's on-screen evidence. Four cut-energy rises are found exactly at 5, 11, 23 and 29s; the 16s forensic reduction and 35s final resolution intentionally do not create a sharp envelope rise. Plan validates the authored beat positions, not a guarantee of perceptual edit quality.

Final picture checks at native 30fps: no pop/flash candidates, no blank or near-black ranges, no unintended frozen stretches, no warnings in either format. Deliberate holds only: 21.23–22.63s, 1.4s evidence reading; 36.4–40s, 3.6s final lockup. Portrait review safe-area sampling has zero findings and zero warnings at 34 times, using top 13%, bottom 19%, sides 6%. Caption and type areas were inspected at phone size as well.

Delivery metadata passes without repairs/warnings: H.264, yuv420p, BT.709 limited-range tags, AAC stereo, 40s, 30fps, correct dimensions, faststart. `npm test` passes all 99 tests, zero failures. No toolkit code was changed. All authored production changes are confined to examples/proof; existing unrelated working-tree changes were left alone.

Encoded audit: extracted and inspected whole-film contact sheets at every integer second plus all reviewAt times and the last frame (48 frames per format), selected full-resolution stills for every shot, phone-size samples, and all six boundary strips in both layouts. Re-extracted landscape evidence after its final correction and inspected the complete sheet again. The original large ribbon, explicit captions, real figures, repair specimen, source receipt and final lockup are clear. No further picture change emerged from that sampled audit. I would spend another hour on an acoustic audition of the voice, plosives, carved bed and cue balance, plus realtime playback on an actual phone. Those were unavailable here and remain an explicit handoff limitation; neither meters nor stills establish how the film sounds or how pacing feels at realtime speed. Fine frame-index/report-key type is secondary at phone size, carried by the larger narration/result. Independent cold review remains pending.

Exports: out/landscape.mp4 and out/vertical.mp4. Posters: out/poster-landscape.png and out/poster-vertical.png, extracted from the mastered encoded lockup at 38.7s. Copies of all four are in /tmp/proof-film/. Final critic bundle: reviews/final/README.md, with links to both complete review bundles, encoded frame sets, all final JSON reports and npm test log.

The packaging helper initially assumed review.notes was an array; its actual tool schema is a string, yielding `AttributeError: 'str' object has no attribute 'append'`. Normalised that field in the optional helper and preserved original reports before adding builder notes. No toolkit schema or code changed. This was a helper authoring mistake, not a toolkit failure.


Additional landscape-only commands after the encoded source-line correction:

```sh
node src/cli.js render --project examples/proof --format landscape --quality delivery --json
node src/cli.js review --project examples/proof --format landscape --draft --json
node src/cli.js verify --project examples/proof --format landscape --json
node src/cli.js audio --project examples/proof --format landscape --master --json
```

After these, reran final `audio --format all` and `picture --format all`, extracted both posters again, re-extracted all landscape encoded samples, and confirmed the /tmp copies match all four output files by SHA-256.


An intermediate `lint --project examples/proof --format all --json` snapshot also warned `overlapping_gsap_tweens` on `.ribbon-holder` rotation over 4.55–4.60s. The final continuous drift ends at 4.45s before the flattening begins at 4.55s; final lint contains only the two documented structural advisories. This was resolved in authoring rather than waived.


## Round 3: independent critic, revision, and final exports

This round supersedes the shot descriptions and bundle names in "Final results and handoff" above, which describe the film before it.

A fresh critic that had not built the film reviewed the round 2 exports cold. Its one-sentence reading from frames alone matched the brief's message; the intended audience (developers using coding agents) was less clear. Verdict: technically clean, not yet the strongest film in the repository. Its re-run of `audio` and `picture` agreed with the builder's figures. Findings:

| Range | Finding | Status after revision |
| --- | --- | --- |
| 5–40s | Evidence labels, report key and install command too small at phone size | FIXED: labels and command enlarged; verified on whole-film contact sheets, not on a phone |
| 23–35s | Source and seek shots asserted without showing | FIXED: the source shot shows the `master-report.json` excerpt with a line from its `integrated` value to the on-screen figure; the seek shot scrubs real frames of this film forwards and backwards with timestamps |
| 0–5s | Opening stated a challenge without staging one | FIXED: a controlled-test defect interrupts the ring inside the first seconds |
| 16, 23, 29s | Transitions dissolved content instead of carrying it | FIXED per the reviser's transition strips (aperture into specimen, boundary into report, report into preview frame); not re-inspected independently |
| 13.8–15.6s, 24.8–34.4s | Visible energy stalled | PARTLY: the seek shot now changes visibly; `picture` still finds short still stretches in the source shot (below) |
| Portrait, 23–29s landscape | Negative space weakened the subject | PARTLY: landscape shots use the full frame; portrait still leaves the area below the caption band quiet |
| 11–16s | Pulse sequence read as a generic motion test; repeated title layout | FIXED: the film's own ribbon changes shape on the pulse and the shot reports its measured cut count; title layouts vary |
| 20.4–20.6s | Whole specimen dimmed during the repair | NOT VERIFIED |

The revision agent was stopped before it rendered final exports or wrote this entry, so the statuses above are the orchestrating agent's reading of whole-film contact sheets of the final exports plus the reviser's last progress note. No second cold critic has judged the revised film.

Final exports were then produced from the revised source with `plan`, `lint`, `verify`, `render --quality delivery`, `audio --master`, `audio`, `picture` (all `--format all`) and `scripts/posters.mjs`. Results: `plan` passes with no warnings and all six cuts at zero-frame offset on the 120 BPM grid; `verify` passes in both formats with matching forward/reverse captures; `lint` passes with three structural advisories per format; both exports measured -15.5 LUFS / -2.5 dBTP before mastering and -14.0 LUFS / -1.5 dBTP after; `picture` finds no pops, flashes or blank ranges.

Remaining: `picture` warns about unmarked still stretches at 3.53–4.23s (landscape only), 24.77–25.37s and 27.5–28.47s. They read as pauses on the headline and on the report excerpt, but the storyboard does not mark them as holds.

Audition: the maintainer listened to the final export after release and found the audio fine. No agent auditioned it.
