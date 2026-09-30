# Storyboard preflight

`motion-mania plan --project ./videos/launch --json` reads `storyboard.json`, checks its timing against `motion.json`, and returns questions for missing creative intent. It does not call a model, inspect rendered pixels, or decide whether the idea is good.

```json
{
  "bpm": 120,
  "shots": [
    {
      "from": 0,
      "to": 3,
      "name": "Hook",
      "copy": "MAKE IT MOVE.",
      "action": "A slash opens into the surface used in the next shot.",
      "goal": "Make the viewer curious about turning an idea into motion.",
      "focalPoint": "The large two-line headline, followed by the orange slash.",
      "transition": "Keep the slash on screen as it expands into a code panel.",
      "sound": "Opening impact, then a rising accent into the panel.",
      "reviewAt": 1.5
    }
  ]
}
```

This fragment shows one shot; the full array must cover the film. Required fields: finite `from`/`to`, nonempty `name`/`action`. Shots must be ordered, positive length, within the duration, and cover it without gaps or overlaps beyond one frame of rounding tolerance. Limit: 120 shots. An optional `reviewAt` must be inside its shot; the default is the midpoint. `copy`, `narration`, `goal`, `focalPoint`, `transition`, and `sound` preserve intent. `hold` (`true` or a short reason such as `"Reading time for the price"`) marks a shot whose frame is meant to stay still. `picture` and `review --draft` won't flag frozen stretches inside it. `narration` is the line spoken during the shot; see [narration and captions](narration.md). Other fields such as `bpm` are allowed; they do not automatically retime or generate anything.

Missing intent generates questions, not a failing quality grade. Copy above three words per second generates a reading-time warning; the actual hold, type size, audience, and language still determine readability. Narration above about 160 words per minute generates a pace warning, and three or more consecutive spoken fragments of one to three words generate a style warning. Figures (digits, percentages, multipliers) in copy or narration generate a reminder to confirm each against a source. Explicit silence is a valid sound choice.

When `captions.json` exists, `plan` also validates it and compares the words heard in each shot with that shot's narration. It also reports gaps in `assets/manifest.json`.

`review` automatically combines uniform first-to-last samples with every shot's `reviewAt`, plus nine consecutive frames around each cut. Up to 24 cuts are sampled automatically; larger boards disclose that limit. `--around` replaces automatic cut selection when focusing a revision. It does not remove the overview or shot keyframes. The JSON report embeds the storyboard and selected transition times; `critique.md` includes each shot's intent and space for observed evidence and revisions. It also includes the previous review's revisions, ready to be verified.

Existing projects without a storyboard still get uniform review samples. A present but invalid storyboard fails clearly so stale timings are not silently used. `plan` requires a storyboard. Storyboard timing validation does not establish that the source implements those shots: compare the generated images against the plan.
