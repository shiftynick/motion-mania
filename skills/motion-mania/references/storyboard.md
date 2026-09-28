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

This fragment shows one shot; the full array must cover the film. Required fields: finite `from`/`to`, nonempty `name`/`action`. Shots must be ordered, positive length, within the duration, and cover it without gaps or overlaps beyond one frame of rounding tolerance. Limit: 120 shots. An optional `reviewAt` must be inside its shot; the default is the midpoint. `copy`, `goal`, `focalPoint`, `transition`, and `sound` preserve intent. Other fields such as `bpm` are allowed; they do not automatically retime or generate anything.

Missing intent generates questions, not a failing quality grade. Copy above three words per second generates a reading-time warning; the actual hold, type size, audience, and language still determine readability. Explicit silence is a valid sound choice.

`review` automatically combines uniform first-to-last samples with every shot's `reviewAt`, plus nine consecutive frames around each cut. Up to 24 cuts are sampled automatically; larger boards disclose that limit. `--around` replaces automatic cut selection when focusing a revision. It does not remove the overview or shot keyframes. The JSON report embeds the storyboard and selected transition times; `critique.md` includes each shot's intent and space for observed evidence and revisions.

Existing projects without a storyboard still get uniform review samples. A present but invalid storyboard fails clearly so stale timings are not silently used. `plan` requires a storyboard. Storyboard timing validation does not establish that the source implements those shots: compare the generated images against the plan.
