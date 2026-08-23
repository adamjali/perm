# GitHub Audit History

## Saved Policies
<!-- Persistent rules applied automatically on future audits -->
- **sharp — track the CVE floor, never pin to Next's copy**: sharp is NOT a peerDependency of next (next declares only sass, react, react-dom, @playwright/test, @opentelemetry/api, babel-plugin-react-compiler). Duplicate libvips comes from two *installed copies*, which a `pnpm.overrides.sharp` entry collapses. Audit 6: sharp was pinned to ^0.34.5 "to match Next's peer" while 0.34.5 carried a HIGH CVE (GHSA-f88m-g3jw-g9cj), and the Dependabot bump was wrongly waved off. Always check the advisory before declining a bump on peer-compatibility grounds.
- **SECURITY.md false positive**: the community-profile API returns `files.security: null` for this repo even though SECURITY.md exists at the root, is committed, and health_percentage is 100. Do not score -5 or propose creating one on the strength of that field; check `contents/SECURITY.md` instead.
- **@types/node**: pin to v24 — matches `engines.node: 24.x` (Vercel Node 24 runtime). Dependabot ignores major bumps.
- **Dependabot security PRs for `next`**: auto-merge after local verification (config ignores non-security next bumps)
- **lucide-react v1+ brand icons**: inline SVGs in place (Github, Twitter, Linkedin) — no external icon package
- **next/og dynamic icon route**: avoid — exceeds 1 MB Edge Function limit. Use static `src/app/icon.png` instead
- **pnpm update --latest**: do NOT run blindly — bumps TypeScript/Vite/etc to majors. Prefer `pnpm update` (respects caret) + manual major review
- **Transitive CVE fixes**: `pnpm update` (caret) first; for stubborn transitive vulns add `pnpm.overrides` (e.g. postcss, ws, brace-expansion) then re-`pnpm audit` to confirm clean
- **Semgrep lockfile noise**: lockfiles excluded from Semgrep code rules via `.semgrepignore` (Dependabot covers lockfile CVEs) — do not re-enable code-scanning on lockfiles
- **Dependabot grouped PRs**: close as superseded after a verified bulk `pnpm update` (established across audits 1–3)
- **claude-review CI auth**: uses `CLAUDE_CODE_OAUTH_TOKEN` (Max-subscription OAuth via `claude setup-token`), not `ANTHROPIC_API_KEY`. Token expires — if the job fails auth, regenerate + re-set the secret. Workflow uses the official code-review plugin + `--model claude-opus-4-7` + `pull-requests: write` + `--comment` + bot-PR skip filter.
- **Style-object types**: define as `Pick<React.CSSProperties, …>` (not a standalone `{…}` interface) — csstype tightening in React minor bumps breaks structural assignment to a `style` prop (Audit 4: `TiltStyle` → `FeaturesGrid` TS2322 under React 19.2.7).
- **js-yaml DoS (GHSA-h67p-54hq-rp68)**: ACCEPTED / leave-open (Audit 5). Transitive via `gray-matter@4.0.3` (latest, unmaintained) which calls `js-yaml.safeLoad`/`safeDump` — **removed in 4.x**, so forcing the patch (`>=4.2.0`) breaks all MDX frontmatter parsing. No exploit path: gray-matter only parses **repo-authored** MDX frontmatter, never untrusted input. Do NOT add a `js-yaml` override. If ever fixing for real: pass a custom js-yaml-4 engine to gray-matter via `content/index.ts`, then override. Otherwise expect 1 moderate `pnpm audit`/Dependabot entry to persist.
- **dompurify CVE refresh**: when a new dompurify advisory lands, bump the existing `pnpm.overrides.dompurify` floor to the patched version (Audit 5: `>=3.3.2` → `>=3.4.11`; Audit 7: `>=3.4.12` → `>=3.4.13` for the IN_PLACE detached-subtree XSS, which made the previous floor exactly one patch short). It's transitive-only; the override is the canonical pin.
- **Override floors must cap the major**: a bare `">=x.y.z"` in `pnpm.overrides` accepts *anything* above it, including majors. Audit 7: `nanoid: ">=3.3.18"` (a patch-level advisory fix) resolved to **6.0.1**, three majors up and ESM-only, while the only consumer is `postcss@8.5.25` asking for `^3.3.11`. Correct form is `">=3.3.18 <4"`. Always write the ceiling when the advisory is a patch fix, then re-`pnpm install` and confirm the resolved version.
- **image-size (via @storybook/nextjs-vite)**: ACCEPTED / leave-open. Two HIGH DoS advisories (ICNS, and JXL/HEIF infinite loops) with `patched_versions: <0.0.0`, meaning **no fixed release exists**. devDependency only, never ships. Do not invent an override floor: there is no version to float to. Re-check when upstream publishes.

