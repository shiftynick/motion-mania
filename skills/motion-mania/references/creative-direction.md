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

Mechanisms that connect shots well:

- **The foreground becomes the transition.** A headline, logo, or shape scales through the camera while the next scene is already in place underneath, so there is no empty gap between shots.
- **One persistent actor.** A selected card, cursor, frame, or shape keeps its identity across shots. A sequence of unrelated reveals feels like a slideshow, however well each one is animated. Hand it over at the exact pixel position, so the last frame of one shot and the first frame of the next agree.
- **Change speed; don't drift.** A move between positions should land where the viewer can read, then leave quickly; at a constant rate it does neither. A slow push on a held frame is different: it keeps the frame alive while the viewer reads.
- **Hard cuts work when something matches.** Subject, scale, direction, or material continues across the cut, and motion carries on after it.
- **Cause, then effect.** A click produces a state, a scan produces results, an input produces an output. Every animated action should visibly produce something.
- **Layer the motion.** One primary move, supporting staggers on secondary elements, and small tertiary details, overlapping. Starting and stopping the whole frame on every beat reads as mechanical.

These are a vocabulary, not a required style. A calm film may rely on held frames; say so in the storyboard with the shot's `hold` field, and `review --draft` will report frozen stretches only where no hold was intended.

In GSAP, `fromTo` can apply its initial state before its scheduled start. Hidden future cards should start with opacity 0, or use a deliberate immediate-render strategy; inspect time zero and reverse seeks. Set simple initial opacity per selector or in CSS so the static checker can understand it. Avoid simultaneous CSS transforms and GSAP transforms on the same element.

## Sound has a job

Decide whether sound supplies rhythm, emphasis, atmosphere, explanation, or intentional silence. Align a few meaningful changes with musical accents; avoid adding a whoosh to every move. Keep provenance for music and effects. Use a held tail or intentional ending rather than an abrupt truncation.

Choose music for the film's audience, not for the genre of its references. An energetic launch score can feel wrong under a calm consumer product. Calm music still needs a pulse: a beatless ambient bed feels sleepy against quick cuts. Avoid vocals, trailer hits, and drops unless the brief calls for them.

Keep sound effects sparse and clean:

- At most one short, soft whoosh per real transition. Long or boomy whooshes, with much of their energy below about 150 Hz, sound like a repeated thud.
- Small UI sounds only on actions that visibly happen: a click on a click, a tick when a label lands, one chime on a confirmation.
- Set each effect against the music in its own frequency range. A tick can barely move overall loudness yet still jump out, especially at 2–8 kHz.
- Keep repeated sounds at a consistent level, and soften sounds that fall within about 0.15s of each other so they don't stack.
- If the music resolves on the logo, don't add a separate sting on top.

When the user objects to a sound, render a music-only version to find out which layer it's in before changing anything. Brushed snares and risers in the score can sound like whooshes. Change one thing per round and name it by timestamp. Keep the music-only mix as a deliverable fallback.

The default target of -14 LUFS suits punchy web video. Calm films often sit better around -16 to -19 LUFS with the effects clearly audible, and a dense effects layer mastered at -14 can feel too loud. Set `loudness` in `motion.json` to the level you choose. `audio` warns when the loudness range falls below 1.5 LU: a mix that barely varies can sound like a constant wall. Calm beds usually vary by 1.5–3 LU, and energetic scores by more.

Audio stream presence, loudness measurements, and listening are different checks. Report which actually happened. `motion-mania audio` measures loudness against the target and draws a waveform with shot boundaries: use it to confirm that planned accents land on cuts and that the ending resolves rather than truncates. For a voiceover, write the narration before animating to it; see [narration and captions](narration.md). The revised demo's score script demonstrates seeded synthesis and loudness normalization; it is not a requirement to synthesize every soundtrack.

## Critique observable defects

Read the shot's intent, then inspect the corresponding keyframe and transition strip from the generated report. Watch playback when supported. Use specific findings:

| Weak critique | Actionable critique |
| --- | --- |
| “Needs more polish” | “At 3.4s the code and subtitle compete; enlarge the code and remove the redundant subtitle.” |
| “More dynamic” | “The last three shots use the same slide entrance; carry the selected frame into the export layout.” |
| “Feels cramped” | “At phone size the bottom label touches the edge; recompose that card for portrait.” |
| “Audio is good” | “Audio was not auditioned; metadata and loudness only were checked.” |
| “Sound is off” | “The 6.5s cut has no accent within 200 ms; move the hit to the cut or cut on the next beat.” |
| “Transition is messy” | “At 4.1s the wipe splices both titles into one word; clear the outgoing title before the wipe starts.” |
| “Feels jumpy” | “At 2.0s the panel appears in one frame because its ease-out starts at full speed; ramp it in.” |
| “Drags in the middle” | “`activity.png` shows 7.8–10.5s frozen with no hold intended; add a slow push or cut 1.5s.” |

Prioritize: wrong message or weak proof; unreadable/colliding content; disconnected shots; timing and sound; then small finishing details. [Independent review](independent-review.md) lists defects that builders repeatedly miss, and explains how to hand each round to a fresh critic. Pick a few high-impact revisions, render the affected moments, and compare against the earlier evidence. Preserve earlier exports when the user may want a comparison. Do not label a film “premium” or “approved” because the renderer passed or a self-assigned score increased.

## Worked direction: Motion Mania v2

The repository's `examples/launch-v2` demonstrates a persistent orange surface becoming code, motion, a review frame, and two output formats. Large typography carries the argument; the graphic is the demonstration. Its `storyboard.json` records each shot's goal, focal point, transition, sound, and review time. `src/scene.js` implements the transformations; `scripts/score.mjs` creates the original score. See `docs/video-v2-review.md` for evidence and limitations. This is a designed explanation of the workflow, not a screen recording of the CLI.
