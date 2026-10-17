---
name: motion-mania
description: Create and revise short product films, launch reels, and motion graphics using Motion Mania and HyperFrames, with rendered visual reviews, audio measurement, optional narration and captions, and portable source files. Not for interactive web/UI animation, editing existing footage, or Remotion projects.
metadata:
  version: "0.5.0"
---

# Motion Mania

Use the installed `motion-mania` CLI for project setup, review artifacts, checks, and exports. HyperFrames is the renderer; the calling agent provides creative judgment. No separate model API is required.

Run `motion-mania --help` and `motion-mania doctor --json` before the first production in an environment. If the command is unavailable, prefix each command with `npx --yes motion-mania@0.5.0` in place of `motion-mania`, or use `node /path/to/motion-mania/src/cli.js` from a toolkit checkout. Run `motion-mania browser` if doctor reports a missing browser. A copied SKILL.md alone does not include the renderer or CLI dependencies.

## Establish the film

Read an existing project's brief, brand profile, storyboard, source, and most recent critique before editing. For a new film, gather the subject, audience, intended outcome, duration, formats, brand assets, references, and audio preference. Infer reasonable defaults when the task permits it; ask only for missing choices that materially affect the film.

Create a workspace with `motion-mania init ./videos/launch`. It contains a working Motion Mania demo: replace its copy, identity, storyboard, and soundtrack to fit the requested product. Preserve existing source and unrelated repository instructions.

Inspect actual product assets or authorized screenshots; `capture <url>` can collect brand candidates from an authorized site without replacing `brand.json`. Record origins in `assets/manifest.json`, including model/prompt and external license/attribution ([asset provenance](references/commands.md#asset-provenance)). Distinguish recordings from explanatory diagrams. Study reference pacing and visual principles without copying identity or content; `review --against ref.mp4` supplies paired frames and cut pacing, not a similarity verdict.

Use `media search "query" --type audio|image|video` and `media fetch <id> --project ./film` to gather licensed media with provenance; commercial use and modification are required by default, and video needs a free Pexels key saved with `motion-mania keys set pexels` (or `PEXELS_API_KEY` as an override). Include `media credits --project ./film` text in the film or description, describe edits, and check ShareAlike obligations; Freesound imports are MP3 previews ([media commands](references/commands.md#media-search-and-import)).

Read [creative direction and revision](references/creative-direction.md) when developing a concept or improving a film. Establish an observable product benefit, an organizing visual idea, and a reason for each shot before polishing animation. Use [motion starting values](references/motion-numbers.md) to fix a consistent ease, duration palette, and entrance pattern; review decides when to depart from them.

If the film has a voiceover, write each shot's line in its storyboard `narration` field before animating, in the register the brief specifies. Read [narration and captions](references/narration.md) for script style, voice production, and captions.

Plan timestamped scenes in `storyboard.json` before expensive rendering. Run `motion-mania plan --project ./videos/launch --json` for timing, reading floors, copy provenance, beat-grid and measured narration warnings. Choose settled `reviewAt` frames and add motion `assertions` for required appearances, ordering, containment or persistent motion; see [storyboard fields](references/storyboard.md) for their sampling limits. Preserve intent in the brief and brand profile. Respect user-requested review gates; an authorized end-to-end task can proceed without repeated approval requests.

## Author and inspect

Read [the authoring contract](references/authoring.md) before editing animation source; read [GSAP plugins](references/gsap-plugins.md) when using text splitting, SVG drawing/morphing, or custom eases. Work in `src/` and `assets/`; `.motion/` contains disposable prepared copies. Start with a few representative frames before a full encode.

Give sound a job. Use `sound --input cues.json` for seeded effects and `beats --input music.wav` for a candidate tempo/offset; confirm the grid by listening before setting storyboard `bpm`/`beatOffset`. Read [sound design and delivery](references/sound.md) for cue peaks, carved ducking and mastering. Run `lint` while authoring; fix errors and explain intentional risks with local waivers. Use `variants` to compare declared composition variables when exploring alternatives ([commands](references/commands.md)).

```sh
motion-mania lint --project ./videos/launch --format all --json
motion-mania frame --project ./videos/launch --at 4.2 --json
motion-mania review --project ./videos/launch --format all --draft --json
```

Review includes storyboard keyframes, cut strips and long caption lines; `--around` focuses the strips. Portrait previews show approximate safe-area guides and grouped text collisions. With `--draft`, inspect `waveform.png`, `activity.png`, holds, near-black/empty ranges and pop/flash candidates. Mark intended reading holds with `hold`; use `loop: true` only for a seamless film, whose picture report then measures its seam. Open reported paths, inspect phone-size readability and adjacent frames, and play the draft when supported. Stills cannot establish smooth motion; measurements cannot establish good sound. Record unavailable inspections.

Record timestamped findings and proposed changes in the generated `critique.md`. When the host can start a separate agent, have a fresh critic that didn't build the film review each bundle; see [independent review](references/independent-review.md) for the rules and prompts. Fix the most consequential defects and make another review bundle. Each new `critique.md` copies the previous round's revisions so they can be marked FIXED, PARTLY, or STILL PRESENT. Stop when the requested standard is reached or the agreed iteration/time budget is exhausted; report remaining issues. Do not treat numerical self-scores as objective quality certification.

## Verify and deliver

For captions, transcribe the final voice take, import it with `motion-mania captions --input transcript.json`, correct `captions.json`, and review the caption frames before the final render.

```sh
motion-mania verify --project ./videos/launch --format all --json
motion-mania render --project ./videos/launch --format all --quality looks --json
motion-mania audio --project ./videos/launch --format all --master --json
motion-mania picture --project ./videos/launch --format all --json
motion-mania frame --project ./videos/launch --at 13.5 --json
```

Resolve technical errors. `verify` gates layout at storyboard inspection frames, motion assertions, runtime/contracts and three fresh-session forward/reverse seeks; other sampled geometry remains transition advice. Choose settled frames and inspect those warnings. `render` preflights delivery metadata and repairs missing SDR tags/faststart by stream copy. `audio --master` measures, normalizes and limits the MP4 while copying video; omit `--master` for measurement alone. Set `motion.json.loudness` for the film (default -14 LUFS, -1 dBTP), then listen again. `picture` warnings locate holds, blank ranges, pops/flashes and optional loop seams; intentional effects can qualify. None is exhaustive, cross-machine reproducibility or creative approval.

Deliver the MP4s, chosen poster, review evidence, editable source location, and any known limitations. Use the explicit artifact paths returned by the CLI. See [commands and project conventions](references/commands.md) for preview preparation and the manifest contract.
