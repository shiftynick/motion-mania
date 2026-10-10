# Motion Mania

**Turn a product repository into a short film—with an agent, a skill, and a CLI.**

[![CI](https://github.com/shiftynick/motion-mania/actions/workflows/ci.yml/badge.svg)](https://github.com/shiftynick/motion-mania/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/motion-mania)](https://www.npmjs.com/package/motion-mania)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Motion Mania gives coding agents a repeatable workflow for product films, launch reels, and motion graphics. The agent develops the idea, writes the animation, and critiques rendered evidence. The CLI handles project setup, storyboard checks, contact sheets, transition strips, frozen-frame detection, audio loudness checks, captions, verification, and MP4 exports using [HyperFrames](https://github.com/heygen-com/hyperframes).

https://github.com/user-attachments/assets/7be55d57-d7f8-4b97-a478-cedf00f4b4eb

[▶ Watch *The loop* (36 s, with sound)](https://github.com/shiftynick/motion-mania/releases/download/v0.3.0/the-loop-landscape.mp4) · [Vertical cut](https://github.com/shiftynick/motion-mania/releases/download/v0.3.0/the-loop-vertical.mp4) · [How it was made](examples/loop/review.md) · [Agent skill](skills/motion-mania/SKILL.md) · [Contributing](CONTRIBUTING.md)

## Quick start

Requires **Node.js 22+**, **FFmpeg/FFprobe**, and a supported **Chrome/Chromium**. Linux is tested in CI; other platforms depend on HyperFrames and the external tools. No separate model API key is needed—the agent you use supplies creative judgment.

```sh
npx motion-mania@latest doctor --json
# If Chrome is missing (explicit download):
npx motion-mania@latest browser

npx motion-mania@latest init ./videos/launch
npx motion-mania@latest plan --project ./videos/launch --json
npx motion-mania@latest lint --project ./videos/launch --format all --json
npx motion-mania@latest verify --project ./videos/launch --format all --json
npx motion-mania@latest review --project ./videos/launch --format all --draft --json
npx motion-mania@latest render --project ./videos/launch --format all --json
npx motion-mania@latest audio --project ./videos/launch --format all --master --json
npx motion-mania@latest picture --project ./videos/launch --format all --json
```

The starter is a working **15-second Motion Mania demo**. It does not invent a film about your product. Ask your agent to replace the brief, identity, storyboard, source, and audio, inspect the review images, and revise before export. Final videos land in `videos/launch/out/`.

`npx` installs the package and its dependencies when needed. Install FFmpeg separately through your OS package manager. `browser` delegates browser setup to the pinned HyperFrames version; `HYPERFRAMES_BROWSER_PATH` can select an existing binary. If Sharp tries to compile against an incompatible system libvips, set `SHARP_IGNORE_GLOBAL_LIBVIPS=1` when installing or running through npx.

For reproducible work, use `npx motion-mania@0.4.0 …`, or add it to your project with `npm install --save-dev --save-exact motion-mania@0.4.0`. A global install with `npm install -g motion-mania` is also supported.

## Give your agent the skill

Install the repository skill with the [skills CLI](https://github.com/vercel-labs/skills), which discovers `skills/motion-mania/SKILL.md` and its references:

```sh
npx skills add shiftynick/motion-mania --skill motion-mania
# Choose the host and project/personal scope in the installer.
# Later, refresh the installed repository skill:
npx skills update motion-mania
```

For Claude Code, the repository also contains a [plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces) using the same skill files:

```text
/plugin marketplace add shiftynick/motion-mania
/plugin install motion-mania@motion-mania-marketplace
```

The plugin supplies the skill; the CLI and rendering dependencies are installed separately. Local discovery and plugin installation were tested from a checkout; GitHub installation requires a revision containing these manifests. Plugin updates follow the host's marketplace settings, not npm updates.

You can still copy a release's complete skill to an explicit host-supported location. This command refuses to replace an existing nonempty directory:

```sh
# Example: a personal Codex skill directory
npx motion-mania@latest skill ~/.codex/skills/motion-mania

# Or choose a project/personal location explicitly
npx motion-mania@latest skill ./my-agent-skills/motion-mania
```

This copy is a snapshot; reinstall to a new directory and replace it deliberately when upgrading. Skill discovery depends on the agent host. Installing the CLI does not automatically register a skill. The skill explains CLI invocation through npx or a global installation and includes creative direction, motion starting values, the authoring contract, and review guidance.

Example prompt:

> Use Motion Mania to make an 18-second launch film for this product. Study its actual UI and brand, plan the story, create landscape and portrait versions, inspect the renders, and deliver the MP4s with editable source. Use illustrative content where a real recording is unavailable, and identify anything you could not inspect.

## Production loop

1. **Brief and plan:** identify the audience, observable benefit, brand assets, shot intent, and narration. `plan` checks reading floors, copy provenance, beat alignment, and measured narration timing; choose settled `reviewAt` frames and any motion assertions.
2. **Author:** edit local HTML/CSS and a paused GSAP timeline; run `lint` early. Use `sound` for seeded cues and `beats` for a measured music grid. HyperFrames renders the composition.
3. **Review and revise:** run `verify` and `review --draft` in both formats. Inspect keyframes, phone safe-area guides, transition strips, waveform, and activity/pop/flash candidates. Record changes by timestamp; a fresh critic carries previous revisions forward ([independent review](skills/motion-mania/references/independent-review.md)).
4. **Export and listen:** `render` preflights delivery metadata; `audio --master` measures and masters to the target (default -14 LUFS, -1 dBTP); `picture` checks the final encode. Listen and watch it. Technical success is separate from creative approval.

For a voiceover, write each shot's line in the storyboard, produce the voice with any tool you choose, then import a word-timed transcript with `captions`. Motion Mania renders it as animated captions and compares what was said with the script. See [narration and captions](skills/motion-mania/references/narration.md).

## Commands

| Command | Purpose |
| --- | --- |
| `init <directory>` | Create an editable starter with local fonts, GSAP, and original audio |
| `skill <directory>` | Install the full agent skill and references |
| `browser` | Download or locate the pinned backend's browser |
| `doctor` | Check Node.js, FFmpeg, FFprobe, and browser availability |
| `plan` | Validate storyboard timing; surface missing goals, focal points, transitions, and sound intent |
| `lint` | Check authored source and HyperFrames lint; report local waivers |
| `frame --at 4.2` | Capture one exact timestamp |
| `review [--around 3,6.5] [--draft]` | Generate contact sheets, shot keyframes, transition strips, critique notes that carry forward the previous round's revisions, vertical safe-area guides and sampled text collisions, and an optional measured draft MP4 |
| `review --against ref.mp4 [--at 1,4,8]` | Add a labelled reference/ours sheet and detected cut pacing; study grammar, never content or identity |
| `capture <url>` | Capture site colours, fonts, assets, and screenshots; propose brand values without changing `brand.json`; reuse needs authorization |
| `variants [--quality looks] [--at 1]` | Batch-render `variants.json` with normal delivery checks and a labelled comparison sheet; stills do not choose a winner |
| `verify [--caption-zone band]` | Gate settled-frame layout, motion assertions and runtime contracts; advise on transition geometry; compare three sampled forward/reverse seeks |
| `render [--quality draft\|looks\|delivery]` | Encode and preflight an MP4; stream-copy repair faststart/missing SDR tags before replacing the previous export |
| `audio [--input file]` | Measure loudness and true peak against the target; report silences, cut accents, and abrupt endings; draw a waveform |
| `audio --master [--input file]` | Master the MP4 to its loudness target, copy video, and report measured before/after |
| `sound --input cues.json [--output assets/cues.wav]` | Synthesize seeded sound effects, align their peaks to cues, and record provenance |
| `beats --input music.wav` | Detect tempo and beat grid; report first-beat offset and energy moments |
| `picture [--input file]` | Find holds, dark/empty stretches, opening-state and one-frame pops/flashes, and optional loop-seam defects; draw an activity chart |
| `captions --input transcript.json` | Import a JSON, SRT, or VTT transcript as burned-in, word-highlighted captions |
| `prepare` | Create a prepared composition snapshot for HyperFrames Studio |
| `--version` | Print the installed version |

Project commands accept `--project` (default: current directory). Render-related commands also accept `--format <name|all>` (default: first manifest format). Results are JSON on stdout; progress goes to stderr. `--json` also requests structured errors. Failures return a nonzero exit status.

`review` uses storyboard keyframes and automatic cut strips. `--around` replaces the automatic cut selection. A successful review command means evidence was generated—not that anyone inspected it.

## Editable, portable projects

```text
videos/launch/
  motion.json          # Duration, fps, dimensions, backend version
  brief.md
  brand.json
  storyboard.json
  captions.json        # Optional imported captions
  src/                 # Editable HTML, CSS, and animation timeline
  assets/              # Local media, fonts, libraries, and provenance
  reviews/             # Generated evidence and critique notes
  out/                 # MP4s, posters, and individual frames
  .motion/             # Disposable prepared copies
```

The starter exports 1280×720 and 720×1280 at 30 fps. Set dimensions to 1920×1080 and 1080×1920 for Full HD, then inspect both layouts. Changing duration does not automatically retime animation or sound.

Read the [authoring contract](skills/motion-mania/references/authoring.md), [storyboard guide](skills/motion-mania/references/storyboard.md), and [command details](skills/motion-mania/references/commands.md). `prepare` creates a snapshot, not a live-watched source tree; transfer any wanted Studio edits back into `src/`.

## Examples and development

Clone the repository for complete production examples; examples and videos are not included in the npm tarball.

- [Original launch demo](examples/launch): simple workflow introduction.
- [Connected motion study](examples/launch-v2): a graphic surface becomes code, motion, review frames, and multiple formats. [Review notes](docs/video-v2-review.md).
- [Lull](examples/lull): a 28-second film for a fictional notification app, with a local TTS voiceover, word-highlighted captions from a transcript, an original score timed to the animation, and a loudness-checked mix. [Review notes](examples/lull/review.md).
- [The loop](examples/loop): a 36-second film about Motion Mania that uses every part of the toolkit. One frame carries through brief, storyboard, code, the draft's own review evidence, and a critic's findings to both exports. It was revised over four measured and critic-reviewed rounds. [Review notes](examples/loop/review.md).

```sh
git clone https://github.com/shiftynick/motion-mania.git
cd motion-mania
npm ci
node src/cli.js browser
npm run check
```

Checks cover unit behavior, a real cross-repository review/render cycle, export recovery, and an isolated install of the npm tarball. See [CONTRIBUTING.md](CONTRIBUTING.md) and [release instructions](docs/releasing.md).

## Scope and limitations

This is an early release with one backend. It synthesizes seeded sound effects and masters audio, but does not orchestrate models, generate visual media, call a speech service, judge creative quality automatically, offer a separate editing UI, or render in the cloud. The pinned backend offers local TTS and transcription; see [narration and captions](skills/motion-mania/references/narration.md). Bring generated or external media with its provenance recorded. Three sampled seek comparisons are not exhaustive or a cross-machine reproducibility guarantee. Loudness, waveform, and metadata checks do not replace listening. A screenshot does not establish smooth playback, and frozen-frame detection does not judge pacing.

Projects contain executable HTML/JavaScript. Treat unfamiliar projects as code and use isolation when appropriate; see [SECURITY.md](SECURITY.md). The CLI disables HyperFrames usage telemetry and automatic snapshot model analysis. Authored project code may still make network requests.

## License and credits

Motion Mania's own code and original materials are [MIT licensed](LICENSE). Dependencies and bundled fonts retain separate licenses; **GSAP uses its own Standard License**, not MIT. See [third-party notices](THIRD_PARTY_NOTICES.md).

Built on [HyperFrames](https://github.com/heygen-com/hyperframes), [GSAP](https://gsap.com/), and [Sharp](https://sharp.pixelplumbing.com/). Inspired by [Movez's article on an agent-powered motion studio](https://x.com/0xMovez/status/2104216919033192746).
