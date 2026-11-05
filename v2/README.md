# PERM Tracker app

The code behind [permtracker.app](https://permtracker.app). The [main README](../README.md) says what it does.

## Run it

```bash
cp .env.example .env.local    # then fill it in
pnpm install
npx convex dev                # terminal 1
pnpm dev                      # terminal 2
```

Then open http://localhost:3000.

## Check it

```bash
pnpm check       # before you push
pnpm test:run    # every test
```

## Docs

- [CLAUDE.md](CLAUDE.md): the developer guide
- [TEST_README.md](TEST_README.md): tests
- [docs/API.md](docs/API.md): the Convex API
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): the design system
