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

---

## September 2026 audit — AI SDK v7, and one deliberate hold-back

**Date:** 2026-09-01
**Status:** RESOLVED

### AI SDK v6 to v7

`ai` 6.0.273 to **7.0.87**. The version that matters underneath is
`@ai-sdk/provider`, which went **3.x to 4.x**, i.e. `LanguageModelV3` to
`LanguageModelV4`. This repo implements that interface directly in
`FallbackModel`, so the major is not a passive bump.

| Package | → Version |
|---------|-----------|
| `ai` | 7.0.87 |
| `@ai-sdk/react` | 4.0.90 |
| `@ai-sdk/google` | 4.0.59 |
| `@ai-sdk/groq` | 4.0.35 |
| `@ai-sdk/mistral` | 4.0.37 |
| `@ai-sdk/cerebras` | 3.0.41 |
| `@openrouter/ai-sdk-provider` | 3.0.0 |
| `@ai-sdk/provider` | 4.0.9 (**newly explicit**) |

**Migration notes:**
- `LanguageModelV3*` to `LanguageModelV4*` throughout `src/lib/ai/providers.ts`,
  and `specificationVersion` `'v3'` to `'v4'` in BOTH the `FallbackModel` class
  and the `wrapMistralModel` middleware.
- `system:` to `instructions:` and `onFinish` to `onEnd` on the **`ai`** package
  only. **`useChat`'s `onFinish` in `@ai-sdk/react` is NOT deprecated** and was
  deliberately left alone; a blanket rename breaks the persistence hook.
- `generateObject` to `generateText` with `output: Output.object({ schema })`.
  The standalone function is deprecated in v7.
- `@ai-sdk/provider` was being imported by `providers.ts` while absent from
  `package.json`, resolving only by hoisting. Now an explicit dependency.

**None of the provider packages declare a peer on `ai`,** so a version mismatch
here is a runtime failure, not an install error. The compatibility that gated
this upgrade was `@openrouter/ai-sdk-provider`, whose 3.0.0 declares
`peer ai: ^7.0.0`. Verified before starting, not after.

## Packages intentionally held back (September 2026)

| Package | Held at | Latest | Why |
|---------|---------|--------|-----|
| `@sentry/nextjs` | ~10.70.0 until Oct 24 2026, then ~10.75.2 | 10.73.0 (Sep) | 10.72+ stopped depending on `@apm-js-collab/code-transformer-bundler-plugins` and **vendors** it instead, copying an ESM file that runs `fileURLToPath(import.meta.url)` at module load into their CJS build. Vitest cannot resolve that to a `file://` URL, so importing it throws `ERR_INVALID_URL_SCHEME`. Measured on 10.73.0: **24 test files failed and 109 more never ran** (2,759 tests collected against a 6,092 baseline). **The production webpack build is unaffected**, which is why this is invisible until the suite runs. Superseded: see "October 24 2026". |
| `image-size` (transitive, via `@storybook/nextjs-vite`) | <=2.0.2 | — | Unchanged from the Audit 7 policy, re-verified: **2.0.2 IS the latest published version** and it is the vulnerable one, so there is no override target. devDependency only, never ships. |

**Superseded Dependabot PRs:** #23, #24, #25 (Actions, superseded by normalising
every workflow to v7), #26, #27 (grouped, superseded by the caret bulk update —
note #27 also wanted the Sentry bump that was deliberately reverted), #28, #29,
#30 (the `@ai-sdk` provider majors, superseded by going further to the full v7
upgrade).

## September 30 2026 audit (Audit 11): motion 13, svix 2, three floors

| Package | From | To | What the major changed, and how it was checked |
|---------|------|----|-----------------------------------------------|
| `motion` | 12.43.0 | **13.4.1** | Drops the optional `@emotion/is-prop-valid` auto-detection, which this repo never installed. The `ssr` vitest project runs real motion with no mock and passed; the live SSR-visibility audit read 475 of 475 pages clean. Motion's `initial` is an SSR inline style here, so this is the check that matters. |
| `svix` | 1.99.1 | **2.5.0** | `Webhook.verify` no longer parses the JSON body. `convex/http.ts` ignores its return value and parses the body itself; `marketingEmail.test` signs and verifies real webhooks with v2, and live `/resend-inbound` answers 401 to a forged signature. **svix is bundled into Convex: the bump needed `npx convex deploy -y` though no file under `convex/` changed.** |