- **Community-profile `issue_template: null` is a false positive too**: same unreliable endpoint as the SECURITY.md case. `.github/ISSUE_TEMPLATE/` holds bug_report.yml + feature_request.yml and health_percentage is 100. Verify on disk, never from that field.
- **Health rubric has no code-scanning term**: a repo can score 100 with open HIGH CodeQL alerts (Audit 8 did). Always report CodeQL severity counts alongside the score rather than letting the number stand alone.
- **Never build a RegExp from a variable in parser code**: `security/detect-non-literal-regexp` is right, and a fixed tag set should be literal patterns. Also avoids recompiling per call.
- **Decode HTML entities in ONE pass**: chained `.replace` lets `&amp;` -> `&` be re-read as the start of `&lt;`, turning literal `&amp;lt;` into `<`. Use a single alternation with a lookup map.

## Audit 8 — 2026-08-22
- **health_before:** 100/100 by rubric, but 4 open HIGH CodeQL alerts the rubric does not score
- **health_after:** 100/100 and 0 open alerts at every severity (dependabot, secret-scanning, CodeQL high)
- **items_fixed:** 4 (all CodeQL HIGH) + 1 lint warning
- **items_discussed:** 2 (CodeQL handling; enforce_admins/required-reviews, both declined)
- **prs_merged:** 0 (0 open PRs at audit time)
- **quality_issues_fixed:** 1 (security/detect-non-literal-regexp introduced by the fix itself)
- **deployed:** yes (Convex required, convex/ touched)
- **duration:** ~35 min

### Changes Made
- **js/double-escaping** (`dolProcessingTimes.ts`): entity decoding was a chain of `.replace` calls with `&amp;` decoded BEFORE `&lt;`, so the literal text `&amp;lt;` became `<`, a value DOL never published. Now one pass over a single alternation with a lookup map, which cannot double-unescape.
- **js/bad-tag-filter + js/incomplete-multi-character-sanitization** (x3): script/style stripping used `<\/script>`, which does not match `</script >` (HTML allows whitespace before the bracket), and had no `\b` so `<scripting>` matched as `<script>`. Now literal whitespace-tolerant patterns applied until the output stops changing, since one lazy pass leaves the outer closer of a nested block behind.
- Lint: the first fix built a RegExp from a tag-name variable and tripped `security/detect-non-literal-regexp`. Replaced with two literal patterns rather than suppressed.
- 5 regression tests added, one per CodeQL finding plus malformed-markup behaviour. Parser suite 38 -> 43.

### Decisions
- **Fix the parser rather than dismiss**: React escapes the parser's output so the XSS framing overstated it, but the double-unescape was a real correctness bug on its own merits. User chose fix.
- **enforce_admins stays false**: direct pushes to main are the deploy path (carried from Audit 6). Declined again.
- **Required reviews stay off**: sole maintainer. Declined.
- **Parity verified live, not just by tests**: after the fix, `dolProcessingTimes:refresh` against live DOL returned "unchanged since last publication", meaning the content hash was byte-identical to what the original parser stored. The hardening altered zero parsed values.

