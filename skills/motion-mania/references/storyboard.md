# Storyboard preflight

`motion-mania plan --project ./videos/launch --json` reads `storyboard.json`, checks its timing against `motion.json`, and returns questions for missing creative intent. It also scans authored source for timeline risks and unrecorded on-screen copy. It does not call a model, render, inspect pixels, or decide whether the idea is good. Run `motion-mania lint` during authoring for the full static report, including HyperFrames findings.

```json
{
  "bpm": 120,
  "beatOffset": 0,
  "shots": [
    {
      "from": 0,
      "to": 3,
      "name": "Hook",
      "copy": ["MAKE IT MOVE.", "Your code becomes a film."],
      "narration": "Your code becomes a film you can inspect.",
      "action": "A slash opens into the surface used in the next shot.",
      "goal": "Make the viewer curious about turning an idea into motion.",
      "focalPoint": "The large two-line headline, followed by the orange slash.",
      "transition": "Keep the slash on screen as it expands into a code panel.",
      "sound": "Opening impact, then a rising accent into the panel.",
      "reviewAt": 1.5,
      "anchor": { "text": "film", "at": 1.2 },
      "assertions": [
        { "kind": "appearsBy", "selector": "#headline", "bySec": 0.5 },
        { "kind": "staysInFrame", "selector": "#headline" }
      ]
    }
  ]
}
```

This fragment shows one shot; the full array must cover the film. Required fields: finite `from`/`to`, nonempty `name`/`action`. Shots must be ordered, positive length, within the duration, and cover it without gaps or overlaps beyond one frame of rounding tolerance. Limit: 120 shots. An optional `reviewAt` must be inside its shot; the default is the midpoint. `copy`, `narration`, `goal`, `focalPoint`, `transition`, and `sound` preserve intent. `hold` (`true` or a short reason such as `"Reading time for the price"`) marks a shot whose frame is meant to stay still. `picture` and `review --draft` won't flag frozen stretches inside it. `narration` is the line spoken during the shot; see [narration and captions](narration.md).

Missing intent generates questions, not a failing quality grade. `copy` accepts a string or an array of lines. Strings split on newlines and sentence boundaries; arrays preserve your chosen line breaks. Each line has an estimated reading floor of `max(0.70, 0.25 + characters / 17)` seconds and a comfortable standalone target of `0.3 * words + 1.5` seconds. `plan` sums the floors and warns when the shot is shorter, stating the missing time. `shots[].reading` reports the lines, floors, comfortable targets, and summed floor. These are authoring heuristics, not measurements; actual settled hold, type size, audience, language, and simultaneous text still determine readability.

Narration above about 160 words per minute generates a pace warning, and three or more consecutive spoken fragments of one to three words generate a style warning. Figures (digits, percentages, multipliers) in copy or narration generate a reminder to confirm each against a source. Explicit silence is a valid sound choice.

## Beat grid

Optional `bpm` is positive and at most 1000. `beatOffset` is the first beat's composition time in seconds (default 0; negative values are allowed for trimmed music). These names match the `beats` report. Convert file-relative detection times by adding the music clip start and subtracting its media trim. Every internal shot entrance is checked against whole, half, and quarter beats. Each cumulative beat time is calculated from the original offset and rounded once to the film's frame grid. A cut more than one frame away produces a warning with the nearest beat time and signed frame offset. `beatGrid` records `shot`, `time`, `nearestBeat`, `nearestFrame`, `offsetFrames`, and the quarter-beat `subdivision` index.

Set `offBeat: true` or a reason such as `"Title deliberately anticipates the accent"` on the incoming shot to skip that entrance. The grid does not establish musical meter, downbeats, changing tempo, or whether a cut feels right. It does not retime or generate source or sound.

## Measured narration

When `captions.json` exists, `plan` validates it and compares the words heard in each shot with its narration. The existing per-shot word match remains visible. An additional ordered alignment of the whole script to the transcript keeps words associated with their planned shot when speech crosses a cut. With at least 80% script coverage, it reports the first aligned word's start and last aligned word's end, and warns about speech before the shot, after it, or less than 0.15s of leading/trailing pad. `captions.narration[]` adds `coverage`, `boundsComplete`, `start`, `end`, `leadingPad`, and `trailingPad`. Missing end times leave the trailing bound unknown. Unmatched leading/trailing script words set `boundsComplete: false` and leave the complete take's edges uncertain. Low coverage leaves measured bounds uncertain; it must not be treated as a complete take. Repeated wording or recognition errors can misalign even a high-coverage line.

