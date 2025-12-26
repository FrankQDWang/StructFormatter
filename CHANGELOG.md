# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-12-26

### Added

- `CHANGELOG.md`.

### Changed

- Packaging: run build via `prepack` so `npm pack`/`npm publish` don’t require `pnpm`.
- Publish docs: note npm’s session-based auth and CI/CD token guidance.

## [0.1.0] - 2025-12-26

### Added

- OpenAI-compatible proxy server that enforces JSON Schema structured outputs via an extract/repair/validate/retry loop.
- CLI `structuredformatter` for running the server with a config file.
- Config schema + validation, plus a `config.example.yaml`.
- Vitest test suite for core behaviors.