## Audit 7 — 2026-08-22 (Search Console driven)
- **Trigger**: reviewing Google Search Console, not a scheduled audit. 21 pages listed "not indexed"; only 2 of the 6 reasons were real defects, the rest were correct canonicalisation/noindex behaviour being reported as if it were a problem.
- **Fixed (SEO/crawl)**: `/register` was a live 404 (redirect list covered `/register.html` only) → 308 to `/signup`. Every robots.txt `Disallow` carried a trailing slash, so `/admin/` never matched `/admin`; robots paths are prefix matches, so the slashes were dropped after checking that no public route (notably `/security`) collides. Next generates a crawlable route per `opengraph-image.tsx`; five sat under "Crawled - currently not indexed" and now send `X-Robots-Tag: noindex` via `source: "/:path*/:og(opengraph-image.*)"`, verified against path-to-regexp 6.3.0 before writing.
- **Fixed (content)**: `guides/perm-recruitment-checklist` was the one genuinely un-indexed *page*. Markup was already correct (canonical, index/follow, Article JSON-LD); it was 826 words of near-pure bullets vs 2,712 for the guide that ranks, i.e. a Google quality verdict, so it was expanded to 2,115 words with the derived timing math (180-day ceiling, 30-day floor, the day-150 deadline that falls out of both, per-step latest start dates, business-day notice math).
- **Content error found via primary source**: reading 20 CFR 656.17 from eCFR (rather than from memory) showed `guides/ultimate-perm-guide-2026` listed "Company Website Posting" as **mandatory step 3**. The employer's website is 656.17(e)(1)(ii)(B), one of ten *additional* options. Only the job order and two Sunday ads are mandatory under (e)(1)(i). Corrected and renumbered.
- **Deps**: 2 new alerts (nanoid HIGH, dompurify MODERATE), both transitive, both fixed by override floors. See the new "Override floors must cap the major" policy.
- **Verification method**: dev server rather than inspection for the redirect/header behaviour; `@mdx-js/mdx` compile for all three guides; live production curl after deploy for all four fixes.
- **Deployed**: 3 commits to `main`, two Vercel production deploys, both Ready and verified live. No Convex changes.
- **Open / not done**: 256 em-dashes remain across 12 of 14 `content/*.mdx` files (only the 2 guides touched here are clean); `tutorials/getting-started.mdx` alone has 98. They leak into related-post cards and JSON-LD on otherwise-clean pages. Dependabot has 5+ non-security version PRs open again.

## Audit 6 — 2026-08-03
- **health 0 -> 100**: 20 open Dependabot alerts (2 critical, 11 high, 6 medium, 1 low) cleared to zero; `pnpm audit` reports no known vulnerabilities. Secret scanning already clean; code scanning findings are all note/warning, no error severity.
- **Fixed**: next 16.2.9->16.2.12 (9 alerts), @auth/core 0.41.2->0.41.3 (3, incl. 1 critical), sharp 0.34.5->0.35.3 (2 high), @vitest/browser->4.1.10 (1 critical, dev). Override floors raised: postcss >=8.5.18, brace-expansion >=5.0.8, dompurify >=3.4.12 (per Saved Policy), plus new fast-uri >=3.1.4, sharp >=0.35.0, undici >=6.27.0 (all 9 remaining audit findings were one package via @ai-sdk/cerebras).
- **Method**: caret `pnpm update` per Saved Policy (never --latest), then overrides for stubborn transitives, then full `pnpm install` to re-resolve — `pnpm update` alone does NOT re-apply overrides to already-locked entries, which is why sharp looked unfixed at first.
- **Governance**: added `Typecheck + Vitest` to required status checks on main. `enforce_admins` left false deliberately so direct pushes to main (the deploy path) keep working. Required reviews left off: sole maintainer.
- **No Convex deploy**: zero `convex/` changes, frontend-only -> Vercel only.
- **Machine note**: five build attempts failed on ENOSPC before ~23 GB was freed. Explicitly-backgrounded builds got killed; a foreground build auto-moved to background completed. Prefer the latter on this machine.

## Archived Summaries
- 2026-06-29: health 94->97, fixed dompurify CVE + caret bulk update, closed 4 PRs
- 2026-06-09: see archived summary
- 2026-05-24: see archived summary
- **Audit 2 — 2026-04-21**: 2 Dependabot alerts (critical protobufjs RCE 7.5.4→7.5.5, medium dompurify 3.3.3→3.4.1) + 4 code-scanning + 5 PRs + 3 Sentry deprecations + Next 16 middleware→proxy. Bulk deps, Sentry config migration (`disableLogger`/`automaticVercelMonitors` → webpack block), deleted empty `sentry.client.config.ts`, renamed `middleware.ts`→`proxy.ts`, @types/node policy v22→v24. All 5 PRs superseded, deployed (`2db97e0`, Convex + Vercel).
- **Audit 1 — 2026-04-11**: 27 vulns (10H/15M/2L) + 1 critical CVE (next 16.1.5→16.2.3, RSC DoS) + 9 stale PRs → bulk dep update (13+), all PRs closed superseded, deployed (`0eae6c6`). One-offs: lucide brand-icon inlining, static `icon.png` (Edge size), @types/node→22 (later 24), TS 6 / Vite 8 majors kept.
