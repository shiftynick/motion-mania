# Contributing

Bug reports, reproducible rendering failures, and improvements demonstrated by real productions are welcome. Discuss a new engine, hosted service, or major CLI change in an issue before implementing it.

## Develop

Use Node.js 22+, FFmpeg/FFprobe, and Chrome/Chromium.

```sh
git clone https://github.com/shiftynick/motion-mania.git
cd motion-mania
npm ci
node src/cli.js browser
npm run check
```

`npm test` runs fast unit tests. `npm run test:integration` creates a disposable consumer repository and actually captures, verifies, and renders a film, including export failure recovery. `npm run test:package` installs the npm tarball in a temporary consumer directory and checks its CLI, skill, starter, and browser capture. Rendering tests require the external tools; do not skip them for release changes.

## Exercise the review loop

[test/fixtures/flawed](test/fixtures/flawed/README.md) is an intentionally defective six-second film. It renders in both formats; `defects.json` records the planted problems and capture times. Use it to evaluate a check or a fresh critic, then compare findings with the answer key. Keep the answer key out of the critic's context. The fixture is outside the npm `files` allowlist. One integration regression checks the intended automated findings and proves that settled layout errors still fail; it does not require the fixture to become a passing production film.

For skill changes, keep `SKILL.md` short and put depth in references. Treat motion numbers as starting values, and validate plugin recipes with real forward/reverse seek comparisons and frame inspection. Note which plugins and settings were tested. Preserve the demo as an example, not a required style.

The same `skills/motion-mania/` directory feeds the npm copy command, the skills CLI, and the Claude Code plugin. Keep its `metadata.version` and `.claude-plugin/plugin.json` version aligned with `package.json` at release time. Validate distribution manifests with `claude plugin validate .claude-plugin/plugin.json` and `claude plugin validate .claude-plugin/marketplace.json`. Repository plugin manifests do not ship in the npm tarball.

## Change the toolkit

Keep creative direction in the skill, deterministic mechanics in the CLI, and the rendering engine behind the existing adapter. Successful rendering must never be described as creative approval. Commands return machine-readable results; progress belongs on stderr. Preserve existing projects and their last usable export on failure.

A PR should explain the user-visible change and relevant validation. For visual changes, include before/after frames and note whether video playback and audio were inspected. Use local fixture assets with clear licenses. Do not submit client projects, credentials, generated caches, or unrelated changes.

Contributions are provided under this repository's MIT license, with third-party materials identified separately. Be respectful and specific in discussion; maintainers may remove harassment, spam, or disclosure of private information.
