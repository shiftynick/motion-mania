# Proposed approach

Historical architecture proposal. Version 0.1.0 implements the core workflow; see [README](../README.md) for actual commands and current limitations. The CLI uses native JavaScript ES modules to remain directly runnable without a build step. The original ideas below include deferred functionality.

## Product boundary

Motion Mania is a reusable production workflow that an existing coding agent can operate from a product repository. Begin with short product films, UI demonstrations, and motion graphics.

Its durable value should be project-specific brand context, a consistent brief-to-export workflow, review artifacts, and reusable creative recipes. An extra wrapper around existing render commands alone would not justify a new toolkit.

## Packaging options

| Option | Strength | Limitation | Recommendation |
| --- | --- | --- | --- |
| Skills with supporting scripts | Fast to start; teaches creative judgment | Tool versions and repeated mechanics can drift between projects | Start the workflow here |
| CLI alone | Stable, testable operations; usable by shell-capable agents and CI | Cannot supply creative judgment without an agent or model integration | Pair with the skill |
| Skill + small CLI | Separates judgment from execution; supports reuse | Two interfaces must stay consistent | Target architecture |
| MCP server | Useful for clients without a shell | Adds service lifecycle and another integration surface | Defer until a real consumer needs it |
| New rendering engine | Full control over frame production | Substantial browser, media, audio, and export maintenance | Build only if a prototype exposes a concrete gap |

Skills are discovered by the agent host; a CLI is discovered through PATH or an explicit executable path. Installing one does not automatically install the other. Document these separately. Shell-capable agents can invoke the CLI from any working directory; automatic skill discovery depends on the host's supported installation scope.

Keep the first release independent of a model provider. The caller supplies the agent and its reasoning; Motion Mania supplies instructions and tools. A separate prompt-to-video service with model billing and job orchestration would be a later product decision.

## Rendering backend

[HyperFrames](https://github.com/heygen-com/hyperframes) already documents HTML compositions, seekable animations, agent skills, and CLI operations for preview, snapshots, checks, and MP4 rendering. It is the first backend to evaluate. Reuse its supported composition contract instead of assuming an arbitrary `window.seek(t)` page will work unchanged.

[Remotion](https://www.remotion.dev/docs/ai/skills) offers agent guidance for creating React compositions, previewing, and rendering. Consider it if reusing React components becomes the primary requirement. Support one backend first; defer multiple adapters until a second is needed.

[Claude Animation](https://github.com/buildwithhanif/claude-animation-skill) combines a skill with Node canvas tools and inspection helpers for hand-drawn animation. It demonstrates that a skill can include executable tools; it is a different initial aesthetic from product UI films.

A custom browser + FFmpeg renderer remains an option if ownership of the rendering contract becomes the main goal. First measure whether existing tools fail the desired workflow.

## Division of responsibilities

### Agent skill

- Read the brief and gather missing creative requirements without imposing unnecessary approval rounds.
- Study supplied references and record the useful visual principles.
- Collect actual product assets and maintain a brand profile with provenance.
- Plan scenes, on-screen copy, transitions, and sound cues.
- Author or revise animation source against the chosen backend.
- Inspect rendered frames and motion; review audio when the agent supports it, otherwise identify that review as outstanding.
- Record timestamped issues, revisions, and remaining limitations.

Start with one entry skill and focused reference documents. Split into separate skills only when workflows diverge enough to justify it. Keep upstream backend documentation as the source of truth for its APIs.

### CLI

Proposed responsibilities, implemented only where they add to the backend:

- Initialize a video workspace and validate its manifest.
- Check dependencies and report actionable failures.
- Invoke the pinned backend for previews, frames, and final exports.
- Assemble review bundles: contact sheets spanning the whole film, motion strips, phone-size previews, and metadata.
- Run technical checks and report results separately from creative review.

Noninteractive commands should support explicit paths, meaningful exit codes, and machine-readable output with artifact paths. Reserve stdout for JSON in JSON mode and send progress to stderr.

### Project workspace

Store video-specific work in an explicit directory, such as:

```text
some-product/
  videos/launch/
    motion.json          # schema version, engine version, formats, duration, fps, seed
    brief.md
    brand.json
    storyboard.json
    assets/manifest.json # asset paths, origins, checksums, usage notes
    assets/...
    refs/...
    src/...              # editable backend-native composition
    reviews/...
    out/...              # generated exports and review evidence
```

Resolve manifest paths relative to the manifest, not the caller's working directory. Keep each video's dependencies isolated from the application where practical. Preserve existing agent instruction files. Shared brand profiles and templates may live in a separate library, with a versioned snapshot recorded per video.

## Proposed consumer interface

These commands are design sketches, not currently runnable commands or published packages:

```sh
motion-mania init ./videos/launch
motion-mania doctor --project ./videos/launch --json
motion-mania preview --project ./videos/launch
motion-mania review --project ./videos/launch --json
motion-mania render --project ./videos/launch --format vertical --json
```

`review` generates evidence and technical results. The agent must actually inspect it to produce a creative critique. A successful command does not mean the video looks good.

For development, invoke the built executable by absolute path from a separate fixture repo. Later, distribute a versioned package exposing `motion-mania`; package-name availability and host-specific skill installation remain to be decided.

## Engineering refinements to the article

Treat the article as inspiration rather than a tested production specification:

- Test random-access determinism by comparing decoded pixels for the same frame after different seek orders and in fresh sessions. A seeded random generator alone is insufficient if its state carries between frames. Pin browser, fonts, assets, and relevant runtime versions; do not promise identical pixels across arbitrary machines.
- Test loop continuity around the boundary. Modulo time alone cannot make a discontinuous animation seamless, and duplicating the first frame at the end can introduce a pause.
- A regular beat grid can come from declared BPM; detected beats from supplied audio need verification. Every fourth detected beat is not automatically a musical downbeat.
- Contact sheets help assess composition but do not prove smooth motion or sound synchronization. Include adjacent-frame strips and a playable draft.
- Bound critique rounds by a stated time or iteration budget and report unresolved issues. A model's numerical self-score is not an objective quality certificate.
- Make styles configurable. The article's aesthetic bans are useful defaults for certain product films, not universal design laws.
- Design each aspect ratio intentionally. Include layout checks at the target size rather than assuming a crop is sufficient.
- Save final exports atomically after validation so an encoding failure cannot replace a usable result.

## Implementation sequence

1. **Baseline film:** use the existing backend and skills to produce one short sample. Verify still capture, review artifacts, audio handling, and two layouts. Record actual friction before adding abstractions.
2. **Portable workflow:** add one Motion Mania skill, a brief template, project manifest, and review format. Repeat the process from another repo.
3. **Small CLI:** turn repeated glue into commands, with a pinned backend and useful structured errors. Prefer a single TypeScript package with internal modules initially.
4. **Verification:** test initialization without overwrites, path resolution from a different working directory, dependency failures, random-order frame stability, export metadata, and interrupted-render recovery.
5. **Reusable recipes:** add a UI morph, a feature demonstration, and a kinetic typography example once the first workflow works. Each should demonstrate distinct visual choices.

The initial success criterion is a working cross-repo production loop with inspectable artifacts. A GUI, cloud rendering, paid asset generation, multiple engines, and an MCP server can follow demonstrated demand.
