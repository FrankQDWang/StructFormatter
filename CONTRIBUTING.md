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
