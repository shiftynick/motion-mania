# Commands and project conventions

All operations report JSON on stdout; `--json` also requests structured error output. Backend progress goes to stderr. Exit status is zero on success and nonzero on failure. Commands never call a model API; snapshot auto-analysis is explicitly disabled.

| Command | Behavior |
| --- | --- |
| `init <directory>` | Create a self-contained starter; refuse nonempty directories |
| `skill <directory>` | Copy the full agent skill and references to an explicit directory; refuse nonempty targets |
| `browser` | Explicitly download or locate the browser through the pinned HyperFrames backend |
| `doctor` | Check Node, FFmpeg, FFprobe, and a discoverable Chrome binary; actual launch is tested by capture |
| `plan` | Validate storyboard coverage and return unanswered creative-intent questions; no rendering |
| `lint` | Scan authored JS/HTML/CSS plus HyperFrames lint; report local waivers and fail on active errors |
| `frame --at 4.2` | Capture one exact time into a new output directory |
| `review --around 3,6.5 --draft` | Capture uniform samples plus storyboard keyframes; cuts get automatic strips unless --around selects them; show vertical safe-area guides and sampled text collisions; optionally encode a measured draft |
| `review --against ref.mp4 [--at 1,4,8]` | Add reference/ours stills, detected reference cuts and storyboard pacing to the review and critique; no creative similarity verdict |
| `capture <url>` | Download site evidence with vision disabled, record provenance, and propose brand values; ownership and reuse authorization remain with the site owner |
| `media search <query> --type audio\|image\|video` | Search Openverse audio/images or Pexels video; default to commercial use and modification |
| `media fetch <id> --project DIR [--type audio\|image\|video] [--name file]` | Import provider media into `assets/media/`, atomically record provenance, refuse overwrites |
| `media credits --project DIR [--all]` | Combine attribution for all recorded BY assets; `--all` adds every asset imported with `media fetch` |
| `keys set <provider> [--validate]` | Store a user API key from stdin or a hidden prompt; currently `pexels` |
| `keys list`, `keys remove <provider>`, `keys path` | Show masked keys and their source, remove a stored key, or locate the credentials file |
| `variants [--quality looks] [--at 1]` | Render named composition-variable sets with normal delivery validation and a labelled comparison sheet; preserve previous runs |
| `verify [--caption-zone band]` | Gate settled-frame layout, motion assertions and runtime contracts; advise on transition geometry; compare three forward/reverse seeks |
| `render --quality looks` | Encode an MP4, preflight dimensions/fps/duration, H.264/yuv420p, BT.709 TV tags, faststart, and AAC; repair missing SDR tags/faststart by stream copy, then atomically replace the named export |
| `audio [--input file]` | Measure integrated loudness and true peak against the target; report silences, per-shot levels, energy rises near cuts, and an abrupt ending; draw a waveform marked with shots |
| `audio --master [--input file]` | Two-pass mastering, video stream copy, atomic MP4 replacement after measurement; report before/after |
| `sound --input cues.json [--output assets/cues.wav]` | Generate seeded sound effects at measured cue peaks and record provenance |
| `beats --input music.wav` | Detect tempo and beat times; report first-beat offset, loudest window, candidate drop, and limitations |
| `picture [--input file]` | Find frozen, dark/empty stretches, opening-state and one-frame pops/flashes, and optional loop-seam jumps/motion mismatches; draw an activity chart marked with shots and candidates |
| `captions --input transcript.json` | Import a word-timed transcript (JSON, SRT, or VTT) into `captions.json`; add `--max-words <n>` or `--replace` |
| `prepare` | Produce a persistent prepared copy that native HyperFrames Studio can open |

Project commands accept `--project <directory>`; rendering commands also accept `--format <name|all>`. `plan` and `captions` are independent of format. See [storyboard preflight](storyboard.md) for its schema and review behavior. The default project is the current directory; the default format is the first entry in the manifest. Time arguments are seconds within `[0, duration)`. `render` accepts `draft`, `looks`, or `delivery`.

