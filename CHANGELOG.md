# Changelog

## Unreleased

- `picture` command: finds frozen stretches (block-based frame difference, so slow pushes and small moving details count as motion) and near-black frames, with per-shot held time and an activity chart marked with shots. `review --draft` includes the same analysis.
- Storyboard `hold` field marks intended held frames so they are not flagged.
- Each `critique.md` links the most recent earlier review of the same format that recorded findings, and copies its prioritized revisions for FIXED / PARTLY / STILL PRESENT verification.
- `audio` warns when the loudness range is below 1.5 LU.
- The starter score has an arrangement that follows its storyboard (a sparse hook, a build, the full groove, and a resolving chord), giving it about 3 LU of loudness range instead of a flat loop.
- The launch-v2 and Lull example storyboards mark their intended reading holds.
- New example: The loop, a narrated film about Motion Mania built with every feature, including three rounds of fresh-critic review.
- New skill reference for independent review, with critic prompts. Creative direction adds transition mechanisms, common defects, sound-effect guidance, and loudness targets for calm films.

## 0.2.0

- `audio` command: EBU R128 integrated loudness and true peak against a target (default -14 LUFS, -1 dBTP; `loudness` in `motion.json`), plus silences, per-shot levels, energy rises near cuts, abrupt-ending detection, and a waveform image marked with shots. `review --draft` includes the same analysis.
- `captions` command: import whisper.cpp/OpenAI-style JSON, word arrays, SRT, or VTT through the pinned backend; builds add word-highlighted caption clips from `captions.json`.
- Storyboard `narration` field: pace, spoken-fragment, and unsourced-figure warnings, and a per-shot comparison of heard words with the script when captions exist.
- `plan` reports asset provenance gaps, including generator and license details for generated and external media.
- Starter score mixes to about -14 LUFS.
- New skill reference for narration and captions.
- Caption placement can no longer be overridden by project rules such as `#film > .clip { inset: 0 }`.
- New example: Lull, a narrated and captioned film for a fictional product.

## 0.1.0

First public release.

- Portable CLI for initialization, storyboard planning, frame capture, review bundles, technical verification, and MP4 export.
- HyperFrames 0.8.81 backend with GSAP timelines, local fonts, and original starter audio.
- Agent skill covering creative direction, authoring, and visual review; explicit skill installation command.
- Browser setup command and npx-compatible npm package.
- Automatic storyboard keyframes and transition strips, phone-size sheets, and shot-specific critique notes.
- Two Motion Mania production examples in the repository.
- Unit, cross-repository render, and packed-package smoke tests.