**Why these versions and not the newest:** `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`
(7 days), so `pnpm add motion@^13 svix@^2` installed 13.4.1 and 2.5.0 while 13.4.6 and 2.6.0
were a day old. The changelogs were read up to the installed versions, not the PR's.

**Override floors raised for advisories Dependabot never flagged** (`pnpm audit` found them; 0
open Dependabot alerts at the time), each capped at its major so a floor can't pull in the next
one: `brace-expansion >=5.0.12 <6` (GHSA-6j4f-fj2g-mc7p and GHSA-qhr7-859c-m2p7, high;
GHSA-q2hr-2g5m-vwhr), `moment >=2.31.0 <3` (GHSA-4p3w-j4w9-5jqw; it ships, via
react-big-calendar), `fast-uri >=3.1.8 <4` (GHSA-hrr3-gc8f-f4qj). All three patches were 15 days
old, so the release-age floor allowed them. `pnpm audit` clean afterwards.

**Superseded Dependabot PRs:** #33 (motion 13) and #35 (svix 2), each closed with its own
reason. Audit 10 had left both open because motion's SSR inline style and svix's signature check
are the two places a silent regression costs most; both were tested directly this time.

## eslint-config-next 16.4.0, with one trust exemption
**Date:** 2026-10-13
**Status:** RESOLVED

`next` went to 16.4.0 the same evening. `eslint-config-next` 16.4.0 was first refused by pnpm's `trustPolicy: no-downgrade` over `eslint-import-resolver-typescript@3.10.1`: a 3.x patch (Apr 21 2025, published by a listed maintainer) released after 4.0.0 (Mar 16 2025) began carrying provenance, while no 3.x version ever did. Its registry integrity matches the lockfile's, which already held it. Exempted by name in `pnpm-workspace.yaml` (owner's call), the `semver@6.3.1` pattern. Lint over `src` and `convex`: 0 errors before and after; the new `@next/next/no-location-assign-relative-destination` rule flagged six deliberate full-page navigations (crash screens, sign-out, Google's sign-in), each now marked with its reason.

## `@storybook/nextjs-vite` 10.6.0, patched for Next 16.4 (Oct 14 2026)

Next 16.4's `useRouter` reads `parentRenderTree.data.bfcacheId`, and the Storybook
adapter's router context built no `parentRenderTree`, so every story rendering a
`next/link` threw. `patches/@storybook__nextjs-vite@10.6.0.patch` adds the field
(`{ data: { bfcacheId: 0 }, slots: new Map() }`) to the context the adapter
builds; `package.json` `pnpm.patchedDependencies` applies it. Dev only, never
ships.

**Remove it when a fixed release can be installed.** 10.6.2 doesn't carry the fix
(checked Oct 24 2026: the patch applied to it unchanged, and `bfcacheId` appears
nowhere else in its build), so the patch was renamed to
`patches/@storybook__nextjs-vite@10.6.2.patch` with that upgrade. 10.6.3 was out
the same day; check it the same way before moving on.

