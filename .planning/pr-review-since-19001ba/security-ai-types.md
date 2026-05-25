# Type-Design Review — SECURITY/AUTH + AI/CHAT (since `19001ba`)

Scope: new/modified types in `rateLimitConfig.ts`, `abuseBlocklist.ts`, `abuseDetection.ts`,
`adminSecurity.ts`, `SecurityDashboardClient.tsx`, `signup-validation.ts`, `auth-telemetry.ts`,
`compaction.ts`, `providers.ts`, `summarize.ts`, `conversationSummary.ts`, `ChatCompactionDivider.tsx`,
plus supporting `lib/suspension.ts`. TS strict + `noUncheckedIndexedAccess`. Read current files +
`git diff 19001ba..HEAD`. No `any` and no unsafe `as any` appear in any in-scope file — already a strong baseline.

All paths absolute under `/Users/dev/cc/perm-tracker/`.

---

## Type: `Suspension` + `getUserSuspension` — `v2/convex/lib/suspension.ts`

### Invariants Identified
- "Suspended" = `suspendedAt` set AND (`suspendedUntil` unset OR `suspendedUntil >= now`).
- The schema stores three independent `v.optional` fields (`suspendedAt`/`suspendedReason`/`suspendedUntil`,
  schema.ts:247-249); this helper collapses the triplet into one nullable union so callers never branch on three booleans.

### Ratings
- Encapsulation: Strong. The triplet is read in exactly one place; the doc comment promises a swap-in path if the schema migrates to a nested object.
- Invariant Expression: Strong. `Suspension | null` makes "not suspended" unrepresentable as a partial object; `reason: string | null`, `until: number | null` are explicit.
- Usefulness: Strong. Eliminates the "boolean soup" of three optionals across `abuseDetection`, `adminSecurity`, login gating.
- Enforcement: Good at the read boundary. **Gap: the WRITE side is not funneled through any constructor.** `adminSecurity.adminSuspendUser`/`adminUnsuspendUser` and `abuseDetection.recordAuthFailure` each hand-write the triplet (adminSecurity.ts:199-204, 223-227; abuseDetection.ts:81-85). Nothing prevents a future writer from setting `suspendedUntil` without `suspendedAt`, which `getUserSuspension` would silently read as "not suspended."

### Recommended Improvements
- Add a paired writer (e.g. `applySuspension(patch, {reason, untilMs})` / `clearSuspension(patch)`) in `suspension.ts` returning the exact triplet to spread into `ctx.db.patch`, so reads and writes share one invariant definition. Low cost, closes the only real gap.

---

## Type: discriminated `Event` union — `v2/convex/adminSecurity.ts:89-115`

### Invariants Identified
- Each event variant carries only the fields it owns: `StrikeEvent` has `ip`, `RateLimitEvent` has `actor`, `ErrorEvent` has neither — discriminated by `kind`.
- `severity` is pinned per-variant to a literal (`"warning"`/`"info"`/`"error"`), not free-form.

### Ratings
- Encapsulation: Adequate (type is local to the query; consumers get the inferred shape over the wire).
- Invariant Expression: Strong. This is the textbook fix for "pretend all variants have all of ip/actor/endpoint." The client narrows correctly (`e.kind === "strike" ? e.ip : e.kind === "rate_limit" ? e.actor : "—"`, SecurityDashboardClient.tsx:247).
- Usefulness: Strong. `rate_limit` IS reachable — `rateLimits` holds `auth_fail:*`, `otp_verify`, etc. rows that hit the `else` branch (verified: only `ip_strike` rows route to `strike`). So the union is not dead weight.
- Enforcement: Good. The push sites (lines 119-152) are exhaustive over the read sets; `Event[]` typing forces each `push` to satisfy a full variant.

### Concerns
- The `id` field uses string prefixes (`rl_`/`se_`) to disambiguate two ID spaces flattened into `string`. Works, but the prefix convention is informal — a duplicate `rl_`/`se_` collision is structurally possible if a third source is added. Minor.
- `reason: s.key` for strikes/rate-limits surfaces the raw composite key (`ip_strike:<ip>`) as a human "reason" — semantically thin, but it is admin-only UI.

### Recommended Improvements
- None blocking. Optionally lift `type Event` to a shared module if a second consumer ever needs it; today inline is fine.

---

## Type: local `Id<T>` + `SummaryShape` redefinitions — `v2/src/app/(authenticated)/admin/security/SecurityDashboardClient.tsx`