`lint` accepts `--format <name|all>` because the backend sees prepared dimensions. Its `findings` preserve `file`, `line`, `rule`/`code`, `severity`, `origin`, and message; `waived` retains reasons. `plan` remains render-free and includes fast `sourceLint` and `copyProvenance` questions. See [static lint](authoring.md#static-lint) and [storyboard fields](storyboard.md).

`verify` requests storyboard `reviewAt` frames (shot midpoints by default; nine uniform midpoints without a storyboard), transition sampling, and software browser capture. Choose settled inspection frames: layout errors there fail; geometry errors only at other samples become warnings. Motion assertions, explicit caption zones, seek mismatches, and runtime/contract errors still fail. Storyboard `assertions` generate `index.motion.json` in the prepared copy; the backend discovers it automatically. Results include `settledTimes`, compact `findings`, `motion`, `transitionSamples`, and `transitionSamplesDropped` beside three seek `comparisons`. Transition geometry/contrast advice is grouped by code and severity with a time range, collision count, element count and up to three selector examples; settled findings remain individual and the complete backend report is retained. Optional `--caption-zone "x0=0;y0=.82;x1=1;y1=1;severity=error;seek=.5,1"` reserves a fractional caption band using the pinned backend syntax. Without it, no caption band is added. This flags text DOM boxes overlapping the band, not caption legibility; waive intended band text with `data-layout-allow-caption-zone` on its narrowest wrapper. Static lint comments do not waive backend runtime/layout/motion errors.

`audio` reads `out/<format>.mp4` by default, so run it after `render`. `--input` measures any other media file, resolved from the current directory, such as a voice take or score; it needs a single format. The command fails when loudness is off target or true peak exceeds the ceiling, and returns advice for the gain change. Silences, cut accents, and ending warnings are evidence, not failures. `review --draft` runs the same analysis on its draft and adds `waveform.png` to the bundle. Measurements use ffmpeg's EBU R128 meter and a mono envelope; none of them replace listening. A loudness range under 1.5 LU produces a warning, since a mix that barely varies can sound like a constant wall.

`audio --master` replaces the selected MP4 after two-pass loudnorm and oversampled limiting pass the configured loudness checks; video is copied. `sound` and `beats` are independent of format and require `--input`. Sound output is resolved from the project; inputs are resolved from the caller. See [sound design and delivery](sound.md) for cue fields, JSON results, mastering limits, and verified carved ducking. Silence evidence adapts to quiet programme levels; `silenceThresholdDb` reports its threshold.

`picture` also reads `out/<format>.mp4` by default and accepts `--input`. It compares frames 0.1s apart on a small grayscale copy. A frame counts as frozen when no 8×8 block (5% of the width) changes by more than 1/255 on average. Measuring by block means one small moving element keeps a frame alive, and a slow push isn't mistaken for a freeze. Holds of 0.6s or more are reported with their shots. Holds that reach the end of the film, or fall entirely within shots marked `hold`, are not flagged. Frames with mean luma below about 8% are reported as near-black, except in a film that is mostly dark. Results are warnings, never failures. `review --draft` runs the same analysis and adds `activity.png`.

`picture` also tests adjacent frames at the delivered frame rate, including above 30 fps. A possible one-frame pop needs block differences above 12/255 and 3× the local median, with the two neighbouring states resembling each other in that block. A frame-zero candidate instead needs an exceptional first change followed by a stable next frame; it has `endpoint: true` and no preceding-frame evidence. Large whole-frame luma spikes are labelled flashes. Declared shot boundaries are omitted from the local baseline; unchanged regions next to a cut still get tested. `transients` lists `frame` (zero-based), `at` (seconds), `type`, change measurements, `baseline`, and cut proximity where available. Yellow marks on `activity.png` locate candidates. `blank` lists nearly uniform bright stretches of at least two frames, which can expose empty cut gaps but can also be deliberate solid-colour cards. Inspect candidates: intentional flashes can qualify, tiny or colour-only pops can be missed, and the first/last frame still need manual inspection.

Set `"loop": true` in `motion.json` only for an intended seamless loop (default false). `picture` and `review --draft` then add `loop`: last-to-first `seamChange`, `enteringChange`, `leavingChange`, signed `velocityDifference`, `jump`, `velocityMismatch`, and `warnings`. A jump exceeds 12/255 and 3× the adjacent motion; a motion mismatch exceeds 3/255 and 75% of the larger adjacent motion. This estimates image-space continuity on the grayscale copy; it does not track object velocity or inspect the audio seam. Films without the marker have no loop check.

Vertical `review` phone previews shade reserved bands and draw a dashed safe rectangle. Defaults for 9:16: top 13%, bottom 19%, left/right 6%; other portrait aspects use 4% sides. Optional `safeArea` in `motion.json` overrides margins with fractions from 0 to less than 0.5. Zero disables a band. Landscape previews are unchanged. The `safeArea` report includes `margins`, `samples`, `sampledFindingCount`, grouped `findings` (`selector`, `text`, `edges`, `from`, `to`, `occurrences`), `warnings`, and up to four raw backend reports. HyperFrames supplies candidates at overview/keyframe/caption samples; Motion Mania rechecks tighter DOM text Range boxes against the bands with 2px tolerance. Full-bleed backgrounds/media are excluded. Use `data-layout-allow-caption-zone` on the narrowest wrapper for deliberate edge copy or masked, unpainted text, documenting why. The extra checks launch up to four browser sessions. Guides are approximate platform UI allowances, not specifications; moving text can collide between samples and font boxes can overstate visible glyphs.

`render` and draft encoding include a `delivery` report with `video`, `audio`, `faststart`, `errors`, `warnings`, and `repairs`. Wrong dimensions, fps, video/container duration, missing required audio, multiple video streams, or missing MP4 atoms fail before replacing an export. Codec/pixel-format, colour and audio compatibility findings are warnings. Known SDR H.264/yuv420p renders with missing colour tags and MP4s with a late `moov` get a validated stream-copy remux; `repairs` lists `bt709-tv-tags` and/or `faststart`. Explicit alternate colour spaces/ranges are preserved and warned about: retagging is not colour conversion. A present audio track should be one AAC stream; an audio-free film is valid unless `audioRequired` is true. The pinned backend already supplies these preferred properties at draft, looks and delivery quality in the tested SDR path. Metadata checks do not establish colour accuracy, playback quality, or platform approval.

Each `review` looks for the most recent earlier review of the same format that recorded prioritized revisions, falling back to the latest review when none did, so a quick check in between does not break the chain. Its `critique.md` links that review and copies its prioritized revisions into a "Previous findings" table for verification; `report.json` records the path as `previousCritique`. See [narration and captions](narration.md) for the caption workflow.

Use `prepare` to get the directory for a Studio preview. From the toolkit checkout:

```sh
node node_modules/hyperframes/bin/hyperframes.mjs preview /absolute/prepared/directory --background --no-open
```

Open the reported Studio URL. Prepared copies are snapshots of source: after editing `src/`, run `prepare` again. Studio edits apply to the prepared copy; move any desired edits back into `src/` before rebuilding. Stop the specific preview using the same backend command with `--stop`.

## Manifest v1

`motion.json` contains `schemaVersion: 1`, a nonempty `name`, `engine: "hyperframes@0.8.145"`, `duration` in seconds (0 < duration <= 600), integer `fps` (1–120), optional boolean `audioRequired`, optional `loudness`, and a `formats` map. `loudness` overrides the audio target: `integrated` LUFS (default -14, suited to web and social video), `truePeak` dBTP ceiling (default -1), and `tolerance` LU (default 1). Use -16 for speech-led films on podcast-style platforms or -23 for EBU broadcast delivery. Calm films often sit better around -16 to -19 than at the punchy -14 default; see [creative direction](creative-direction.md#sound-has-a-job). Each format has even integer `width` and `height` between 64 and 3840. Format names contain lowercase letters, digits, and hyphens, begin with a letter, and cannot be `all`.

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

Generated media should record the generator's `model` and `prompt` so it can be reproduced or replaced. External media needs a `license`; CC BY licenses also need `attribution`, which must appear in the film or its description. `plan` lists attribution-required assets even when the credit is recorded, warns about NonCommercial and NoDerivatives licences, and calls out ShareAlike obligations. These remain warnings, not failures. Use only media the user is authorized to use; a checker cannot establish rights, and a Creative Commons label on a download page is not proof of the uploader's authority.

## API keys

```sh
motion-mania keys set pexels             # Hidden prompt; get a free key at https://www.pexels.com/api/
motion-mania keys set pexels --validate  # Optional single provider request
motion-mania keys list --json
motion-mania keys path --json
motion-mania keys remove pexels --json
```

`keys set <provider> [--validate]` reads stdin when piped, otherwise prompts without echo. Keys are never accepted as arguments. Empty keys and unknown providers fail; currently only `pexels` is supported. Validation reports acceptance, leaves an existing key intact on HTTP 401/403, and stores the key as unverified on network failure or other provider errors. Without `--validate`, no request is made. `keys list` reports each provider's `configured`, effective `source` (`environment`, `file`, or `null`), and `masked` key (last four characters; short keys are fully masked). `keys remove` affects only the file; environment overrides remain active. All commands return JSON; `keys path` returns the location in `path`.

Credentials live outside film projects at `$XDG_CONFIG_HOME/motion-mania/credentials.json`, falling back to `~/.config/motion-mania/credentials.json` on Linux/macOS or `%APPDATA%\motion-mania\credentials.json` on Windows (`~/AppData/Roaming` if APPDATA is unset). Relative XDG paths are ignored. The file is a plaintext JSON object with `schemaVersion: 1` and keys by provider name, such as `pexels`; unversioned provider maps are also accepted. Writes are atomic, with directory mode 0700 and file mode 0600 on POSIX; reading a group/other-readable file warns on stderr. `PEXELS_API_KEY` takes precedence over the stored Pexels key for CI or one-off overrides. Keys are used only in API Authorization headers, never recorded in film manifests or command output.

## Media search and import

```sh
motion-mania media search "whoosh" --type audio --category sfx --limit 5 --json
motion-mania media search "ambient" --type audio --category music --json
motion-mania media search "mountains" --type image --json
motion-mania media fetch openverse:audio:<uuid> --project ./film --name whoosh.mp3 --json
motion-mania media credits --project ./film --json
# Video: save a free Pexels key once (or set PEXELS_API_KEY).
motion-mania keys set pexels
motion-mania media search "ocean" --type video --json
motion-mania media fetch pexels:video:<number> --project ./film --json
```

`media search <query> --type audio|image|video [--category music|sfx] [--limit N] [--allow-restricted] [--json]` accepts a 1–200 character query and a limit of 1–20 (default 10). Audio/images use [Openverse](https://api.openverse.org/v1/) without a key. `music` maps to its `music` category and `sfx` to `sound_effect`; if the latter returns no matches, a second request searches Freesound because many sound effects have no category. `filter.category` and `warnings` disclose this fallback. One page is requested, with no automatic retries or bulk pagination. Anonymous response headers observed on 2026-10-17 advertise 20 requests/minute and 200/day; limits can change. HTTP 429 errors report numeric `Retry-After` seconds when supplied. Requests use a descriptive `motion-mania` User-Agent with the repository URL.

The default allowlist is CC0, Public Domain Mark, CC BY and CC BY-SA; unknown licences and special sampling licences are excluded. The API receives an explicit `license=by,by-sa,cc0,pdm` filter, and results are checked locally too. Commercial use and modification must both be allowed: trimming, mixing, grading, and synchronizing music in a film can create adaptations. `--allow-restricted`, on search and fetch, explicitly includes indexed restricted licences for personal projects. It does **not** grant commercial rights to NC works or permission to share ND derivatives. BY requires credit, and BY-SA can impose ShareAlike on adaptations. Read the linked licence and verify the source's authority before using a work.

Video uses the [documented Pexels API](https://www.pexels.com/api/documentation/) and fails before networking without a key. Run `motion-mania keys set pexels` once, or supply `PEXELS_API_KEY` as an override ([API keys](#api-keys)). The key is used only in the API Authorization header and is never printed or recorded. The Pexels licence is **not Creative Commons**: entries use `license: "Pexels"`, `licenseVersion: null`, and `licenseUrl: "https://www.pexels.com/license/"`, and state that attribution is appreciated but not required. Its other restrictions still apply. Video selection uses the largest MP4 whose dimensions are both at most 1920px, falling back to the smallest available MP4. A live invalid-key check returns HTTP 401; successful search/import calls use fixtures from its published example response.

Openverse matches every word of a query. When a multi-word search returns nothing, search retries up to three of its longest words separately, ranks items found by more of them first, reports the words in `filter.queryFallback`, and adds a warning. Search JSON contains `ok`, `command`, `query`, `type`, `category`, `limit`, `provider`, `filter`, `candidates`, and `warnings`. `filter` reports `commercialUse`, `modification`, `allowRestricted`, `licenses`, `note`, and the applied `category`. Each candidate contains `id`, `type`, `title`, `creator`, `creatorUrl`, `source`, `provider`, `sourceProvider`, `license`, `licenseVersion`, `licenseUrl`, `sourceUrl` (landing page), `fileUrl`, `fileType`, `duration` (seconds), `width`, `height` (pixels), `previewUrl`, `previewOnly`, `category`, `licensePolicy`, and `warnings`. Unknown metadata is `null`; image file types are inferred from file URLs where necessary, and Jamendo's `mp32` is normalized to `mp3`. `licensePolicy` includes `code`, `known`, `nonCommercial`, `noDerivatives`, `attributionRequired`, `shareAlike`, `commercialUse`, `modification`, and `filmSafe`. Freesound files supplied through Openverse are **MP3 previews**, not original WAV/FLAC downloads; `previewOnly` and warnings say so.

`media fetch <id> --project DIR [--type audio|image|video] [--name file] [--allow-restricted] [--json]` resolves the provider's detail endpoint again, checking its current licence and metadata. Prefer the qualified ID returned by search: `openverse:audio:<uuid>`, `openverse:image:<uuid>`, or `pexels:video:<number>`. Raw provider IDs require `--type`. `--project` is required for fetch and credits. `--name` accepts a single filename of 1–180 letters/digits/dots/underscores/hyphens, starting with a letter or digit; it cannot contain directories. Default names include provider, type, ID and extension.

Downloads use the detail response's file URL, with public-address checks, a 120-second timeout and a 250 MiB maximum. Redirects must keep the same host or use known provider/CDN domains (Freesound, Jamendo, or Pexels/Vimeo); HTTPS cannot downgrade to HTTP. Unknown redirect hosts fail visibly. Local output directories and the manifest cannot be symlinks. Files are streamed to an exclusive temporary file, published atomically without replacing existing files, then recorded using the atomic manifest writer; manifest failure rolls back the new file. Existing files and provenance entries are never replaced. As with other provenance commands, run imports serially when sharing a project with another writer.

Fetch JSON contains `ok`, `command`, `project`, `output`, `bytes`, `asset`, `filter`, and `warnings`. The manifest's `asset` has an assets-relative `path`, `origin`, `mediaId`, `type`, `title`, `sourceUrl`, `creator`, `creatorUrl`, `license`, `licenseVersion`, `licenseUrl`, `provider`, `source`, `sourceProvider`, `retrievedAt` (ISO UTC), `sha256`, `fileUrl`, `fileType`, `duration`, `width`, `height`, `previewOnly`, `modifications`, and ready-to-use `attribution`. No edits have been made at import: update the credit with actual subsequent modifications.

`media credits --project DIR [--all] [--json]` returns `ok`, `command`, `project`, `assets`, `text`, and `note`. Each asset has `path`, `license`, `required`, `attribution`, and `missingAttribution`. `--all` also includes credit-optional imports such as CC0 and Pexels media (every asset recorded by `media fetch`), with `required: false`. `text` combines all recorded BY credits with blank lines for end credits or a description, including BY-SA and restricted BY variants; it does not attempt to detect which assets the film uses. Legacy entries without attribution receive a fallback credit and `missingAttribution: true`; complete their metadata before delivery. CC0/PDM and Pexels credits are optional and are not in this combined BY list.

## Reference comparison

```sh
motion-mania review --project ./film --format landscape --against ./reference.mp4 --at 1,4,8 --json
```

`--against` resolves a video path from the caller's directory, including paths outside the project; it does not copy the reference in. `--at` chooses reference comparison times only; normal review samples and `--around` strips still run. Without `--at`, six evenly spaced samples span the shared duration. Times must be inside both videos; the same seconds are compared without stretching either film. Another format's MP4 or an earlier draft can be used as the reference.

`report.json.reference` includes `source`, `keptInProject`, `sheet`, `times`, `pairs` (`time`, `reference`, `ours`), `pacing`, `report`, and `rule`. `reference-comparison.png` labels the left column reference and the right ours. `reference-pacing.json` records the full reference's detected `cutTimes`, `cutCount`, `cutsPerMinute`, `shotLengths`, `meanShotLength`, `medianShotLength`, `shortestShot`, and `longestShot`, alongside the storyboard's declared boundaries for ours (null without a storyboard). FFmpeg uses a scene score above 0.3 at 320px width: fades can be missed and animation can count as a cut. A zero-cut result is not proof of a single shot. Full-duration densities can differ even when the sheet covers only their shared span.

The critique asks the reviewer to take the reference's grammar (pacing, framing, rhythm), never its content or identity. Stills and detected cuts do not establish smooth motion or creative similarity. A reference retained under `assets/` gets an asset provenance entry; references elsewhere inside the project get project-relative `references` entries in `assets/manifest.json`. External paths are recorded in the review only and remain external dependencies.

## Brand capture

```sh
motion-mania capture https://product.example --project ./film --json
```

The URL is required explicitly and must be absolute HTTP(S) without embedded credentials. This command makes network requests and downloads third-party assets. Captured assets belong to the site's owner and need authorization to use; capture does not establish a license or brand approval. HyperFrames runs with `--skip-vision`; telemetry and update checks stay disabled. Page navigation and post-navigation budgets are each 30 seconds, with at most eight page screenshots and a 180-second subprocess limit. Those budgets can produce partial output.

Each run creates `assets/captures/site-<unique>/` containing backend files, `backend-report.json`, `summary.json`, and `brand-proposal.json`. JSON returns `url`, `capturedAt`, `output`, `paletteCandidates`, `fontFamilies`, `logoCandidates`, `imageCandidates`, `screenshots`, `fonts`, `dropped`, `warnings`, `httpStatus`, `title`, `brandProposal`, `rights`, `proposal`, `report`, `backendReport`, `brandApplied: false`, and `lastPhase`. Candidate file paths are relative to the capture directory; the proposal's logo path is project-relative. Font families observed on the page are distinct from font files successfully downloaded. Logo names are only filename candidates and may be empty for hashed assets. Palette order comes from backend observations, not a classification of primary/accent colours.

All saved evidence gets provenance with the source URL, capture date, and authorization-required usage in `assets/manifest.json`; no license is invented. Inspect the screenshots and proposal, then apply suitable values to `brand.json` and source yourself. Existing `brand.json` is never overwritten. Backend drops, warnings, HTTP status, and partial files remain visible even when capture reports failure; `ok: true` can still represent a sparse capture or an HTTP error page.

## Variant renders

Declare a JSON **array** on the root composition in `src/index.html`:

```html
<main data-composition-id="motion-mania" data-composition-variables='[{"id":"headline","type":"string","label":"Headline","default":"YOUR CODE."}]' ...>
```

Read values before building the timeline in `src/scene.js`, with an explicit normal-render fallback:

```js
const variables = window.__hyperframes?.getVariables?.() ?? window.__hfVariables ?? {};
document.querySelector('.hook .word').textContent = variables.headline ?? 'YOUR CODE.';
```

The builder embeds `scene.js` in the prepared HTML. Batch render supplies values through the backend runtime; the comparison builds inject the same values and declared defaults before authored scripts. Apply variables deterministically to text/style/assets before timeline construction. Normal `render`, `frame`, and `review` continue to use defaults. This does not rewrite authored source or apply a selected variant to normal exports.

Create project-root `variants.json`:

```json
{
  "schemaVersion": 1,
  "reviewAt": 1,
  "variants": [
    { "name": "first", "label": "First headline", "variables": { "headline": "BUILD WITH FLOW." } },
    { "name": "second", "label": "Second headline", "variables": { "headline": "MAKE IT MOVE." } }
  ]
}
```

```sh
motion-mania variants --project ./film --format all --quality draft --json
```

Use 2–12 uniquely named variants; names start with a lowercase letter and contain lowercase letters, digits, and hyphens. Each needs a nonempty `variables` object of declared scalar values. Types/defaults must match declarations (`string`, `number`, `boolean`, `color`, `enum`, `font`, `image`); number bounds and enum choices are checked. Optional labels are 1–80 characters without commas/newlines and default to the name. `reviewAt` is optional; `--at` overrides it with one timestamp, otherwise the default is 1s (or half the film for durations under 2s).

Batch output uses unique `{index}` paths and parses the backend's final JSON line after its logs. Each MP4 passes the same media checks and delivery preflight/remux as normal rendering. A run is published under `out/variants/<format>-<unique>/` only after all variants and the labelled `comparison.png` succeed; failures leave earlier runs intact. Results include `format`, `quality`, `at`, `output`, `manifest`, `variants` (name, label, variables, output, dimensions, duration, fps, audio, delivery, warnings), `comparison`, `batch`, and `report`. The sheet samples prepared compositions at the chosen time; inspect each encoded MP4 too, and measure audio with `audio --input <variant.mp4>`. Stills and metadata checks do not establish sound quality or a winning variant. Changed voice assets or caption styles require their own rendered and listening checks.
