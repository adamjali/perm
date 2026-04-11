# Technology Stack

**Analysis Date:** 2026-02-21

## Languages

**Primary:**
- TypeScript 5.x (strict mode) — All frontend and backend code
  - Config: `v2/tsconfig.json` — `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`
  - Target: ES2022, Module: ESNext, JSX: react-jsx
  - Path alias: `@/*` maps to `./src/*`

**Secondary:**
- JavaScript (ESM) — Config files only (`v2/eslint.config.mjs`, `v2/postcss.config.mjs`)
- MDX — Content hub articles in `v2/content/{type}/*.mdx`

## Runtime

**Environment:**
- Node.js (version managed by Vercel, no `.nvmrc` detected)
- Convex V8 Isolates — Backend functions run in Convex's serverless runtime (not Node.js), with `"use node"` directive for Node-dependent actions
- Browser — React 19 SPA with service worker (Serwist PWA)

**Package Manager:**
- pnpm 10.27.0 (pinned via `packageManager` in `v2/package.json`)
- Lockfile: `v2/pnpm-lock.yaml` (present, committed)
- Workspace: `v2/pnpm-workspace.yaml` (monorepo root at `v2/`)
- Config: `v2/.npmrc` — `shamefully-hoist=true`, `side-effects-cache=false`

**Type Checker:**
- `tsgo` (native TypeScript preview) — `v2/convex.json` sets `"typescriptCompiler": "tsgo"` for Convex
- `@typescript/native-preview` 7.0.0-dev.20260216.1 — dev dependency, used via `pnpm typecheck` (runs `tsgo --noEmit`)
- Standard `tsc` available as fallback via `pnpm typecheck:tsc`

## Frameworks

**Core:**
- Next.js 16.1.5 — Full-stack React framework (App Router)
  - Config: `v2/next.config.ts`
  - Dev: Turbopack (`pnpm dev` runs `next dev --turbopack`)
  - Build: Webpack (`pnpm build` runs `next build --webpack`)
  - Experimental: `inlineCss`, `optimizePackageImports` (lucide-react, date-fns only)
  - React Compiler: DISABLED (causes ReferenceError with both Turbopack and Webpack)
  - `concatenateModules: false` on client bundles (prevents motion-dom export mangling)
- React 19.2.4 — UI library (with react-dom 19.2.4)
- Convex 1.35.1 — Serverless backend (real-time database, functions, scheduling)
  - Config: `v2/convex.json`
  - Schema: `v2/convex/schema.ts`
  - Auth: `v2/convex/auth.ts`

**Testing:**
- Vitest 4.0.18 — Unit and integration tests (3600+ tests)
  - Config: `v2/vitest.config.ts`
  - Three project tiers: `unit` (happy-dom), `components` (happy-dom), `convex` (edge-runtime)
  - Pool: threads (shared memory for speed)
  - Setup: `v2/vitest.setup.ts`, `v2/vitest.setup.convex.ts`
- Playwright 1.58.2 — E2E tests
  - Config: `v2/playwright.config.ts`
  - Runner: `v2/run-e2e-tests.sh`
- Testing Library — React testing utilities
  - `@testing-library/react` 16.3.2
  - `@testing-library/jest-dom` 6.9.1
  - `@testing-library/user-event` 14.6.1
- convex-test 0.0.41 — Convex function testing
- vitest-axe 0.1.0 — Accessibility testing in Vitest
- axe-core 4.11.1 + @axe-core/react 4.11.1 — Accessibility auditing

**Build/Dev:**
- Vite 7.3.1 — Dev server and build tooling for Vitest
- Storybook 10.2.8 — Component development and documentation
  - Config: `v2/.storybook/main.ts`
  - Framework: `@storybook/nextjs-vite`
  - Addons: a11y, docs, onboarding, themes
- ESLint 9.x — Linting
  - Config: `v2/eslint.config.mjs` (flat config)
  - Plugins: eslint-config-next (core-web-vitals + typescript), eslint-plugin-security, eslint-plugin-storybook
- PostCSS — CSS processing (`v2/postcss.config.mjs`)
- @next/bundle-analyzer 16.1.6 — Bundle size analysis (`ANALYZE=true pnpm build`)

## Key Dependencies

**Critical (production functionality depends on these):**
- `convex` 1.32.0 — Database, real-time sync, serverless functions, file storage
- `@convex-dev/auth` 0.0.90 — Authentication layer (Google OAuth + Email/Password)
- `@auth/core` 0.41.1 — Auth.js core (used by Convex Auth for Google provider)
- `next` 16.1.5 — Full-stack framework, routing, SSR
- `react` / `react-dom` 19.2.4 — UI rendering