**Checked Oct 31 2026: 10.6.3 (Oct 20), 10.6.4 and 10.6.5 carry the fix upstream**
(`parentRenderTree: { data: { bfcacheId: 0 } }` in
`dist/_browser-chunks/chunk-TCVY5TW2.js`, without our patch's `slots: new Map()`).
The next Storybook upgrade (every `storybook` and `@storybook/*` package together, to
10.6.3 or newer) drops the patch and its `patchedDependencies` line, after a story that
renders `next/link` and the tour stories render in Storybook.

## `next` 16.4.0, patched for Google's extensionless font addresses (Oct 24 2026)

Google Fonts sometimes answers the build with a font address that has no file
extension (`fonts.gstatic.com/l/font?kit=...`). Next 16.4's `next/font/google`
loader read the type off the address with `/\.(woff|woff2|eot|ttf|otf)$/.exec(url)[1]`,
got null, and the build died with "An error occurred in `next/font`. TypeError:
Cannot read properties of null (reading '1')". It failed four deploys: Oct 5,
Oct 11 (twice, 40 minutes apart, so a quick retry wouldn't have helped) and
Oct 24 2026. 16.4.2 still has the line; the 16.5 canary reads the type from the
CSS's `format()` hint instead, with the comment "Google can return extensionless
/l/font?kit=... URLs".

`patches/next@16.4.0.patch` falls back to woff2 when the address has no
extension (the Chrome user agent Next sends always gets woff2). It ships: the
build runs it. `src/lib/__tests__/next-font-kit-url.ssr.test.ts` drives the real
loader through Next's own `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` hook with both
address forms; with the patch removed it fails with the production error.

**Removed Oct 24 2026 with Next 16.4.3**, which shipped the same fix (Oct 23
2026). The test stays: it passed against 16.4.3 with no patch, and it checks
every later Next against the same case.

## October 24 2026: Next 16.4.3, Sentry 10.75, and everything Dependabot held

`pnpm audit` listed 21 advisories (5 critical, 7 high) that Dependabot's alert list didn't, because Dependabot
can't raise a pinned or transitive version. None was reachable here (no `use cache`, no Server Actions, sharp
0.35.5 on the server), and all were taken in one batch, tested together. `pnpm audit` read clean afterwards,
with and without `--prod`.

| Package | From | To | Why, and how it was checked |
|---------|------|----|-----------------------------|
| `next`, `eslint-config-next`, `@next/bundle-analyzer` | 16.4.0 | **16.4.3** | GHSA-673q-mjm6-r5xr and GHSA-2464-fhr4-w9xw (critical), GHSA-p3m5-59mp-jv5r (high); the font fix let the local Next patch go. Taken a day after release, past the 7-day floor: every package of the release is named in `minimumReleaseAgeExclude` with a removal date. |
| `@sentry/nextjs` | ~10.70.0 | **~10.75.2** (10.75.3) | GHSA-mchm-gjx6-7h55 (critical). 10.75.3's CommonJS build has no `fileURLToPath(import.meta.url)` and the full suite passed with it. Dependabot ignores `>=10.76.0`: a static read of 10.76.2 couldn't rule its load-time code in or out, so a newer one comes in by hand after the full suite passes with it. |
| `storybook` and the `@storybook/*` addons | 10.6.0 | **10.6.2** | GHSA-f2ph-cmg5-wxc8 (critical, dev only). The adapter patch carried over (above). |
| `react`, `react-dom`; `@types/react`, `@types/react-dom` | 19.2.7 | **19.3.1**; 19.3.0 | Dependabot's production group. |
| `jsdom` | 29.1.1 | **30.1.3** | Needs Node 22.22.2+ or 24.15+. CI runs 24.x; this Mac runs the suite under nvm's 24.22.1 (installed Oct 24 2026, owner's yes) because `/usr/local/bin/node` is 22.22.1. |
| `happy-dom` | 20.14.0 | **21.0.4** | Dependabot's #55 offered 21.0.3, still vulnerable; 21.0.4 excluded from the floor until Oct 27. |
| The rest of Dependabot's #64 and #62 | | | Radix minors, `@libsql/client` 0.18, `@convex-dev/rate-limiter` 0.4.2 with `convex-test` 0.0.62 (the limiter's new nested component needs it), `@convex-dev/auth` 0.0.96, `ai` 7.0.143 with its providers, `convex` 1.47, Remotion 4.0.536, Playwright 1.64.1 (it drives the installed Chrome, so no browser download), `vitest` 4.1.12. |

