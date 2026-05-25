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