### Invariants Identified
- `Id<T extends string> = string & { __tableName: T }` (line 37) re-implements Convex's generated branded `Id`.
- `SummaryShape` (lines 131-136) hand-mirrors the return of `adminSecurity.getSecuritySummary`.

### Ratings
- Encapsulation: Weak. Both types duplicate the generated source of truth instead of importing it.
- Invariant Expression: Weak-to-Adequate. The local `Id` brand uses `__tableName`, but Convex's real brand is structurally different — `userId as Id<"users">` (line 428) is a cast through a *look-alike* brand, so it gives a false sense of safety while actually erasing the real nominal check.
- Usefulness: Low. `SummaryShape` will silently drift from the query's real return (`generatedAt` is returned by the query but omitted here; harmless now, but exactly the drift this anti-pattern invites).
- Enforcement: Weak. Nothing ties `SummaryShape` to the query; a field rename on the backend won't error here.

### Concerns
- `getSecuritySummary` returns `generatedAt` (adminSecurity.ts:53) which `SummaryShape` drops — confirms the mirror is already out of sync with the source.
- The home-grown `Id` brand is the project's documented anti-pattern (CLAUDE.md: "Don't remove `Id` type imports").

### Recommended Improvements
- Import `Id` from `convex/_generated/dataModel` and derive the summary type from the API: `type SummaryShape = NonNullable<typeof api.adminSecurity.getSecuritySummary._returnType>` (or `FunctionReturnType<...>`). Removes two redefinitions and makes the dashboard track the backend automatically.

---

## Type: `CompactionFacts` + `CompactionFactsSchema` + `parseFacts`/`mergeFacts` — `v2/src/lib/ai/compaction.ts`

### Invariants Identified
- `CompactionFacts` is the canonical post-normalization shape: `cases: Array<{id, status?}>` (objects, never bare strings).
- The Zod schema enforces "untrusted JSON in → normalized object out" via the `z.string().transform(id => ({id}))` union, so the legacy `cases: string[]` form can never reach a consumer.
- `mergeFacts` invariants: arrays dedupe by a stable key (case id, lowercased name/string), newer wins; `dates` shallow-merge.

### Ratings
- Encapsulation: Adequate. `parseFacts` is the single validated entry point for persisted/LLM JSON; `mergeFacts` centralizes merge rules. **But `CompactionFactsSchema` is not exported**, which forced a duplicate (below).
- Invariant Expression: Strong. The normalize-on-parse transform means downstream `renderFacts`/`mergeFacts` never branch on `string | object` — the "legacy shape" is unrepresentable past the boundary.
- Usefulness: Strong. Prevents real bugs (mixed string/object case entries, unbounded fact stacking).
- Enforcement: Strong at the parse boundary; runtime `safeParse` rejects malformed blobs to `undefined`.

### Concerns
- **DRY/consistency (medium):** `summarize.ts:61-76` `FactsSchema` is a **byte-identical duplicate** of `compaction.ts:70-85` `CompactionFactsSchema` (verified via diff). Two copies of the same untrusted-input contract will drift; a tightening in one silently leaves the other permissive.
- **Unsafe widening cast (low-medium):** `summarize.ts:156` `return object as CompactionFacts`. `object` is the Zod *output* type (cases already normalized to `{id, status?}`), so the cast is currently sound, but `as` defeats the check — if `FactsSchema` and `CompactionFacts` diverge the compiler stays silent. Returning the inferred type (`z.infer<typeof FactsSchema>`) without the cast, or routing through the shared schema, would make it enforced rather than asserted.

### Recommended Improvements
- Export `CompactionFactsSchema` from `compaction.ts` and import it in `summarize.ts`; delete the duplicate `FactsSchema`. Then drop the `as CompactionFacts` cast (the inferred output type already matches). Single source of truth for the LLM-output contract.

---

## Type: `Facts` (third copy) — `v2/src/components/chat/ChatCompactionDivider.tsx:26-32`

### Invariants Identified
- A THIRD hand-rolled facts type, intentionally looser: `cases?: Array<string | {id, status?}>` — accepts the un-normalized legacy form because it may receive either a raw JSON string or an already-parsed object via props.