**Overrides:** `dompurify >=3.4.17 <4`, `fast-uri >=3.1.9 <4` (3.1.9 excluded from the floor until Oct 26),
`zod >=4.6.7 <5` (`@serwist/next` pinned an older zod), and undici split by major, `undici@<8 >=7.30.1 <8` and
`undici@>=8 >=8.12.2 <9`, because jsdom 30 needs undici 8 while the rest of the tree is on 7.

**Not taken:** `vitest` 5 and `@vitest/coverage-v8` 5 (a major, not offered by Dependabot's groups),
`convex-test` 0.0.65 and `storybook` 10.6.3 (newer than this batch's checks).

**The morning report now runs `pnpm audit`** (production and full), so an advisory Dependabot can't see still
reaches the owner. **Superseded Dependabot PRs:** #64, #62, #56, #55, each closed with a pointer to the merge.

## October 28 2026: deepmerge, accepted with a review date

`pnpm audit` lists one advisory, GHSA-gcqx-w48m-w2h4 (low): deepmerge's `mergeObject()` can set the prototype
of the object it returns when a source carries a `__proto__` key and the target isn't an object. Every version
through 4.3.1 is affected and none is fixed ("patched versions: <0.0.0"). It reaches us one way:
`@react-email/render` (2.0.6 and 2.1.1, the newest) > `html-to-text` 9.0.5 (the newest) > `deepmerge`, which
merges html-to-text's default options with the renderer's own. No object a visitor sends is ever merged.

Weighed and not taken: an override to another package (`@fastify/deepmerge` and `deepmerge-ts` have different
call shapes, so html-to-text would break), and a local patch skipping `__proto__` (it would work, but
`pnpm audit` matches versions, so it would still list the advisory, and a patch is one more thing to carry).
Accepted in `scripts/daily_monitor.py`'s `ACCEPTED_ADVISORIES` until 2027-01-28, when the morning report asks
again: by then deepmerge, html-to-text or the renderer may have moved.


## motion 14.5.0 (Oct 28 2026, branch catchup/oct28; supersedes Dependabot PR #68)

- **Taken:** 14.5.0 (released Oct 21 2026 12:35 AM EDT), past the 7-day release floor. 14.7.1 (Oct 27) is under
  it and waits for the next pass.
- **What changed for us:** nothing. 14.0.0's changelog (read Oct 28) removes only internal APIs the 13.5.1
  release had restored, none of which this repo imports.
- **What holds it:** `src/lib/__tests__/motion-ssr.ssr.test.tsx` renders motion on the server with the real
  library (the `ssr` project mocks nothing): a canary that `initial` still reaches the HTML, and the shared
  providers, the reading bar and the back-to-top button showing their content. Probed by giving the providers a
  hidden first frame (red). The SSR visibility audit over 40 pages on the dev server: 0 findings.
- PR #68 is closed as superseded at go-live, with a link to this note.

## October 31 2026: glob and minimatch, accepted until the fixes clear the release floor

`pnpm audit --prod` lists two moderate advisories, both reached only through Sentry's build-time upload plugin
(`@sentry/nextjs` > `@sentry/bundler-plugin-core` > `glob` 13.0.6 > `minimatch` 10.2.6):

- GHSA-3g3m-2fjr-6pw4, glob: an aborted async walk keeps reading directories in the background. Fixed in glob
  14.0.2, published Oct 27 2026.
- GHSA-g3hv-75wg-m249, minimatch: an attacker-controlled pattern can amplify its own processing. Fixed in
  minimatch 11.0.1, published Oct 27 2026.

The plugin globs our own build output with our own patterns at build time; nothing a visitor sends reaches either
package, and no walk is aborted. Both fixes are under the 7-day release floor until Nov 3, and glob 14 is a major
the plugin doesn't ask for (`^13.0.6`). Accepted in `scripts/daily_monitor.py`'s `ACCEPTED_ADVISORIES` until Nov 4
2026; then an override (`glob@>=14.0.2`, `minimatch@>=11.0.1`) once a production build with Sentry's source-map
upload passes on it, or a Sentry release that asks for them.
