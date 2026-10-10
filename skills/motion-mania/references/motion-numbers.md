# Motion starting values

Use these to establish a motion identity before building the timeline: one signature ease, three duration tiers (for example 0.2 / 0.45 / 0.8s), and one entrance pattern. Keep that identity across shots. These are craft defaults, not measured laws or quality gates; useful references disagree. Change them deliberately when rendered evidence or the brief calls for it.

## Ease by role

| Role | GSAP starting ease | CustomEase control points |
| --- | --- | --- |
| Entrance: arrive and settle | `power3.out` | `0.16,1,0.3,1` |
| Exit: accelerate away | `power3.in` | `0.7,0,0.84,0` |
| On-screen move: leave, travel, land | `power3.inOut` | `0.65,0,0.35,1` |
| Continuous progress, caret travel, steady loop | `none` | Linear; no custom curve needed |

The custom points correspond to CSS `cubic-bezier(0.16, 1, 0.3, 1)`, `cubic-bezier(0.7, 0, 0.84, 0)`, and `cubic-bezier(0.65, 0, 0.35, 1)`. GSAP's power eases are alternatives, not exact equivalents. Use [locally vendored CustomEase](gsap-plugins.md) for those curves. Linear movement usually makes an arriving object feel mechanical; it can suit a deliberate constant-speed camera drift.

## Time and amplitude

| Element or event | Starting range |
| --- | --- |
| Small state change, click feedback, emphasis | 0.12–0.25s |
| Label, word group, small card entrance | 0.3–0.5s |
| Large panel, focal object, layout handover | 0.55–0.9s |
| Exit | About 2/3–3/4 of its entrance duration |
| Stagger | 0.04–0.1s between starts; budget about 0.5s for the whole sequence of starts |
| Settled pause between moves | 0.1–0.2s before the next move; reading holds need additional time |
| Number count-up | About 1s, easing out, followed by a readable hold |

For similar objects, grow travel time roughly with the square root of distance: four times the travel gets about twice the duration. Clamp it to the shot's purpose; a tiny label and a camera move need different baselines. Count-ups should resolve to the sourced value, with formatting derived from the tween's current value rather than accumulated increments.

Use no overshoot for premium or serious beats. For confirmation, try a small overshoot (about 2–4% scale or travel); for celebration, try 5–10%, then inspect the peak and landing. A `back` ease's parameter is not a percentage. A short anticipation in the opposite direction, about 5–10% of the main travel over 0.08–0.15s, can explain a large action; omit it when it delays the message.

Secondary motion can start 0.05–0.12s after the primary, at about 10–25% of its amplitude. Keep roughly a third or fewer of the visible elements moving at once so the viewer can follow the focal event. These budgets include letters: a headline stagger can spend all of them.

Scale is perceptual. A linear scale tween covers equal numeric increments but smaller relative changes as it grows, so a large zoom can look as though it decelerates. For a steady perceived zoom, scale should grow by equal ratios (an exponential progression); shape a deliberate arrival or departure around that baseline. Small scale emphasis rarely needs this correction.

Review the first frame, anticipation, peak, landing, settled hold, and adjacent cut frames. The film's motion identity should help the message, not postpone the opening or turn every shot into the same reveal.
