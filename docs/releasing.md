# Releasing

Maintainer repository: `shiftynick/motion-mania`. npm package: `motion-mania`.

## First publication

Authenticate interactively with `npm login`, confirm `npm whoami`, and run `npm run check`. Inspect `npm pack --dry-run --json`; the tarball should contain the runtime, starter, skill, README, and licenses, with no client projects, credentials, or generated videos.

Publish the first version from a clean, committed checkout with `npm publish --access public`. npm may require browser or 2FA verification. Never commit a token. Tag that commit `v0.1.0` and create a GitHub release with the demo MP4s and source tarball as downloadable assets.

## GitHub trusted publishing

After the package exists, configure its npm trusted publisher for:

- Provider: GitHub Actions
- User: `shiftynick`
- Repository: `motion-mania`
- Workflow filename: `publish.yml`
- Environment: none
- Allowed action: direct `npm publish`

See [npm's trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/). The workflow requests OIDC credentials and publishes with provenance; it does not need an npm token secret. Trusted publisher configuration is an npm account setting, not something the workflow file creates automatically.

## Later versions

1. Update the changelog, package version/lockfile, and pinned CLI version in the skill's npx fallback. Commit those changes.
2. Run `npm run check` and confirm CI passes.
3. Create and push a matching `vX.Y.Z` tag.
4. Dispatch **Publish to npm** from Actions with that exact tag. It checks the package version, reruns tests, and publishes with provenance.
5. Confirm the published version using `npm view motion-mania version`, then exercise `npx --yes motion-mania@X.Y.Z --version` and initialization from a fresh directory.
6. Create the GitHub release with concise notes and relevant demo artifacts.

A published version cannot be replaced in place; fixes require a new version. Avoid moving release tags after publication. If trusted publishing has not been configured, the workflow fails authentication; finish the account setup before running it.
