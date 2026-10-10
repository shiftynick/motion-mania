# Sound design and delivery

Give sound a job in the storyboard's free-text `sound` field: establish a mood, mark an action, carry a transition, or leave room for speech. A cue on every movement becomes noise. A fast attack suits a sharp hit; a slow swell suits a long ramp. Let a resolving sound ring through the final lockup, then fade its tail. Measurements do not replace listening.

## Seeded effects and cue sheets

`motion-mania sound --project ./film --input ./film/cues.json --json` writes `assets/cues.wav` and records reproducible provenance in `assets/manifest.json`. `--output assets/reveals.wav` selects another WAV inside the project's assets directory; it replaces that asset. Input paths are relative to the caller; output paths are relative to the project. The command does not add an audio element or edit the storyboard.

```json
{
  "seed": 19,
  "cues": [
    { "at": 3, "effect": "whoosh", "duration": 0.55, "gainDb": -8 },
    { "at": 6.5, "effect": "click", "leadFrames": 2, "gainDb": -12 },
    { "at": 10, "effect": "impact", "gainDb": -6 },
    { "at": 13, "effect": "swell", "duration": 2, "gainDb": -12 }
  ]
}
```

Effects are `whoosh`, `click`/`tick`, `pop`, `impact`, `riser`, and `pad`/`swell`. They are original local synthesis, require no downloads, and use an unsigned 32-bit seed. Defaults last 0.55, 0.055, 0.18, 0.65, 1.5, and 2.5 seconds respectively. Each cue can override `seed`, `duration` (0.02–30 seconds), and `gainDb` (-60 to +12). The CLI takes film duration and fps from `motion.json`; the standalone API accepts them as options.

`at` is where the effect's measured absolute sample peak lands, not where its file begins. `leadFrames: 2` puts that peak two frames before the visual lands; the lead-in begins earlier still. This convention helps an entrance feel connected to its accent. Use zero lead for a hit exactly on a cut. Reported `start`, `peakAt`, `peakOffsetMs`, and `effectPeakAt` show the placement. Lead-ins and tails crossing film boundaries are trimmed with a warning. Overlapping cues can shift the combined peak; excessive overlaps reduce the entire stem's gain, reported as `gainDb`, rather than clipping it.

Add the generated stem at composition time zero:

```html
<audio id="cues" src="assets/cues.wav" data-start="0"
  data-duration="__DURATION__" data-track-index="3" data-volume="0.4"></audio>
```

For a score script in a toolkit checkout, import `effect`, `renderCues`, and `wavBuffer` from `src/sound.js`. `effect(kind, options)` returns `{ samples, rate, peakAt, duration }`; `renderCues(sheet, { duration, fps, rate })` returns `{ samples, rate, cues, gainDb, warnings }`. `wavBuffer(samples, rate)` produces a mono float WAV. Write it with Node's `writeFile` and record provenance yourself, or use the CLI to do both. The generators are deterministic at a given rate and seed; they are a small design kit, not a composer.

A cue often needs its transient within roughly 12 dB of the narration to remain audible. Treat that as a starting point, compare comparable peak measurements, then listen in the full mix at low volume. A bright click can mask consonants even at a low level; space it between words or change its spectrum.

## Master the rendered mix

```sh
motion-mania audio --project ./film --format landscape --master --json
motion-mania audio --project ./film --input ./film/out/custom.mp4 --master --json
```

`--master` replaces that MP4 atomically after measuring the candidate. It performs two-pass FFmpeg loudnorm, an oversampled limiter with makeup gain disabled, and AAC encoding with 0.5 dB of peak headroom. It copies the encoded video stream. Failed measurements leave the earlier MP4 intact. The report adds `mastering.before`, `after`, `target`, `gainDb`, `checks`, `method`, `video`, and `warnings`, then runs the usual waveform and delivered-file checks. `--format all` masters each export separately; `--input` requires one format.

