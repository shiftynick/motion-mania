# Narration and captions

Use this when a film has a voiceover or needs captions. Many product films need neither: on-screen type and a score can carry a short reel. Decide in the brief, record the choice, and treat silence as a valid option.

## Write the script before the voice

Put each shot's spoken line in its storyboard `narration` field. `plan` estimates pace per shot and warns above about 160 words per minute; aim for 130–160 with room to breathe. If a line does not fit, cut words or lengthen the shot. Don't speed up the voice.

Choose a register in the brief, for example "a patient engineer explaining a tool to a colleague" or "a lecturer walking through a diagram." Write for the ear:

- Use connected sentences that carry an argument from one shot to the next. On-screen type can be terse; spoken fragments strung together ("Fast. Simple. Yours.") sound like slogans. `plan` flags three or more in a row.
- Say what the viewer is looking at and why it matters. Narration that repeats the headline on screen wastes both.
- Prefer specific, verifiable statements to figures. `plan` flags numbers and percentages; keep each one only if a source supports it, and never invent metrics.
- Avoid stock constructions: "It's not X, it's Y," rhetorical questions as openers, "Imagine a world," triads of adjectives, and closing slogans that restate the product name.
- Read the script aloud or listen to a take before rendering. A line that looks fine can be hard to say.

## Produce the voice

Motion Mania does not call a speech service. Use whatever the environment provides: a recorded read, `npx hyperframes@0.8.81 tts` (local Kokoro voices), or a text-to-speech service the user has authorized. Record the tool, voice, and script revision in `assets/manifest.json`.

Add the take as its own `<audio>` element with a unique `id`, local `src`, `data-start`, `data-duration`, and a track index. Lower the music's `data-volume` under speech so the voice is never masked; for a mixed film, keep music well below the voice rather than at equal level. Re-time shots to the recorded take, not the other way round: the storyboard should reflect what is actually spoken.

## Captions

Get word-level timings from speech recognition on the final voice take: `npx hyperframes@0.8.81 transcribe voice.wav --model small.en` (the pinned backend runs whisper.cpp locally; choose a model without `.en` for other languages), another local ASR tool, or a service that returns word timestamps. Then import:

```sh
motion-mania captions --project ./videos/launch --input transcript.json --json
```

The import accepts whisper.cpp JSON, OpenAI-style verbose JSON, a plain `[{ "text", "start", "end" }]` array, SRT, or VTT. SRT/VTT have phrase timing only, so whole cues appear without word-by-word highlighting. Words are grouped into short lines (`--max-words`, default 5) that break at sentence ends and pauses, then written to `captions.json` in the project root. Import refuses to replace an existing file without `--replace`, so edits survive.

Read the transcript. Correct misheard words, product names, and punctuation in `captions.json` directly; regroup lines where the break is awkward. The file stays editable: each group has `start`, `end`, and `words` with their own `start` times inside the group.

When `captions.json` exists, every build adds the captions to the composition: one clip per line on a free track, lines entering at their start, and each word brightening when it is spoken. The composition's timeline must be registered synchronously under its `data-composition-id` key before the page's scripts finish. Style captions from the project's CSS with custom properties on the root element:

| Property | Default |
| --- | --- |
| `--mm-caption-color` / `--mm-caption-bg` | White on 64% black |
| `--mm-caption-font` / `--mm-caption-weight` | Inherited font, 700 |
| `--mm-caption-size` | 5% of the shorter canvas side |
| `--mm-caption-bottom` / `--mm-caption-bottom-portrait` | 8% / 20% from the bottom |
| `--mm-caption-width` | 84% of the width |

Use the brand's shipped font; the render machine has no system fonts. Remove `captions.json` to turn captions off.

## Check what was said

`captions` and `plan` compare the heard words in each shot with its `narration` script. A low match means the take drifted across a cut, the recognizer misheard, or the script is stale. Fix the cause: re-time the shot, correct the transcript, or update the script to match the approved take.

`review` adds frames at the longest caption lines. Inspect them at phone size for wrapping, collisions with on-screen type, and platform UI zones. Captions that cover the focal point need a different position for that film, not smaller type.
