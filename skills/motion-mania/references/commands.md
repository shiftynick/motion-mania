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
| `prepare` | Produce a persistent prepared copy that native HyperFrames Studio can open |

Project commands accept `--project <directory>`; rendering commands also accept `--format <name|all>`. `plan` is independent of format. See [storyboard preflight](storyboard.md) for its schema and review behavior. The default project is the current directory; the default format is the first entry in the manifest. Time arguments are seconds within `[0, duration)`. `render` accepts `draft`, `looks`, or `delivery`.

Use `prepare` to get the directory for a Studio preview. From the toolkit checkout:

```sh
node node_modules/hyperframes/bin/hyperframes.mjs preview /absolute/prepared/directory --background --no-open
```

Open the reported Studio URL. Prepared copies are snapshots of source: after editing `src/`, run `prepare` again. Studio edits apply to the prepared copy; move any desired edits back into `src/` before rebuilding. Stop the specific preview using the same backend command with `--stop`.

## Manifest v1

`motion.json` contains `schemaVersion: 1`, a nonempty `name`, `engine: "hyperframes@0.8.81"`, `duration` in seconds (0 < duration <= 600), integer `fps` (1–120), optional boolean `audioRequired`, and a `formats` map. Each format has even integer `width` and `height` between 64 and 3840. Format names contain lowercase letters, digits, and hyphens, begin with a letter, and cannot be `all`.

Project paths are resolved from the project directory, independent of the caller's working directory. Source folders are fixed as `src/` and `assets/`. Generated files go into `.motion/`, `reviews/`, and `out/`. Review runs have unique directories so prior evidence survives. MP4 metadata checks do not assess audio loudness, clipping, or creative quality.

Change the starter's dimensions to 1080×1920 and 1920×1080 for full HD, then inspect both layouts. The included sample uses 720×1280 and 1280×720 for quick iteration.