The existing `motion.json.loudness` sets `integrated`, `truePeak`, and `tolerance`; defaults are -14 LUFS, -1 dBTP, and ±1 LU. Calm or speech-led films can use -16 to -19 LUFS. Mastering refuses missing audio or unmeasurable silence and warns above 18 dB of requested gain. A sparse or noisy source may need a better mix. Loudnorm can use dynamic normalization when linear gain cannot meet both targets, changing dynamics; listen again after mastering. Avoid repeatedly mastering an AAC export: render a fresh mix when revising.

Silence evidence adapts to the programme: its threshold is the quieter of -50 dBFS, integrated loudness minus 30 dB, and the active envelope's 80th percentile minus 24 dB, bounded at -90 dBFS. `silenceThresholdDb` exposes the chosen value. Levels come from a mono envelope, so this remains approximate evidence.

## Detect a supplied music grid

```sh
motion-mania beats --project ./film --input ./film/assets/music.wav --json
```

This wraps the pinned HyperFrames detector in headless Chrome. It returns `bpm`, `beatOffset` (the first detected beat, seconds from the supplied file's start), `beats: [{ time, strength }]`, `downbeats`, `loudestMoment: { at, levelDb, window }`, a possible `drop: { at, riseDb }`, `limitations`, and a persistent `report` path. Input can be any FFmpeg-readable audio or video up to 600 seconds; it is converted to mono for detection. Missing audio and tracks without detectable beats fail.

Confirm tempo and phase by listening before setting storyboard `bpm` and `beatOffset`. The detector assumes constant tempo, can report half or double the musical tempo, and may miss the sparse opening. The Loop's authored 120 BPM score measured as 240 BPM with its first detected beat at 6.268s. Add the music clip's `data-start` and subtract any media trim when converting file times to composition times. Keep a known authored tempo when the detector disagrees. `downbeats` is `null`: this backend does not expose meter or downbeat detection. The loudest moment is a 0.5s RMS window; the drop is the strongest rise across adjacent windows, not a recognized musical drop.

## Carve the bed under narration

Verified with HyperFrames 0.8.145: `data-fx-carve` alone does not change rendered audio. It records the source/strength settings; audible carving requires the accompanying `data-fx-chain` and `data-automation` output. Keep all three when carrying a measured carve from an editor into source. Never put the carve on the voice track.

This tested pattern attenuates a voice band in the bed during speech. Select frequencies and speech spans for the actual voice; 1800 Hz is the probe's band, not a universal narration preset.

```html
<audio id="bed" src="assets/score.wav" data-start="0" data-duration="2"
  data-track-index="1" data-volume="0.25"
  data-fx-carve='{"version":1,"enabled":true,"sources":["voice"],"strength":0.7}'
  data-fx-chain='{"version":1,"nodes":[{"id":"voice-band","type":"peaking","fromCarve":true,"params":{"frequency":1800,"q":1,"gain":0}}]}'
  data-automation='{"version":1,"lanes":[{"target":"fx.voice-band.gain","points":[{"t":0,"v":0},{"t":0.4,"v":0},{"t":0.5,"v":-12},{"t":1.5,"v":-12},{"t":1.6,"v":0}]}]}'></audio>
<audio id="voice" src="assets/voice.wav" data-start="0.5"
  data-duration="1" data-track-index="2"></audio>
```

Automation times are seconds relative to the bed's start. Start the reduction before the line, restore it after the line, and preserve low-band energy instead of turning the whole score down. In a rendered two-tone probe, this chain reduced the 1800 Hz mixed band by 6 dB during the voice while changing 220 Hz by only 0.23 dB. A flat volume lane at 0.25 reduced the low band by 12 dB. A `volume` lane uses absolute gain values; avoid competing GSAP volume tweens.

For level matching before mixing, run `npx hyperframes@0.8.145 normalize-audio <prepared-directory> --reference voice --target bed --write --json`. The tested command persisted `data-volume` and matched the bed's projected integrated loudness to the reference; that establishes equal loudness, so lower the bed afterward to sit under speech. An absolute target uses `--lufs=-14` (the equals sign is required for negative values). This command adjusts source gain, caps it at true-peak headroom, and does not guarantee a mastered final mix. Prepared directories are disposable: copy wanted attribute changes back to `src/index.html`, render, and measure the combined MP4.
