# Production review

28 seconds, 30 fps, 1920×1080 and 1080×1920, narration with burned-in captions. Brief: brief.md. Shot intent and narration: storyboard.json. Provenance, including the generator and prompt for every voice take: assets/manifest.json.

## How it was made

1. Wrote the narration per shot in storyboard.json before animating. The first takes (Kokoro-82M, voice af_heart) ran near 200 wpm, too rushed for a film about calm; lines were shortened and the voice slowed to 0.8. `plan` reports no pace, fragment, or figure warnings.
2. scripts/voice.mjs places the four takes, applies one measured gain change and a fast peak limiter for plosives: -17.4 LUFS, -3.9 dBTP (mono).
3. scripts/score.mjs synthesizes the score. Storm pings use the same arrival curve as src/scene.js, so each card lands on its ping.
4. Transcribed narration.wav with faster-whisper (small.en, word timestamps, VAD) into transcript.json and imported it with `motion-mania captions`. Heard words matched the script at 100% in every shot. Hand corrections in captions.json: first-word onsets taken from silence detection (ASR had stretched "Every" back to 0.69s and stamped "Lull" as 0.02s long), restored two commas, and regrouped into phrases of at most 33 characters so portrait lines do not strand a single word.

## Review findings and revisions

- Captions rendered at the top of the frame. Cause: this project's `#film > .clip { inset: 0 }` outranked the toolkit's caption placement. Fixed in the toolkit (caption placement is now `!important`) with a regression test.
- The digest card was wider than the ring holding it; the ring now holds at 1.4× during the lull.
- Vertical: the gold card dropped through the headline at 19.4s. It now enters from the right on the same path as a ghost card and crosses the ring where the ghost stopped. Checked with adjacent-frame strips at 19.37–19.63s.
- A faint gold ring was visible behind every calm shot: the breakthrough shockwave's `fromTo` rendered its start values at construction. Gold is reserved for the breakthrough; fixed with `immediateRender: false`.
- The strict render gate stopped two cold-seek bugs (`.wave`, `.gold-card` missing `opacity: 1` in destination values). The ghost cards had the same issue behind a dynamic selector the linter could not see; fixed as well.
- The waveform showed the "soft" sub swell at the 6s cut peaking as loud as the storm. Lowered it; the lull shot now measures within 0.5 dB of the storm, with the voice dominant in both.
- Contrast: app icons, badges, and timestamps darkened to pass WCAG AA.

## Technical results

- `verify`, both formats: HyperFrames checks passed with no lint errors; three sampled forward/reverse seeks matched. The storm cards carry `data-layout-ignore` (an intentional overlapping collage) and the wordmark letters `data-layout-allow-overlap` (tight kerning). Captions remain audited; one info-level transient remains, a ghost card crossing the landscape caption band at 19.4s.
- `render --quality looks`: both exports 28s, 30 fps, correct dimensions, with audio.
- `audio`, both exports: -14.7 LUFS integrated, -1.8 dBTP, loudness range 9.8 LU; no silences flagged mid-film, no abrupt ending. No energy rise is detected at the four cuts: the 6s cut is a hard stop into a swell, and the later cuts are slow pad crossfades by design.
- Frames decoded from both MP4s were inspected (out/encoded-proof-*.png).

## Not inspected

Nothing was auditioned. The voice, the mix balance, and the score were measured, not listened to. The storm pings under the first narration line may compete with the voice; that needs a listen.
