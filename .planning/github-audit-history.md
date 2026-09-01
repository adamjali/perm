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
- **`pnpm typecheck` must stay the both-checkers script**: this repo has TWO tsconfigs with different `lib` targets and different include globs — app (`esnext`, **excludes** `**/*.test.ts`) and `convex/` (`ES2021`, includes everything). `Array.prototype.at` compiles under one and fails under the other. `typecheck` = `typecheck:app && typecheck:convex`. Do not "simplify" it back to a single command. Pure Convex check is `tsc -p convex --noEmit`; `convex codegen` also uploads to the deployment, so it is not a typecheck substitute.
- **All email goes through `sendEmailWithRetry`, never `resend.emails.send()`**: the SDK returns `{data:null,error}` for 429/422/network failures and **never throws**, so a bare send with a try/catch advances downstream state on failure and logs nothing. The wrapper also enforces the recipient blocklist, whose docstring claims no code path can bypass it. Grep for direct `.emails.send(` on any audit.
- **A per-identity rate limit is not a quota control**: per-address cooldowns and per-IP limits are cost-raisers; an attacker rotating either walks straight through. Any endpoint that can spend the shared 100/day Resend quota needs a **global budget** on the sends themselves, because that quota is shared with password resets and OTP and exhausting it is a real outage.
- **`ctx.scheduler.runAfter` discards return values**: a batched function that returns `{sent, remaining}` to a scheduler resumes nothing. Batched work must reschedule itself, guarded on having made progress so a total outage cannot spin a timer.
- **Probe a fix by reverting it**: after fixing a reviewed defect, revert the fix and confirm the new test goes red before claiming coverage. Applies the existing "probe every gate with a broken input" policy to your own patch.
- **Every verification sweep needs a control string**: assert one phrase you know is still present in the same run. A `grep -F` pattern containing `\n` matches a literal backslash-n and reports everything clean (hit twice on 2026-08-23).
- **`@sentry/nextjs` is pinned at `~10.70.0` and `dependabot.yml` ignores `>=10.71.0`** (Audit 9). 10.72+ vendors an ESM file that calls `fileURLToPath(import.meta.url)` at module load into their CJS build; Vitest cannot resolve that to a `file://` URL, so the import throws `ERR_INVALID_URL_SCHEME`. On 10.73.0 that failed 24 test files and stopped 109 more from running, while the **production build stayed green** — so a build-only check would have shipped it. Drop the pin when upstream stops touching `import.meta.url` in the vendored copy.
- **No `@ai-sdk/*` provider declares a peer on `ai`** (Audit 9). A spec mismatch is therefore a RUNTIME failure, not an install error, and `pnpm install` will happily assemble a broken set. Before any `ai` major, check (a) which `@ai-sdk/provider` major it pulls (that is the `LanguageModelVn` contract this repo implements directly in `FallbackModel`) and (b) whether the third-party providers have a release for it. `@openrouter/ai-sdk-provider` is the gating one.
- **`useChat`'s `onFinish` in `@ai-sdk/react` is NOT deprecated**, unlike `onFinish` on the `ai` package (Audit 9). Never rename it in a blanket pass; it drives chat persistence.
- **A library-wide identifier rename needs an AST codemod, never a regex** (Audit 9). The Phosphor bare names are ordinary words (`Archive`, `Warning`, `Calendar`, `Search`) that also appear in user-visible copy and strings; ~206 of ~960 occurrences sat in JSX text, strings or comments. Walk `Identifier` nodes with the repo's own `typescript` and JsxText/StringLiteral/trivia become unreachable by construction. Also: an aliased import keeps its local name, and a SHORTHAND property is also the object's key, so expand it (`{ Briefcase: BriefcaseIcon }`) rather than renaming or skipping.
- **A `vi.mock` factory's keys are EXPORT names and must track the source imports** (Audit 9). A factory replaces the whole module, so an export the component asks for and the factory does not define is a hard error at render. Nothing is type-wrong (a factory is untyped against the real module), so only running the suite finds it. This is a concrete reason `pnpm test:run` cannot be replaced by `typecheck`.
- **`gh pr close --comment` silently DROPS the comment when the PR is already closed** (Audit 9), and still exits 0. Dependabot auto-closes its PRs the moment the change lands on main, so this is the normal case. Post with `gh pr comment` and then re-read the thread to confirm; do not trust the exit code.
- **Run the production build in the FOREGROUND on this machine** (Audit 6, reconfirmed Audit 9). Two explicitly-backgrounded `pnpm build` runs were killed mid-compile under memory pressure; the same build in the foreground completed. Check `sysctl -n vm.swapusage` first, and clear a stale `.next/lock` left by a killed build.
- **eslint runs in NO workflow** (Audit 9). The only "Lint" step is the pyflakes pass over the Python ingests, so app-code lint errors accumulate invisibly (8 had). Run `pnpm exec eslint src convex` as part of any audit, and note that `--format unix`/`compact` were removed from ESLint core, so a bad `--format` exits 2 and an unwary `2>/dev/null` turns that into a silent "0 errors".
- **`pnpm test:run` is the pre-push gate, never `pnpm test:fast`**: `test:fast` runs 2 of 4 vitest projects and skips `components` (which owns `src/app/**`) and `convex`. A green `test:fast` plus a green `--project convex` still shipped a red CI on 2026-08-23, because the broken file lived in the only project neither command runs. Same family as the two-typechecker policy above: enumerate what a check actually covers before trusting it.

