# Creative direction and revision

Use this when developing a film or responding to “make it better.” It guides decisions; it is not a mandatory visual style.

## Turn a benefit into visible evidence

Write one sentence: **For [viewer], show [observable change] so they [intended action].** Choose a visual event that proves that change. “Fast workflow” is a claim; a source edit becoming an output is an event. For a real product, use actual UI/assets where available. Label explanatory mockups as such; don't invent product features or performance figures.

Pick the organizing idea before animation polish. Examples: one object transforms through the workflow; a messy state resolves into an ordered result; a product detail expands into the benefit. Distinct shots need different jobs, not merely different headlines.

If a direction is uncertain, compare two brief concepts in the working notes, choose one using the audience and assets, and continue. Do not require extra user approval for routine creative choices.

## Make a visual grammar

Study supplied references for type scale, spacing, composition, cut rhythm, object continuity, and sound. Extract a few principles and record them in the brief. Use references the agent has actually inspected; do not cite unseen videos as stylistic evidence.

Choose a type hierarchy, palette, repeated shape/material, and motion behavior that suit the product. The orange demo is not a default brand for every film. Aim for one dominant subject per shot, with secondary information read after it. Negative space should direct attention rather than merely fill an empty template.

Render a hook, a representative proof shot, and the ending before polishing the whole film. Check the supplied copy in the actual font and both target aspect ratios. Recompose portrait deliberately; scaling a wide composition often shrinks the subject or distorts type.

## Connect the shots

Use a recurring element only when it helps tell the story: code panel → rendered composition → selected review frame → export. Preserve a recognisable position, color, shape, or movement across the change. A transition should move attention toward the next idea.

Vary the pacing: arrival, readable hold, departure. Keep decisive transitions short enough to feel purposeful, and allocate settled reading time to important copy. Don't animate every object continuously. A still ending can give the brand or action room to register.

In GSAP, `fromTo` can apply its initial state before its scheduled start. Hidden future cards should start with opacity 0, or use a deliberate immediate-render strategy; inspect time zero and reverse seeks. Set simple initial opacity per selector or in CSS so the static checker can understand it. Avoid simultaneous CSS transforms and GSAP transforms on the same element.

## Sound has a job

Decide whether sound supplies rhythm, emphasis, atmosphere, explanation, or intentional silence. Align a few meaningful changes with musical accents; avoid adding a whoosh to every move. Keep provenance for music and effects. Use a held tail or intentional ending rather than an abrupt truncation.

Audio stream presence, loudness measurements, and listening are different checks. Report which actually happened. The revised demo's score script demonstrates seeded synthesis and loudness normalization; it is not a requirement to synthesize every soundtrack.

## Critique observable defects

Read the shot's intent, then inspect the corresponding keyframe and transition strip from the generated report. Watch playback when supported. Use specific findings:

| Weak critique | Actionable critique |
| --- | --- |
| “Needs more polish” | “At 3.4s the code and subtitle compete; enlarge the code and remove the redundant subtitle.” |
| “More dynamic” | “The last three shots use the same slide entrance; carry the selected frame into the export layout.” |
| “Feels cramped” | “At phone size the bottom label touches the edge; recompose that card for portrait.” |
| “Audio is good” | “Audio was not auditioned; metadata and loudness only were checked.” |

Prioritize: wrong message or weak proof; unreadable/colliding content; disconnected shots; timing and sound; then small finishing details. Pick a few high-impact revisions, render the affected moments, and compare against the earlier evidence. Preserve earlier exports when the user may want a comparison. Do not label a film “premium” or “approved” because the renderer passed or a self-assigned score increased.

## Worked direction: Motion Mania v2

The repository's `examples/launch-v2` demonstrates a persistent orange surface becoming code, motion, a review frame, and two output formats. Large typography carries the argument; the graphic is the demonstration. Its `storyboard.json` records each shot's goal, focal point, transition, sound, and review time. `src/scene.js` implements the transformations; `scripts/score.mjs` creates the original score. See `docs/video-v2-review.md` for evidence and limitations. This is a designed explanation of the workflow, not a screen recording of the CLI.