### Ratings
- Encapsulation: Weak. Re-declares the facts contract a third time, plus a second `parseFacts` (lines 48-57) that only does `typeof === 'object'` validation — no Zod, unlike the canonical one.
- Invariant Expression: Adequate for a presentational component (its `formatCase` does handle both string and object, so the looser type is internally honest).
- Usefulness: Adequate — it renders defensively. But it is a maintenance trap: the component's `parseFacts` would accept `{cases: [{}]}` (no `id`) and then `formatCase` returns `undefined`-ish, whereas the canonical parser would reject it.
- Enforcement: Weak. No schema validation; relies on `typeof` only.

### Concerns
- Three definitions of "facts" now exist (`CompactionFacts`, `FactsSchema`, `Facts`) with two definitions of `parseFacts`. The divider's looser shape is reasonable given props can be pre-parsed, but it should consume the canonical *type* even if it keeps a tolerant runtime parse.

### Recommended Improvements
- Import the rendered shape from `compaction.ts` (e.g. a `RenderableFacts` type, or reuse `CompactionFacts` and accept that props are already normalized). If the component must tolerate legacy strings, keep its runtime guard but type the prop as `string | CompactionFacts | null` so the type contract is shared.

---

## Type: `FallbackModel` / `ModelConfig` / `ErrorLike` — `v2/src/lib/ai/providers.ts`

### Invariants Identified
- `FallbackModel` invariant: `configs.length > 0` (enforced in constructor, providers.ts:271). All `configs[0]!` / `configs[i]!` non-null assertions are justified by this guard + loop bounds.
- `implements LanguageModelV3` with `specificationVersion = 'v3' as const` — structurally a drop-in model.
- `maxInputTokens?` is opt-in per model; a model is skipped only when both it declares a limit AND an estimate exists (providers.ts:296-300) — fixes the prior `maxInputTokens=0` footgun (commit 3ce734b).

### Ratings
- Encapsulation: Strong. Per-request isolation via `forRequest()`; mutable `_lastUsedModel`/`_lastAttemptCount` are private with read-only getters.
- Invariant Expression: Strong. The non-empty-configs invariant is enforced at construction, so the `!` assertions are honest, not papering over `noUncheckedIndexedAccess`.
- Usefulness: Strong. The class makes "no model configured" a construction-time throw rather than a runtime `undefined.doStream`.
- Enforcement: Strong at construction. `ErrorLike` (line 217) is a structural narrowing for vendor errors whose `statusCode`/`status` typing varies — used read-only in `formatError`, an acceptable `as ErrorLike` after an `instanceof Error` guard.

### Concerns
- `wrapMistralModel<T extends LanguageModelV3>(...): T` ends with `as T` (line 162). `wrapLanguageModel` returns `LanguageModelV3`, not the input subtype `T`, so the cast widens the return to the caller's `T`. Sound in practice (callers use it as `LanguageModelV3`), but the generic over-promises; `(model): LanguageModelV3` would be more honest and drop the cast.
- `maxInputTokens` is a bare `number` with an implicit "tokens" unit and an implicit non-negative invariant — fine given the single call site, but a `Brand`/`>= 0` note is the only thing missing.

### Recommended Improvements
- Change `wrapMistralModel` signature to return `LanguageModelV3` (drop generic + `as T`). Optional only.

---

## Type: `FieldValidation` / `FieldState` — `v2/src/lib/auth/signup-validation.ts`

### Invariants Identified
- `FieldState = "pristine" | "valid" | "invalid"` — three explicit UI states, no booleans.
- Implicit coupling: `message`/`reason` are populated only when `state === "invalid"` (and `reason` is promised to "never contain user input").

