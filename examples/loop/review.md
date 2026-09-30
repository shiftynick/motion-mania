# Production review

36 seconds, 30 fps, 1920×1080 and 1080×1920, narration with burned-in captions. Brief: brief.md. Shot intent, narration, and intended holds: storyboard.json. Provenance, including the generator and prompt for every voice take: assets/manifest.json.

## How it was made

1. Wrote the narration per shot in storyboard.json, generated takes with the pinned HyperFrames tts (Kokoro-82M, af_heart), and timed the shots to the takes. At speed 0.9 one line ran near 200 wpm; the voice was slowed to 0.82, and that line was later rewritten ("its focal point") because its captions still read faster than 20 characters per second. `plan` reports no pace, fragment, figure, caption, or provenance warnings.
2. scripts/voice.mjs places the five takes and applies one gain change and a peak limiter. scripts/score.mjs synthesizes the 120 BPM score, one chord per shot, with cut accents, one soft whoosh per real transition, and small sounds only on visible actions.
3. Transcribed narration.wav with faster-whisper (small.en, word timestamps, VAD) into transcript.json and imported it with `motion-mania captions`. Heard words matched the script at 100% in every shot. Hand corrections in captions.json: three line onsets taken from the takes' measured leading silence (ASR placed "Your" at 0.24s, "Then" a second early, and stamped "Contact" with zero length), restored two commas, regrouped into phrases of at most 34 characters, and gave two fast lines a short lead-in.
4. Shot 4's contact sheet, cut strip, waveform, and activity chart, and shot 6's export frames, are this film's own review evidence, extracted by scripts/evidence.mjs from an earlier draft (bundle landscape-xLiKL3) and later renders. Shot 5's three findings are real findings from the rounds below.

## Review rounds

Each round was a `review --draft` bundle per format. Rounds 1–3 were judged by a fresh critic agent that saw only the bundles, the brief, and the storyboard, never the source or the builder's notes; each new critique.md carried the previous round's revisions forward for verification.

| Round | Found by | Findings | Changes |
| --- | --- | --- | --- |
| 0 | `picture`, `audio` | Frozen 2.1–3.23s, 8.37–8.97s, 26.9–27.53s with no hold intended; -15.6 LUFS, below target; the code editor collapsed its spaces | Retimed all three stretches, added a slow push that the orange frame follows, raised voice and score; fixed the editor's whitespace |
| 1 | Critic: ONE MORE PASS | A muddy stack of thumbnails as the "shutter"; icons where real frames belong; headline slot empty at every cut; four mid-transition collisions; empty right half in shot 5; weak opening; off-center vertical export | Camera flash and hard cut; real frames and data from the draft; headlines swap in place through a mask; each shot clears before the next arrives; a verdict that counts down from three open; three brief lines already typed at frame 0; centered export; darker orange text for contrast |
| 2 | Critic: ONE MORE PASS | Code editor fading in over storyboard labels; the frame handed the frozen stretch to an unrelated finding; the verdict cited a round whose real verdict was ONE MORE PASS; frozen label close to the portrait caption; small overlaps | The frozen stretch became the first finding; verdict citation removed; title swaps moved to the layout changes; frame fades off the last row instead of crossing its text; portrait evidence compacted; music eased under the brief and the critic |
| 3 | Critic: SHIP, both formats | Optional: 0.13s of bare paper before the critique, one or two headline-free frames per swap | Both polished, checked with exact frames |

The critiques are in the (uncommitted) reviews/ directory. Round 2 also exposed a toolkit gap: an unfilled check-in review broke the chain of carried-forward findings. `review` now links the most recent earlier review that recorded findings.

## Technical results

- `verify`, both formats: HyperFrames checks passed with no errors, contrast warnings, or layout warnings; three sampled forward/reverse seeks matched. Remaining lint is advisory (file size, track density, sub-composition suggestions, a repeated logo image). Titles carry `data-layout-allow-overflow` because they park outside their mask between swaps.
- `render --quality looks`: both exports 36s, 30 fps, correct dimensions, with audio.
- `audio`, both exports: -15.0 LUFS integrated, -1.5 dBTP, loudness range 3.0 LU, no warnings. The narration is held at a constant level, so whole-shot levels move only about 1.5 dB; between words the music sits about 4–5 dB lower under the brief and the critic than under the plan and the evidence.
- `picture`, both exports: no frozen stretch except the intended lockup hold at the end; no near-black frames.
- Frames decoded from both MP4s were inspected (out/encoded-proof-*.png, out/poster-*.png).

## Not inspected

Nothing was auditioned, and no reviewer played the videos: motion was judged from dense frame sequences and sound from measurements. The about 150 ms of silence before the lockup chord at 33.8s is meant as a stop before the resolution and needs a listen. Whether the brief's quieter music reads as sparse, and the voice/music balance, also need a listen. The interface is a designed illustration of the workflow, not a screen recording.
