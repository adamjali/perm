# Contributing to PERM Tracker

Thank you for your interest in contributing to PERM Tracker!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/perm.git`
3. Install dependencies: `cd perm/v2 && pnpm install`
4. Start the dev servers (two terminals):
   - `npx convex dev` (Terminal 1)
   - `pnpm dev` (Terminal 2)
5. Open http://localhost:3000

## Development

- **All code lives in `v2/`** — run commands from there
- **TypeScript strict mode** — no `any` types
- **Tests first** — write failing tests before implementation
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `docs:`, `test:`
- See `v2/CLAUDE.md` for full developer guide

## Submitting Changes

1. Create a feature branch from `main`
2. Make your changes with atomic commits
3. Ensure `pnpm typecheck` and `pnpm test:fast` pass
4. Open a pull request against `main`

## Code of Conduct

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## Questions?

Open an issue or reach out to the maintainers.
