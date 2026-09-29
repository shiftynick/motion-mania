---
name: motion-mania
description: Create and revise short product films, launch reels, and motion graphics using Motion Mania and HyperFrames, with rendered visual reviews, audio measurement, optional narration and captions, and portable source files.
---

# Motion Mania

Use the installed `motion-mania` CLI for project setup, review artifacts, checks, and exports. HyperFrames is the renderer; the calling agent provides creative judgment. No separate model API is required.

Run `motion-mania --help` and `motion-mania doctor --json` before the first production in an environment. If the command is unavailable, prefix each command with `npx --yes motion-mania@0.1.0` in place of `motion-mania`, or use `node /path/to/motion-mania/src/cli.js` from a toolkit checkout. Run `motion-mania browser` if doctor reports a missing browser. A copied SKILL.md alone does not include the renderer or CLI dependencies.

## Establish the film

Read an existing project's brief, brand profile, storyboard, source, and most recent critique before editing. For a new film, gather the subject, audience, intended outcome, duration, formats, brand assets, references, and audio preference. Infer reasonable defaults when the task permits it; ask only for missing choices that materially affect the film.

Create a workspace with `motion-mania init ./videos/launch`. It contains a working Motion Mania demo: replace its copy, identity, storyboard, and soundtrack to fit the requested product. Preserve existing source and unrelated repository instructions.

Inspect actual product assets or authorized screenshots. Record origins in `assets/manifest.json`, including the model and prompt for generated media and the license and attribution for external media ([asset provenance](references/commands.md#asset-provenance)). Distinguish product recordings from designed explanatory diagrams. Study reference pacing and visual principles without copying its identity or content.

Read [creative direction and revision](references/creative-direction.md) when developing a concept or improving a film. Establish an observable product benefit, an organizing visual idea, and a reason for each shot before polishing animation.

If the film has a voiceover, write each shot's line in its storyboard `narration` field before animating, in the register the brief specifies. Read [narration and captions](references/narration.md) for script style, voice production, and captions.

Plan timestamped scenes in `storyboard.json` before expensive rendering. Run `motion-mania plan --project ./videos/launch --json` to catch stale timing and surface missing intent. See [storyboard fields](references/storyboard.md) for goals, focal points, transitions, sound, and exact review times. Use a brief and brand profile as durable context, rather than relying on a long chat. Respect any review gates the user asks for; an authorized end-to-end task can proceed through the production loop without repeated approval requests.

## Author and inspect

Read [the authoring contract](references/authoring.md) before editing animation source. Work in `src/` and `assets/`; `.motion/` contains disposable prepared copies. Start with a few representative frames before a full encode.

```sh
motion-mania frame --project ./videos/launch --at 4.2 --json
motion-mania review --project ./videos/launch --format vertical --draft --json
```

Review automatically includes storyboard keyframes, cut strips, and the longest caption lines; use `--around` to focus strips on chosen times. With `--draft`, it also measures the draft's audio and draws `waveform.png` with the shot boundaries. Open the actual output paths in the report. Inspect composition and phone-size readability from the contact sheets, and transitions from adjacent-frame strips. Play the draft when supported. A still image cannot establish smooth motion, and an audio stream check cannot establish good sound. Mark any unavailable form of inspection as outstanding.

Record timestamped findings and proposed changes in the generated `critique.md`. Fix the most consequential defects and make another review bundle. Stop when the requested standard is reached or the agreed iteration/time budget is exhausted; report remaining issues. Do not treat numerical self-scores as objective quality certification.

## Verify and deliver

For captions, transcribe the final voice take, import it with `motion-mania captions --input transcript.json`, correct `captions.json`, and review the caption frames before the final render.

```sh
motion-mania verify --project ./videos/launch --format all --json
motion-mania render --project ./videos/launch --format all --quality looks --json
motion-mania audio --project ./videos/launch --format all --json
motion-mania frame --project ./videos/launch --at 13.5 --json
```

Inspect technical reports and resolve errors. `audio` fails when loudness is off target (default -14 LUFS, -1 dBTP; set `loudness` in `motion.json` for another delivery) and reports silences, cut accents, and abrupt endings. `verify` samples three frames in forward and reverse order in fresh browser sessions; it is not exhaustive or a promise of identical rendering across machines. Backend warnings remain visible in its report. A passed technical gate is distinct from creative review.

Deliver the MP4s, chosen poster, review evidence, editable source location, and any known limitations. Use the explicit artifact paths returned by the CLI. See [commands and project conventions](references/commands.md) for preview preparation and the manifest contract.
