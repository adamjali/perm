# Version Decisions

Packages intentionally NOT on latest, with reasons.

## AI SDK Stack — Upgraded to v6 (Feb 2026)

**Date:** 2026-02-14
**Status:** RESOLVED

Previously pinned to v5 because `@openrouter/ai-sdk-provider@1.5.4` only supported `ai@^5`.
OpenRouter v2.2.3+ now supports `ai@^6`. All packages upgraded to latest:

| Package | Version |
|---------|---------|
| `ai` | 6.0.86 |
| `@ai-sdk/google` | 3.0.29 |
| `@ai-sdk/openai` | 3.0.29 |
| `@ai-sdk/react` | 3.0.88 |
| `@openrouter/ai-sdk-provider` | 2.2.3 |
| `ai-fallback` | 2.0.0 |

**Migration notes:**
- `CoreMessage` → `ModelMessage` (type rename)
- `finishReason` at provider level is now `{ unified, raw }` object (high-level `FinishReason` unchanged)
- Middleware requires `specificationVersion: 'v3'`
- `convertToModelMessages` is async (was already `await`ed in our code)
- Strict mode defaults to true for tool schemas (compatible with our Zod schemas)

**Related:** Dependabot PRs #19, #20, and #23 superseded by this migration.

---

## May 2026 maintenance update — all latest/safe

**Date:** 2026-05-24
**Status:** RESOLVED

Routine dependency sweep alongside the PR-review fix pass. Researched changelogs + tested the full gate (typecheck · lint 0 · build · 4313-test suite) **before and after**:

| Package | → Version | Note |
|---------|-----------|------|
| react / react-dom | 19.2.6 | patch only |
| next | 16.2.6 | already current — this release **bundles the May 2026 security fixes** (13 advisories incl. SSRF CVE-2026-44578, RSC DoS CVE-2026-23870) |
| next-mdx-remote | 6.0.0 | already current — fixes RCE CVE-2026-0969 |
| @convex-dev/auth | 0.0.92 | adds `useAuth` + a test-id fix; **does NOT touch Password/`profile()`/account-lookup**, so it's compatible with our email-normalization work |
| convex-test | 0.0.53 | scheduled-fn test fixes (helps our convex suite) |
| eslint-config-next | 16.2.6 | aligned with `next` |
| remotion + @remotion/* | 4.0.465 | moved in lockstep |
| @typescript/native-preview (tsgo) | 7.0.0-dev.20260524.1 | nightly |

## Packages intentionally held back

**Date:** 2026-05-24

| Package | Held at | Latest | Why |
|---------|---------|--------|-----|
| `@types/node` | 24.x | 25.x | Must track the **Node 24** production runtime major. 25.x would type APIs not present in Node 24. Bump only when the runtime moves to Node 25. |
| `lucia` | 3.2.2 (deprecated) | — | Lucia was sunset upstream, but it's a **used direct dep**: `convex/admin.ts` imports `Scrypt` for test-user password hashing. Removal means migrating to `@oslojs/crypto` (already in deps) — a deliberate code change tracked in `.planning/AUTH_AUDIT.md`, not a version bump. |
| `@react-email/components` | 1.0.12 | (deprecated tag) | Already the **latest published** version; the "Deprecated" flag is a package-level sunset (React Email v6 consolidation), not an upgrade you can take. `@react-email/render` 2.0.8 is current and not deprecated. No action available. |
| `js-yaml` (transitive, via `gray-matter`) | <=4.1.1 | 4.2.0 | GHSA-h67p-54hq-rp68 (moderate — quadratic-complexity DoS via malicious YAML merge-key aliases). **Cannot pin to >=4.2.0 via override**: `gray-matter@4.0.3` calls js-yaml 3.x's removed `safeLoad()`, so forcing 4.x breaks ALL MDX frontmatter parsing (changelog/tutorials/resources/guides). **Non-exploitable here** — gray-matter only parses our own first-party `content/*.mdx` frontmatter, never user input, so the malicious-YAML vector doesn't apply. Revisit if gray-matter is replaced or if MDX ever parses untrusted YAML. |

---

## June 2026 maintenance + security update

**Date:** 2026-06-15
**Status:** RESOLVED

Caret-safe `pnpm update` sweep + targeted security fixes, verified through the full gate (typecheck · lint 0 errors · webpack build · 4381-test suite).

| Change | Detail |
|--------|--------|
| `convex` | 1.40.0 → **1.41.0** (+ `npx convex ai-files update` refreshed `guidelines.md` + bundled Convex agent skills) |
| Caret group bump | `@ai-sdk/*` + `ai` 6.0.205, `@sentry/nextjs` 10.58, `next` 16.2.9, `vitest` 4.1.9, `storybook` 10.4.5, `playwright` 1.61, `posthog-js`/`posthog-node`, `lucide-react` 1.18, etc. |
| `@typescript/native-preview` | → 7.0.0-dev.20260615.1 |
| **`esbuild` override** | `^0.28.0` → **`>=0.28.1`** — fixes GHSA-gv7w-rqvm-qjhr (high) + GHSA-g7r4-m6w7-qqqr (low). The old `^0.28.0` resolved to the still-vulnerable 0.28.0. (Transitive, dev-only via Storybook.) |
| GH Actions | `actions/setup-node` v5→v6, `pnpm/action-setup` v4→v6 (`.github/workflows/test.yml`) |

**`pnpm audit` after the sweep:** only the non-exploitable `js-yaml` advisory remains (see held-back table — gray-matter API incompatibility). The `js-yaml >=4.2.0` override was attempted and **reverted** because it broke gray-matter's `safeLoad()` frontmatter parsing.

**Superseded Dependabot PRs:** #95, #96, #109, #110, #111.