**AI/Chat:**
- `ai` 6.0.89 — Vercel AI SDK v6 (streaming, tool calling, UI message streams)
- `@ai-sdk/react` 3.0.91 — React hooks for AI SDK (`useChat`)
- `@ai-sdk/google` 3.0.29 — Google Gemini provider (PRIMARY model)
- `@ai-sdk/groq` 3.0.24 — Groq provider (Tier 2 fallback)
- `@ai-sdk/mistral` 3.0.20 — Mistral provider (Tier 2 fallback)
- `@ai-sdk/cerebras` 2.0.34 — Cerebras provider (Tier 3 emergency)
- `@openrouter/ai-sdk-provider` 2.2.3 — OpenRouter provider (Tier 3 free)

**UI Components:**
- `@radix-ui/react-*` — Headless UI primitives (alert-dialog, checkbox, dialog, dropdown-menu, label, popover, scroll-area, slot, switch, tooltip)
- `class-variance-authority` 0.7.1 — Variant-based component styling (shadcn/ui)
- `clsx` 2.1.1 — Conditional className utility
- `tailwind-merge` 3.4.1 — Tailwind class deduplication
- `cmdk` 1.1.1 — Command palette component
- `sonner` 2.0.7 — Toast notifications
- `lucide-react` 0.574.0 — Icon library
- `next-themes` 0.4.6 — Dark mode support

**Animation:**
- `motion` 12.34.1 — Framer Motion (animation library)
- `gsap` 3.14.2 — GreenSock Animation Platform (scroll-triggered animations)
- `lottie-react` 2.4.1 — Lottie animation player

**Forms & Validation:**
- `react-hook-form` 7.71.1 — Form state management
- `@hookform/resolvers` 5.2.2 — Schema validation resolvers
- `zod` 4.3.6 — Schema validation (v4)

**Date/Time:**
- `date-fns` 4.1.0 — Date manipulation and formatting

**Calendar:**
- `react-big-calendar` 1.19.4 — Full calendar component
- `google-auth-library` 10.5.0 — Google Calendar OAuth client

**Drag & Drop:**
- `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@dnd-kit/modifiers` 9.0.0, `@dnd-kit/utilities` 3.2.2 — Case card reordering

**Content/MDX:**
- `next-mdx-remote` 6.0.0 — MDX rendering
- `gray-matter` 4.0.3 — Frontmatter parsing
- `reading-time` 1.5.0 — Article read time estimation
- `rehype-autolink-headings` 7.1.0 — Auto-link headings
- `rehype-pretty-code` 0.14.1 — Code syntax highlighting
- `rehype-slug` 6.0.0 — Heading ID slugs
- `remark-gfm` 4.0.1 — GitHub-flavored markdown
- `shiki` 3.22.0 — Syntax highlighter
- `react-markdown` 10.1.0 — Markdown rendering (chat)

**Email:**
- `resend` 6.9.2 — Email sending API client
- `@react-email/components` 1.0.7 — Email template components
- `@react-email/render` 2.0.4 — Email template rendering

**Push Notifications:**
- `web-push` 3.6.7 — VAPID push notifications

**Observability:**
- `@sentry/nextjs` 10.39.0 — Error tracking and performance monitoring
- `@vercel/analytics` 1.6.1 — Vercel web analytics
- `@vercel/speed-insights` 1.3.1 — Vercel Core Web Vitals

**Video:**
- `remotion` 4.0.424 — Programmatic video compositions
- `@remotion/cli` 4.0.424, `@remotion/player` 4.0.424, `@remotion/tailwind` 4.0.424, `@remotion/transitions` 4.0.424

**Onboarding:**
- `driver.js` 1.4.0 — Guided product tours

**Tooltips:**
- `@tippyjs/react` 4.2.6 + `tippy.js` 6.3.7 — Tooltip library

**Webhooks:**
- `svix` 1.85.0 — Webhook signature verification (Resend inbound)

**Security:**
- `@oslojs/crypto` 1.0.1 — Cryptographic utilities (OTP generation)
- `lucia` 3.2.2 — Auth utilities (legacy, used alongside Convex Auth)

**PWA:**
- `@serwist/next` 9.5.6 + `serwist` 9.5.6 — Service worker / PWA support
  - Config: `v2/src/app/sw.ts`
  - Generated: `public/sw.js` (gitignored)

**Knowledge/RAG:**
- `@convex-dev/rag` 0.7.1 — RAG (Retrieval Augmented Generation) for chatbot knowledge

**Infrastructure (dev):**
- `happy-dom` 20.6.1 — DOM environment for tests (faster than jsdom)
- `jsdom` 26.0.0 — DOM environment (available but secondary)
- `@edge-runtime/vm` 5.0.0 — Edge runtime simulation for Convex tests
- `@vitejs/plugin-react` 5.1.4 — React support for Vite/Vitest
- `@vitest/coverage-v8` 4.0.18 — Code coverage via V8
- `@vitest/browser-playwright` 4.0.18 — Browser-based testing
- `babel-plugin-react-compiler` 1.0.0 — React Compiler babel plugin (available but compiler disabled)
- `tw-animate-css` 1.4.0 — Tailwind animation utilities

## Configuration Files Inventory

