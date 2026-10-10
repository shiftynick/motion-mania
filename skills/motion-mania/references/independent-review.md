# Independent review

The agent that built a film is a weak judge of it. It knows what each shot was meant to show and tends to see that intent in the frames. When the host can start a separate agent or model session, have a fresh critic review each round. Without one, do the review yourself, and say so in the delivery.

This loop is adapted from the builder/critic "Gauntlet" loop in [motion-video-kit](https://github.com/echris6/motion-video-kit).

## Rules

1. **Set the bar first.** The brief states the audience, the observable benefit, and what "done" means. The critic judges against that, not against its own taste.
2. **The builder never grades its own round.** Start a new critic for every review. First give it only the contact sheet, without the brief, product explanation, filenames that reveal the message, or builder notes. Ask for one sentence stating what the film says and for whom, and save that answer before revealing the context. If it does not match the brief’s intended message, the film fails this round regardless of polish. Then give it only:
   - the review bundle directory (frames, sheets, strips, `draft.mp4`, `waveform.png`, `activity.png`, `report.json`, `critique.md`);
   - `brief.md`, `brand.json`, and `storyboard.json`;
   - the user's own feedback, quoted exactly;
   - for a verification round, the previous `critique.md` (the new `critique.md` links to it and copies its revisions).

   Leave out your reasoning, and your list of what you think you fixed. The critic must find problems itself.
3. **Judge rendered evidence.** The critic works from the images, the draft, and the measurements. It may capture more with `motion-mania frame --at <t>` or `review --around <times>`, or with FFmpeg on `draft.mp4`. It doesn't read the source to decide whether something works. Watch the draft muted before assessing sound: can a viewer still follow the benefit, causal actions, and intended next step? Record a muted-viewing result separately from listening; if playback is unavailable, record a frames-only assessment and leave muted playback outstanding.
4. **Fix the largest gap first.** A weak opening isn't made up for by strong shots later. Change a few high-impact things per round, not everything.
5. **Verify, don't assume.** The next round's critic marks every previous revision FIXED, PARTLY, or STILL PRESENT in `critique.md`, then looks for regressions. Fixes often create new defects: a moved object now crosses a headline, or a covered element loses its stacking order.
6. **Stop** when the bar is met, when the remaining items are cosmetic, when the agreed budget runs out, or when the user says so. Don't stop just because a set number of rounds has passed.
7. **Keep the trail.** Each review directory keeps its bundle and critique, so the sequence of critiques is the record of what was found, what changed, and what was measured. Summarize it at delivery.

## Round types

| Round | Evidence | Critic focus |
| --- | --- | --- |
| Storyboard | `storyboard.json`, `plan` output, brief | Chronology, truthfulness of claims, a distinct job for each shot, filler, whether the action is clear on mute |
| Component | `frame` captures or a short `review --draft` of one scene | Readability, collisions, pops, materials, and what information the element adds |
| Full film | `review --draft` bundle | Blind restatement, muted comprehension, holds, empty space, transitions, text collisions, pacing, product clarity, sound |
| Verification | New bundle + previous critique | FIXED / PARTLY / STILL PRESENT for each item, new regressions, then SHIP or ONE MORE PASS |

## Critic prompts

Fill the `<>` slots and send each to a fresh agent. Keep your own reasoning out of the prompt.

### Frames-only restatement

Run this first, before sending the full-film prompt or revealing context. A previously briefed critic cannot perform this blind test.

```text
You have not seen the brief. Open only <contact-sheet.png>. In one sentence, state what this film says and who it is for. State uncertainty if the frames do not make that clear. Do not read other files or infer from their names.
```

### Full film

```text
You are an independent critic. You did not build this film; judge rendered evidence and measurements, not intentions.

Review bundle: <reviews/landscape-XXXX>. It contains contact-sheet.png, phone-preview.png, transition-N.png strips around each cut, frames/, draft.mp4, waveform.png (audio with cuts), activity.png (frame change with cuts; shaded holds are frozen), report.json, and critique.md.
Film: <duration>s, <dimensions>, <what the product is and what the film should make the viewer understand or do>.
Brief: <path to brief.md>. Brand: <path to brand.json>. Storyboard: <path to storyboard.json>.
The user's criteria, verbatim: <quote>.

Method: compare your saved frames-only restatement with the brief; a message/audience mismatch fails this round regardless of polish. Open every image. Watch draft.mp4 muted first and record whether the benefit, causal actions, and next step make sense. Then play with sound if you can; if you can't, say so and leave muted playback/listening outstanding. Capture more frames with `motion-mania frame --project <dir> --at <t>` or `motion-mania review --project <dir> --around <times>` wherever the bundle doesn't show enough. Read the picture and audio measurements in report.json.

Write your findings into <critique.md>: an observation with a timestamp for each shot, then the prioritized revisions table (6–8 rows at most, highest impact first, each concrete enough to implement). Cover: whether the opening earns attention, whether the benefit is shown as an event rather than claimed, frozen or empty stretches, text collisions (including mid-transition), transitions that carry nothing across, phone-size readability, and whether sound lands on the moments that matter. Mark each inspection you actually performed. Be blunt; no padding.
```

### Verification

```text
You are an independent critic; you did not build this. New review bundle: <reviews/landscape-YYYY>. Its critique.md lists the previous round's revisions under "Previous findings". <Shots that moved, e.g. "Shot 3 now runs 4.2–6.8s".>

For every previous item, fill in FIXED, PARTLY, or STILL PRESENT with a timestamp and the frame that shows it. Repeat the muted-viewing check. For a new frames-only restatement, use another critic who has not seen the brief; compare its saved sentence with the intended message. Then list any new defects: glitch frames, overlaps, clipped text, awkward in-between frames, and sound that no longer lands. Put unresolved and new items in the prioritized revisions table. End the critique with SHIP or ONE MORE PASS (and at most 3 fixes).
```

### Storyboard

```text
Review this storyboard for a <length>s film about <product>. You did not write it. Brief: <path>. Storyboard: <path>. Plan output: <path or pasted JSON>.
Check whether the order of events matches how the product really works, whether every claim is supported, whether each shot has a distinct composition and job, which shots are filler, and whether the intended action is unmistakable with the sound off. Return a ranked list of problems, each with one concrete fix.
```

## What a critic should expect to find

These defects were missed by the agents that built them and caught by fresh critics. Look for them:

- A one-frame pop when a layer starts moving: an ease-out starts at full speed. Use an ease-in-out, or a short ramp in.
- A wipe that splices two titles into one word. The outgoing title should leave before the wipe, and the incoming one should arrive after it.
- A card or panel that goes blank for a few frames between states. Crossfade the contents in place.
- Text flying through other text during a move. Fade it out, then in at the destination.
- An overlay that drifts out of alignment because its parent has a slow scale push. Apply the same transform to both.
- Near-black frames at a scene change, which read as a dead screen on a phone.
- Frame 0 showing a half-entered word or an empty background, rather than a finished composition.
- Long frozen stretches that no technical check flagged. `activity.png` and the picture warnings show where they are.
- Music that fades out before the logo lands, or sound effects that stick out of the mix.