### Ratings
- Encapsulation: Strong. Pure functions, no state; each validator returns a fully-formed `FieldValidation`.
- Invariant Expression: Adequate. `state` is a clean union, but `message?`/`reason?` are loosely optional on ALL states rather than a discriminated union (`{state:"invalid", message, reason}` vs `{state:"valid"|"pristine"}`). So `{state:"valid", message:"oops"}` is representable but meaningless.
- Usefulness: Strong. The `reason` code channel (telemetry-safe) is a genuinely good design — it lets `auth-telemetry.ts` report structural reasons without leaking field contents.
- Enforcement: Adequate. Convention-only that `reason` excludes PII; not type-enforced (it's `string`), but the call sites only pass literal codes.

### Concerns
- "message/reason present iff invalid" lives in the comment, not the type. A discriminated union would make `state==="valid"` exclude `message` at compile time.

### Recommended Improvements
- Optional: make it a discriminated union on `state` so only the `invalid` variant carries `message`/`reason`. Low value vs. churn — the current shape is already safe in practice; flag for awareness, not action.

---

## Type: telemetry unions — `v2/src/lib/auth/auth-telemetry.ts`

### Invariants Identified
- `AuthSurface`, `TurnstileFailReason`, the abuse `kind` union, and the `method` literals are all closed string-literal unions — misspelled surfaces/reasons fail to compile.
- Routing invariant (doc-enforced): validation/field events → PostHog only; infra failures → Sentry. Expressed by which helper you call, not by a type.

### Ratings
- Encapsulation: Strong. All PostHog/Sentry calls funnel through these named helpers; no raw `analytics.capture` at call sites for these events.
- Invariant Expression: Strong for the closed unions; Adequate for the props bags (`Record<string, string | number>`) which are intentionally open.
- Usefulness: Strong. The closed unions make event taxonomies typo-proof; the PostHog-vs-Sentry split is a real anti-noise invariant.
- Enforcement: Good. The only soft spot is `trackSignupFieldInvalid(field: string, reason: string)` — both are bare `string`, so a typo'd field/reason compiles. Given these feed analytics dimensions, a tighter `reason` type (reuse the `FieldValidation.reason` codes) would help.

### Recommended Improvements
- Optional: type `reason` against the known `FieldValidation` reason codes (`"EMPTY" | "INVALID_FORMAT" | "TOO_SHORT" | "MISMATCH" | ...`) so telemetry dimensions stay a closed set.

---

## Type: `abuseBlocklist` return shapes — `v2/convex/abuseBlocklist.ts`

### Invariants Identified
- `isIpBlocked` returns a discriminated union on `blocked`: `{blocked:false}` vs `{blocked:true, expiresAt, reason, manualOverride}` (uses `false as const`/`true as const`, lines 63-69) — narrowing works for the consumer.
- Active-block invariant centralized in `findActiveBlock` (`expiresAt > now`, line 51), reused by `isIpBlocked`.
- `normalizeIp` is the single normalization point; every read/write normalizes first.

### Ratings
- Encapsulation: Strong. `findActiveBlock` / `normalizeIp` are the shared primitives; `getBlockInternal` separates raw access from gated access.
- Invariant Expression: Strong for `isIpBlocked` (proper `as const` discriminant). Adequate elsewhere.
- Usefulness: Strong.
- Enforcement: Mostly strong, with consistency gaps below.

### Concerns
- **Inconsistent ad-hoc return shapes across mutations (low-medium):** `recordStrike` returns `{blocked:false}` | `{blocked:false, strikes}` | `{blocked:true, strikes, expiresAt}`; `adminBlockIp` returns `{blocked, ip, expiresAt}`; `adminUnblockIp` returns `{unblocked, ip}`. Each is a fresh inline shape — no shared `BlockResult` type, so callers can't reason uniformly and the optional `strikes` makes some success/failure fields structurally indistinguishable.
- `listActiveBlocks` returns full `Doc<"abuseBlocklist">` rows (admin-only, acceptable) — couples the dashboard to the raw schema doc.

### Recommended Improvements
- Define a small named result type (e.g. `BlockOutcome`) shared by `recordStrike`/`adminBlockIp` so the "did we block + when does it expire" answer has one shape. Low cost.

---

## Type: `RateLimiter` config — `v2/convex/rateLimitConfig.ts`

### Invariants Identified
- A config-object literal keyed by named limits; types come entirely from `@convex-dev/rate-limiter` (`kind`, `rate`, `period`, `capacity`).

### Ratings
- Encapsulation / Expression / Usefulness / Enforcement: Strong-by-delegation. The component's types enforce the shape; the keys become the typed `limit(ctx, "caseCreate", ...)` name set. There is no new type to critique — it correctly leans on the library's types rather than re-inventing them. No issues.

---

## Cross-cutting summary

Strong baseline: zero `any`, real discriminated unions (`Event`, `isIpBlocked`), construction-time
invariants (`FallbackModel`), and a deliberate normalize-on-parse boundary for untrusted LLM JSON.

The recurring weakness is **duplicated type definitions instead of one source of truth**:
- "facts" shape declared 3× (`CompactionFacts`, `FactsSchema`, `Facts`) + 2 `parseFacts`.
- `Id<T>` and `SummaryShape` re-declared in the client instead of importing generated types.
- per-mutation ad-hoc result objects in `abuseBlocklist.ts`.
- the suspension triplet has a typed reader but no typed writer.

None are bugs today; all are drift hazards that the strict compiler cannot catch because each copy is
internally consistent. Consolidating to shared exports is low-risk and high-leverage.