| File | Purpose |
|------|---------|
| `v2/package.json` | Dependencies, scripts, browserslist, pnpm overrides |
| `v2/pnpm-lock.yaml` | Dependency lockfile |
| `v2/pnpm-workspace.yaml` | Monorepo workspace config |
| `v2/.npmrc` | pnpm config (shamefully-hoist, side-effects-cache) |
| `v2/tsconfig.json` | TypeScript compiler config |
| `v2/next.config.ts` | Next.js config (Serwist, Sentry, CSP, redirects, headers) |
| `v2/postcss.config.mjs` | PostCSS with Tailwind CSS v4 plugin |
| `v2/eslint.config.mjs` | ESLint flat config (Next.js + security + Storybook) |
| `v2/vitest.config.ts` | Vitest test config (3 project tiers, coverage) |
| `v2/playwright.config.ts` | Playwright E2E config (Chromium only) |
| `v2/convex.json` | Convex project config (tsgo compiler) |
| `v2/convex/schema.ts` | Database schema definition (16 tables) |
| `v2/convex/auth.ts` | Authentication provider config |
| `v2/convex/crons.ts` | Scheduled jobs (6 cron jobs) |
| `v2/convex/http.ts` | HTTP router (webhook endpoints) |
| `v2/components.json` | shadcn/ui config (new-york style, Tailwind CSS vars) |
| `v2/sentry.client.config.ts` | Sentry client (intentionally empty — lazy init) |
| `v2/sentry.server.config.ts` | Sentry server config |
| `v2/sentry.edge.config.ts` | Sentry edge runtime config |
| `v2/src/instrumentation.ts` | Next.js instrumentation hook (Sentry init) |
| `v2/src/app/sw.ts` | Service worker config (Serwist) |
| `v2/serwist.d.ts` | Service worker type declarations |
| `v2/.storybook/main.ts` | Storybook config |
| `v2/.env.example` | Environment variable template (public) |
| `v2/.env.local.example` | Full env template with descriptions |
| `v2/.env.sentry.example` | Sentry-specific env template |
| `v2/.env.local` | Active environment variables (gitignored) |
| `v2/.gitignore` | Git ignore rules |
| `v2/run-e2e-tests.sh` | E2E test runner script |

## CSS Framework

**Tailwind CSS v4:**
- PostCSS plugin: `@tailwindcss/postcss` 4.x
- CSS entry: `v2/src/app/globals.css`
- Animation utilities: `tw-animate-css` 1.4.0
- Custom prose styles: `.prose-neobrutalist` (no @tailwindcss/typography)

## Platform Requirements

**Development:**
- macOS / Linux (Darwin 21.6.0 detected)
- Node.js (version managed by Vercel/pnpm)
- pnpm 10.27.0
- Two terminal sessions: `npx convex dev` + `pnpm dev`

**Production:**
- Vercel — Frontend hosting (Next.js, auto-deploy on push to main)
- Convex Cloud — Backend hosting (serverless functions, database)
  - Production: `giant-dragon-464`
  - Development: `giddy-peccary-484`

**Browser Support:**
```json
["last 2 Chrome versions", "last 2 Firefox versions", "last 2 Safari versions", "last 2 Edge versions"]
```

## CI/CD

**GitHub Actions Workflows:**
- `claude.yml` — Claude Code Action (AI-assisted PR reviews)
- `codeql-analysis.yml` — CodeQL security scanning (JavaScript + Python, weekly + on push/PR)
- `claude-code-review.yml` — Claude code review on PRs
- `dependabot.yml` — Dependency update automation

## pnpm Overrides (Security/Compatibility)

| Package | Override | Reason |
|---------|----------|--------|
| `parse5` | `^7.1.2` | Security fix |
| `lodash` | `^4.17.23` | Security fix |
| `lodash-es` | `^4.17.23` | Security fix |
| `esbuild` | `^0.25.0` | Compatibility |
| `webpack` | `^5.104.1` | Compatibility |
| `ajv` | `^8.18.0` | Compatibility |

## Version Compatibility Notes

- **SWC Minifier Bug:** SWC drops `var` declarations in functions with ~20+ `??`/`?.` operators. Workaround: use `||` instead of `??`. Tracked: swc#760, #7953, #9468.
- **React Compiler:** Disabled due to ReferenceError in both Turbopack and Webpack builds.
- **Zod v4:** Cannot be in `optimizePackageImports` — tree-shaking breaks `ZodNumber.int()`.
- **motion/react:** Cannot be in `optimizePackageImports` or use `concatenateModules` — ESM export mangling.
- **Gemini 3 Flash Preview:** Broken with `@ai-sdk/google` v3 for tool calls (thought_signature issues).
- **AI SDK v6:** `CoreMessage` renamed to `ModelMessage`; `wrapLanguageModel` needs `specificationVersion: 'v3' as const`.
- **@ai-sdk/openai v3:** Defaults to Responses API (`/responses`) — non-OpenAI providers return 404. Use native SDKs instead.

---

*Stack analysis: 2026-02-21*