Optional `anchor: { "text": "film", "at": 1.2 }` declares the composition time of a key visual and a word/phrase from that shot's narration. The matched phrase must occur once in the aligned line. The default heuristic window permits the visual from 1.8s before to 0.2s after its first spoken word, preferring about 0.6s before. Optional nonnegative `before` and `after` change that window. `at` must be inside the shot. The measured report includes `anchor.wordAt`, signed `offset`, and `preferredAt`. This checks declared timing; it does not establish when the source actually reveals the visual.

A voice take without timings cannot locate each shot's spoken words. Import a transcript to measure its bounds; `plan` does not run speech recognition or infer words from audio duration. It also reports gaps in `assets/manifest.json`.

## On-screen copy

`copyProvenance.findings` concentrates on version/release stamps, scene numbering, timecode HUDs and common metrics, even when listed in the written context. It groups sourcing questions by category with a count, up to three examples and file locations. Other visible HTML lines and literal JavaScript text assignments absent from the brief, storyboard, brand or captions produce one aggregate reminder. These are warnings, not proof of invented text. Browser titles, scripts, styles, explicitly hidden ancestors and code/pre blocks are skipped. Dynamic interpolation, images, CSS-generated text, animated visibility and computed labels require visual review.

Use a local `motion-mania-ignore copy_provenance: reason` comment for intentional illustrative labels or measured evidence; see [lint waivers](authoring.md#static-lint). `sourceLint` reports the fast source checks and their waivers; `lint` also runs the backend's broader checks. Neither replaces `verify`.

## Motion assertions

Optional shot `assertions` contains up to 32 objects per shot. Prepared CLI compositions receive a generated `.motion/.../index.motion.json` sidecar, separate from the project's `motion.json` manifest. Author the intent in the storyboard, not in the disposable sidecar. `verify` lets HyperFrames discover the sidecar, samples tween transitions with `--at-transitions`, and returns `motion` and structured `findings`, including failed assertion codes/selectors/messages. Failed assertions are errors.

Choose `reviewAt` inside each settled reading hold: these frames gate geometric layout errors in `verify` (shot midpoints by default; nine uniform midpoints without a storyboard). Geometry found only at other transition samples is advisory, with its original severity and time range retained; flash occlusions, masks and exiting text can be intentional. Runtime/contract errors, failed assertions, explicit caption-zone errors and seek mismatches still fail. This sampling policy can miss an unsampled settled defect; it does not waive unreadable transitions or replace rendered review.

- `{"kind":"appearsBy","selector":"#headline","bySec":0.5}` requires first sampled visible ancestor-chain opacity of at least 0.5 by that many seconds from the shot's start. The deadline must be inside the shot; the builder converts it to composition seconds. An earlier appearance also passes.
- `{"kind":"before","a":"#headline","b":"#cta"}` requires A's first sampled visible appearance to precede B's strictly. A visible while B never appears passes; pair with `appearsBy` when B is required to appear. Simultaneous first appearances fail.
- `{"kind":"staysInFrame","selector":"#card"}` checks the visible bounding box after its first appearance, with 1 CSS pixel of overflow tolerance. A matched but always-hidden element passes; pair with `appearsBy` when visibility is required. Hidden intervals are skipped (display/visibility, collapsed boxes, or ancestor-chain opacity below 0.2).
- `{"kind":"keepsMoving","withinSelector":"#actor","maxStaticSec":2}` rejects unchanged sampled DOM motion signatures lasting longer than the threshold. Omit `withinSelector` for the whole composition; literal `"*"` is not accepted. Default threshold: 2s. This measures quantized DOM appearance/geometry and video time, not decoded MP4 pixels; canvas content can move without changing that signature.

Selectors for appearance/order/frame assertions must match exactly one element. Missing or ambiguous selectors fail. These assertions are associated with a shot for intent, but the backend has no per-shot sampling window: all four evaluate composition-wide. `keepsMoving` includes time when the scope is hidden, including before/after its shot; use it for a persistent actor or choose a threshold that includes deliberate holds. `hold` does not waive a motion assertion. Motion sampling is about 20 Hz, capped at 300 samples for the whole film, not frame-exhaustive. `appearsBy` deadlines should allow a sampling margin. Assertions do not establish readability, causality, or creative quality.

## Review

`review` automatically combines uniform first-to-last samples with every shot's `reviewAt`, plus nine consecutive frames around each cut. Up to 24 cuts are sampled automatically; larger boards disclose that limit. `--around` replaces automatic cut selection when focusing a revision. It does not remove the overview or shot keyframes. The JSON report embeds the storyboard and selected transition times; `critique.md` includes each shot's intent and space for observed evidence and revisions. It also includes the previous review's revisions, ready to be verified.

Existing projects without a storyboard still get uniform review samples. A present but invalid storyboard fails clearly so stale timings are not silently used. `plan` requires a storyboard. Storyboard timing validation does not establish that the source implements those shots: compare the generated images against the plan.
