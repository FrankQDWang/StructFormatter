# Contributing

Thanks for contributing!

## Development

Requirements:
- Node.js 20+
- pnpm

Commands:
- `pnpm dev`
- `pnpm lint`
- `pnpm test`

## Pull Requests

- Keep changes focused and well-tested.
- Follow the behavior described in `specs/`.

## Maintainers: publishing to npm

This repo supports automatic npm publishing via GitHub Actions (recommended), using npm Trusted Publishing (OIDC).

### One-time setup (npm Trusted Publishing)

In npm package settings for `structformatter`, add a Trusted Publisher pointing to this GitHub repo and workflow file:
- Repository: `FrankQDWang/StructFormatter`
- Workflow: `.github/workflows/publish.yml`

Notes:
- Trusted Publishing requires npm CLI v11.5.1+ (the workflow uses Node 24).
- Trusted Publishing is currently limited to publishing (not general npm API auth).

### Release (automatic publish)

1) Bump `package.json` version + update `CHANGELOG.md`, commit to `main`.

2) Create and push a version tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

Pushing the tag triggers the `publish` workflow, which runs tests and publishes to npm.

### Release (manual fallback)

Publishing is protected by 2FA and session-based auth, so publish shortly after logging in.

1) Check out a release tag (recommended):

```bash
git fetch --tags
git checkout vX.Y.Z
```

2) Publish:

```bash
npm login
npm whoami
npm publish
```

Notes:
- `npm publish` runs `npm run build` via `prepack`.
- CI/CD should use granular tokens or trusted publishing (OIDC), not classic tokens.
