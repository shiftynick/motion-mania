# Commands and project conventions

All operations report JSON on stdout; `--json` also requests structured error output. Backend progress goes to stderr. Exit status is zero on success and nonzero on failure. Commands never call a model API; snapshot auto-analysis is explicitly disabled.

| Command | Behavior |
| --- | --- |
| `init <directory>` | Create a self-contained starter; refuse nonempty directories |
| `skill <directory>` | Copy the full agent skill and references to an explicit directory; refuse nonempty targets |
| `browser` | Explicitly download or locate the browser through the pinned HyperFrames backend |
| `doctor` | Check Node, FFmpeg, FFprobe, and a discoverable Chrome binary; actual launch is tested by capture |
| `plan` | Validate storyboard coverage and return unanswered creative-intent questions; no rendering |
| `frame --at 4.2` | Capture one exact time into a new output directory |
| `review --around 3,6.5 --draft` | Capture uniform samples plus storyboard keyframes; cuts get automatic strips unless --around selects them; optionally encode a draft |
| `verify` | Run HyperFrames checks and compare decoded pixels at three times in forward/reverse seek order |
| `render --quality looks` | Encode an MP4, verify size/duration/frame rate and required audio presence, then atomically replace the named export |
| `audio [--input file]` | Measure integrated loudness and true peak against the target; report silences, per-shot levels, energy rises near cuts, and an abrupt ending; draw a waveform marked with shots |
| `picture [--input file]` | Find frozen stretches (0.6s or longer) and near-black frames; report per-shot held time and draw an activity chart marked with shots |
| `captions --input transcript.json` | Import a word-timed transcript (JSON, SRT, or VTT) into `captions.json`; add `--max-words <n>` or `--replace` |
| `prepare` | Produce a persistent prepared copy that native HyperFrames Studio can open |

Project commands accept `--project <directory>`; rendering commands also accept `--format <name|all>`. `plan` and `captions` are independent of format. See [storyboard preflight](storyboard.md) for its schema and review behavior. The default project is the current directory; the default format is the first entry in the manifest. Time arguments are seconds within `[0, duration)`. `render` accepts `draft`, `looks`, or `delivery`.

`audio` reads `out/<format>.mp4` by default, so run it after `render`. `--input` measures any other media file, resolved from the current directory, such as a voice take or score; it needs a single format. The command fails when loudness is off target or true peak exceeds the ceiling, and returns advice for the gain change. Silences, cut accents, and ending warnings are evidence, not failures. `review --draft` runs the same analysis on its draft and adds `waveform.png` to the bundle. Measurements use ffmpeg's EBU R128 meter and a mono envelope; none of them replace listening. A loudness range under 1.5 LU produces a warning, since a mix that barely varies can sound like a constant wall.

`picture` also reads `out/<format>.mp4` by default and accepts `--input`. It compares frames 0.1s apart on a small grayscale copy. A frame counts as frozen when no 8×8 block (5% of the width) changes by more than 1/255 on average. Measuring by block means one small moving element keeps a frame alive, and a slow push isn't mistaken for a freeze. Holds of 0.6s or more are reported with their shots. Holds that reach the end of the film, or fall entirely within shots marked `hold`, are not flagged. Frames with mean luma below about 8% are reported as near-black, except in a film that is mostly dark. Results are warnings, never failures. `review --draft` runs the same analysis and adds `activity.png`.

Each `review` looks for the most recent earlier review of the same format that recorded prioritized revisions, falling back to the latest review when none did, so a quick check in between does not break the chain. Its `critique.md` links that review and copies its prioritized revisions into a "Previous findings" table for verification; `report.json` records the path as `previousCritique`. See [narration and captions](narration.md) for the caption workflow.

Use `prepare` to get the directory for a Studio preview. From the toolkit checkout:

```sh
node node_modules/hyperframes/bin/hyperframes.mjs preview /absolute/prepared/directory --background --no-open
```

Open the reported Studio URL. Prepared copies are snapshots of source: after editing `src/`, run `prepare` again. Studio edits apply to the prepared copy; move any desired edits back into `src/` before rebuilding. Stop the specific preview using the same backend command with `--stop`.

## Manifest v1

`motion.json` contains `schemaVersion: 1`, a nonempty `name`, `engine: "hyperframes@0.8.81"`, `duration` in seconds (0 < duration <= 600), integer `fps` (1–120), optional boolean `audioRequired`, optional `loudness`, and a `formats` map. `loudness` overrides the audio target: `integrated` LUFS (default -14, suited to web and social video), `truePeak` dBTP ceiling (default -1), and `tolerance` LU (default 1). Use -16 for speech-led films on podcast-style platforms or -23 for EBU broadcast delivery. Calm films often sit better around -16 to -19 than at the punchy -14 default; see [creative direction](creative-direction.md#sound-has-a-job). Each format has even integer `width` and `height` between 64 and 3840. Format names contain lowercase letters, digits, and hyphens, begin with a letter, and cannot be `all`.

Project paths are resolved from the project directory, independent of the caller's working directory. Source folders are fixed as `src/` and `assets/`. An optional `captions.json` in the project root is added to every build. Generated files go into `.motion/`, `reviews/`, and `out/`. Review runs have unique directories so prior evidence survives. MP4 metadata checks do not assess audio loudness, clipping, or creative quality.

Change the starter's dimensions to 1080×1920 and 1920×1080 for full HD, then inspect both layouts. The included sample uses 720×1280 and 1280×720 for quick iteration.

## Asset provenance

`assets/manifest.json` lists every file in `assets/` with its origin. `plan` warns about unlisted files and entries whose file is gone. Files named as another entry's `license` need no entry of their own.

```json
{
  "assets": [
    { "path": "logo.svg", "origin": "Supplied by the product team", "usage": "Brand identity" },
    { "path": "voice.wav", "origin": "Generated for this film", "generator": { "tool": "hyperframes tts", "model": "Kokoro-82M", "voice": "am_michael", "prompt": "Script revision 3" }, "usage": "Narration" },
    { "path": "keyframes/hero.png", "origin": "Generated for this film", "generator": { "tool": "image model name", "model": "version", "prompt": "Full prompt text", "date": "2026-09-29" }, "usage": "Shot 2 background" },
    { "path": "clips/city.mp4", "origin": "Wikimedia Commons", "sourceUrl": "https://commons.wikimedia.org/…", "license": "CC BY 4.0", "attribution": "Creator name", "usage": "Shot 3 b-roll" }
  ]
}
```

Generated media should record the generator's `model` and `prompt` so it can be reproduced or replaced. External media needs a `license`; CC BY licenses also need `attribution`, which must appear in the film or its description. Use only media the user is authorized to use; a checker cannot establish rights, and a Creative Commons label on a download page is not proof of the uploader's authority.