## Audit 9 — 2026-09-01
- **health_before:** 100/100 by rubric; 0 dependabot alerts, 0 secret-scanning, 10 code-scanning "error" (all verified false positives), 8 open Dependabot PRs
- **health_after:** 100/100; 0 open PRs, 0 lint errors, CI + CodeQL green on the pushed commit
- **items_fixed:** 1 blocking regression + 8 lint errors + 22 stale action refs + 177-file icon migration
- **items_discussed:** 4 (all via AskUserQuestion; user expanded scope on two)
- **prs_merged:** 0 (**8 closed as superseded**, each with its specific reason)
- **quality_issues_fixed:** 8 eslint errors that no CI gate has ever run
- **deployed:** yes — `0e774ee1` + `a0614fd6` pushed to main, Vercel READY and verified live. **No Convex deploy** (`convex/` untouched)
- **duration:** ~3h

### Changes Made
- **AI SDK v6 → v7.** `ai` 6.0.273 → 7.0.87 plus all five providers and `@openrouter/ai-sdk-provider` 2.10 → 3.0. The real work is that `@ai-sdk/provider` went 3.x → 4.x, i.e. `LanguageModelV3` → `V4`, and `FallbackModel` implements that interface directly. Migrated the class, its `specificationVersion`, and the `wrapMistralModel` middleware. Deprecated APIs moved on the `ai` package only: `system`→`instructions`, `onFinish`→`onEnd`, `generateObject`→`generateText` with `Output.object`. `@ai-sdk/provider` was imported by `providers.ts` while absent from `package.json`; now explicit.
- **`@sentry/nextjs` pinned to `~10.70.0`** after 10.73.0 broke the suite (see Saved Policies), with a matching `dependabot.yml` ignore.
- **8 eslint errors fixed.** Five were `react-hooks/refs` in `CaseBrowser`, where a ref was written AND read during render to retain the last non-empty rows; replaced with state set from an effect, provably loop-free because `prevRows` is only read when `shown` is empty.
- **Every GitHub Action normalized.** `actions/checkout` alone was spread across four majors (v4 ×5, v5 ×1, v7 ×6). All 22 refs now current, with zero exposure to the two real v7 breaking changes.
- **Phosphor `*Icon` migration: 177 files, 628 specifiers, 559 references**, via a TypeScript AST codemod. 0 bare specifiers remain of 636.

### Decisions
- **Full AI SDK v7 rather than the three provider PRs** — user's call over my recommendation to defer. Correct in hindsight: the providers alone would have been a silent spec mismatch, since none declares a peer on `ai`.
- **Fix all 8 lint errors now** — user's call over my recommendation to log them. The `react-hooks/refs` five were genuine concurrent-rendering hazards, not just compiler advice.
- **`image-size` still ACCEPTED / leave-open**, re-verified rather than inherited: 2.0.2 IS the latest published version and it is the vulnerable one, so no override target exists.
- **10 CodeQL "error" alerts verified false positives**: 2 × `run-shell-injection` read a `workflow_dispatch` input typed `choice` (GitHub validates server-side), and 7 × `sqlalchemy-execute-raw-query` are libSQL HTTP calls whose f-strings interpolate only `?` placeholders or module constants. SQLAlchemy is not a dependency.

### What went wrong, and what it cost
- I asserted another session was mid-deploy. **It was my own orphaned watcher**, and the PPID proved it in one command. Two of my pollers had been spinning 12h and 42h; killing them and an orphaned `next-server` freed ~2GB of swap.
- I trusted `gh pr close --comment`'s exit code; **all 8 comments silently never posted**.
- The Phosphor codemod's one gap (`vi.mock` factory keys) was caught by the suite, not by typecheck. Two build runs were killed under memory pressure before I applied Audit 6's own foreground-build note.

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

## Archived Summaries
- **Audit 6 — 2026-08-03**: health 0→100. 20 Dependabot alerts (2 critical, 11 high) cleared: next 16.2.12, @auth/core 0.41.3, sharp 0.35.3, @vitest/browser 4.1.10, plus override floors (postcss, brace-expansion, dompurify, fast-uri, sharp, undici). Method: caret `pnpm update` then overrides then a full `pnpm install` to re-resolve, because `pnpm update` alone does not re-apply overrides to locked entries. Added `Typecheck + Vitest` to required checks; `enforce_admins` left false so direct pushes to main (the deploy path) keep working. Machine note now promoted to a Saved Policy: backgrounded builds get killed, foreground ones complete.
- 2026-06-29: health 94->97, fixed dompurify CVE + caret bulk update, closed 4 PRs
- 2026-06-09: see archived summary
- 2026-05-24: see archived summary
- **Audit 2 — 2026-04-21**: 2 Dependabot alerts (critical protobufjs RCE 7.5.4→7.5.5, medium dompurify 3.3.3→3.4.1) + 4 code-scanning + 5 PRs + 3 Sentry deprecations + Next 16 middleware→proxy. Bulk deps, Sentry config migration (`disableLogger`/`automaticVercelMonitors` → webpack block), deleted empty `sentry.client.config.ts`, renamed `middleware.ts`→`proxy.ts`, @types/node policy v22→v24. All 5 PRs superseded, deployed (`2db97e0`, Convex + Vercel).
- **Audit 1 — 2026-04-11**: 27 vulns (10H/15M/2L) + 1 critical CVE (next 16.1.5→16.2.3, RSC DoS) + 9 stale PRs → bulk dep update (13+), all PRs closed superseded, deployed (`0eae6c6`). One-offs: lucide brand-icon inlining, static `icon.png` (Edge size), @types/node→22 (later 24), TS 6 / Vite 8 majors kept.
