# Type-Design Review — Convex Backend + Marketing/Email (since `19001ba`)

Scope: non-test files in `_files-convex.txt` + `_files-email.txt`. Focus on new/changed
types: `schema.ts` tables/fields, `marketingEvents`/`marketingWebhook`, `marketingEmail`
contact shapes, `systemErrors` source union, `suspension.ts` reader/writer asymmetry,
`notifications`, `lib/perm/constants.ts`. Convex `v.*` validator semantics verified against
the live webhook handler (`http.ts`) and writers (`abuseDetection.ts`, `adminSecurity.ts`,
`errorRecording.ts`). No code was changed.

---

## Executive Summary

The new types are, on balance, well-designed. The standout wins are the literal-union
tightening of `marketingEvents.eventType` (from `v.string()` → 4 literals) paired with a
proper type-guard at the webhook boundary, and the `marketingEvents` table itself being a
clean append-only audit shape with idempotency baked into the index design.

The two real design defects are both *cross-file consistency* problems, not local ones:

1. **`systemErrors` source union drift** — the schema validator accepts `"query"` but the
   `record` mutation validator (and the `ErrorSource` TS type in `errorRecording.ts`) do
   not. The wider type is unreachable; the narrower types silently forbid a state the table
   was designed to hold.
2. **`suspension.ts` is a typed *reader* with no matching typed *writer*** — the invariant
   it documents ("suspended = a coherent combination of three fields") is enforced on the
   read path but every write path sets the three raw optionals independently, so illegal
   triplets remain representable and the encapsulation is one-sided.

Everything else is minor (untyped Resend JSON, boolean-soup in `userProfiles`, `NaN`-able
`occurredAt`).

---

## Type: `marketingEvents` (table) + `recordContactEvent` (mutation)

`schema.ts:967-990`, `marketingWebhook.ts:21-68`

### Invariants Identified
- `svixId` is the idempotency key — at most one row per svix message (enforced via
  `by_svix_id` index + explicit `.first()` check in the mutation, not a DB uniqueness
  constraint).
- `eventType ∈ {contact.created, contact.updated, contact.deleted, contact.backfill}` —
  first three are live webhook deliveries, the fourth is synthetic (backfill only).
- Append-only: Resend is source of truth; this is a mirror.
- `occurredAt` is epoch-ms.

### Ratings
- **Encapsulation**: 8/10 — schema validator and mutation arg validator are identical
  literal unions, so the table can't be written through `recordContactEvent` with a bad
  `eventType`. The one gap: idempotency is enforced by application code (`.first()` +
  conditional insert), not a unique index, so a concurrent double-delivery of the same
  `svixId` could in principle race two inserts. For an append-only audit mirror this is
  acceptable, but it's worth noting the invariant is *convention*, not *structure*.
- **Invariant Expression**: 9/10 — the literal union makes the closed set of event types
  obvious and self-documenting; the schema comment explicitly records the `v.string()` →
  union tightening and asserts existing rows conform. Excellent.
- **Invariant Usefulness**: 9/10 — narrowing to literals enables the `by_event_type_and_time`
  index to be queried with type-checked discriminants and makes downstream churn analytics
  exhaustive-switch-friendly.
- **Invariant Enforcement**: 8/10 — construction-time enforcement via the matching
  validator; the live path (`http.ts:62-71`) narrows `body.type` through the
  `isContactEventType` type guard *before* calling, so `contact.backfill` can never arrive
  from the webhook, and the 3 live literals can never be smuggled past as `string`. Clean.

### Strengths
- Webhook boundary uses a real type guard (`http.ts:68-69`) rather than a cast — untrusted
  `body.type: unknown` is narrowed to `ContactEventType` before crossing into typed code.
- Backfill reuses the *same* mutation with `svixId = backfill_<contactId>`, so the
  idempotency invariant is shared across live + synthetic paths rather than re-implemented.
- `rawPayload` retained for forensics; size-capped at the boundary (`http.ts:94`).

### Concerns
- **Type duplication across 3 sites.** The 4-literal union is written out verbatim in
  `schema.ts:975-980`, `marketingWebhook.ts:27-32`, and the live subset in `http.ts:62-66`.
  Nothing keeps them in sync; a future 5th event type must be added in three places or the
  table silently rejects/accepts the wrong set. A single exported
  `const CONTACT_EVENT_TYPES = [...] as const` + `v.union(...CONTACT_EVENT_TYPES.map(v.literal))`
  (or a shared `marketingEventTypeValidator`) would make the closed set single-sourced.
- `occurredAt` can be `NaN`: `http.ts:85-87` does `new Date(body.created_at).getTime()`
  with no validity check; a malformed `created_at` string yields `NaN`, which `v.number()`
  *accepts* (NaN is a number to Convex). The `epoch-ms` invariant is documented but not
  enforced. Low severity (debugging/analytics only), but it's a representable illegal state.

### Recommended Improvements
- Single-source the event-type literal set and derive both the validator and the live-subset
  guard from it. This is the one change with real leverage — it converts a convention into a
  structural guarantee at low cost.
- Optionally guard `occurredAt` (`Number.isFinite(t) ? t : Date.now()`) at the http boundary.

---

## Type: `systemErrors` (table) vs `ERROR_SOURCE` (mutation) vs `ErrorSource` (TS)

`schema.ts:941-960`, `systemErrors.ts:13-18`, `errorRecording.ts:33`

### Invariants Identified
- `source` is a closed set of error origins.

### The defect (source union drift)
The schema declares **five** sources:
`"mutation" | "action" | "query" | "cron" | "webhook"` (`schema.ts:942-948`).
The `record` mutation's `ERROR_SOURCE` validator declares **four** — it omits `"query"`
(`systemErrors.ts:13-18`). The `recordError` helper's `ErrorSource` TS type *also* omits
`"query"` (`errorRecording.ts:33`).

Net effect: the schema's `"query"` literal is **unreachable** — there is no writer that can
ever produce it (the only writer, `recordError`, can't type it and the mutation would reject
it). The schema is strictly wider than its enforced surface. This is the classic
"validator/type drift" footgun: the *declared* set of legal states and the *enforceable*
set disagree, and the reader of `schema.ts` is misled into thinking query-sourced errors
exist or are supported.

### Ratings
- **Encapsulation**: 6/10 — the table can only be written via the internal mutation (good),
  but the mutation's accepted set silently diverges from the schema's allowed set.
- **Invariant Expression**: 5/10 — three copies of "the set of sources," two of which
  disagree with the third. A reader cannot tell from any single file what the real closed
  set is.
- **Invariant Usefulness**: 7/10 — literal sources are genuinely useful for the
  `by_source` index and admin filtering; the concept is right.
- **Invariant Enforcement**: 6/10 — enforced, but against the *wrong* (narrower) set vs.
  what the schema advertises. No invalid row can be written, but a legitimately intended
  state (`source: "query"`) is unreachable.

### Recommended Improvements
- Decide whether query-sourced errors are real. If yes, add `"query"` to both `ERROR_SOURCE`
  (`systemErrors.ts`) and `ErrorSource` (`errorRecording.ts`). If no, drop `"query"` from
  the schema union. Either way, **single-source the union** — export one
  `errorSourceValidator` from `systemErrors.ts`, consume it in `schema.ts`, and derive the
  helper's TS type via `Infer<typeof errorSourceValidator>`. Three hand-maintained copies is
  the root cause.

---

## Type: `Suspension` reader (`suspension.ts`) vs the `userProfiles` triplet

`suspension.ts:16-44`, `schema.ts:247-249`, writers at `abuseDetection.ts:81-85` &
`adminSecurity.ts:200-202,224-226`

### Invariants Identified (as documented in `suspension.ts`)
- "Suspended" should be a single coherent state, derived from the triplet
  `(suspendedAt, suspendedReason, suspendedUntil)`.
- `suspendedAt` set ⇒ suspended; `suspendedUntil < now` ⇒ auto-lifted (treated as not
  suspended); `suspendedReason`/`suspendedUntil` may be null/undefined independently.

### The asymmetry
`suspension.ts` is explicitly framed as "single typed view over the triplet" and the file
comment even anticipates a future migration to a nested object. It provides `getUserSuspension`
(collapse triplet → `Suspension | null`) and `isUserSuspended`. Reads are clean and go
through this helper (`abuseDetection.ts:132` `checkEmailSuspension`, `adminSecurity.ts:178`).

But there is **no symmetric writer.** Every write sets the three raw optionals by hand:
- `abuseDetection.ts:81-85` — `patch({ suspendedAt, suspendedReason, suspendedUntil })`
- `adminSecurity.ts:224-226` — admin suspend, same three fields
- `adminSecurity.ts:200-202` — unsuspend via `{ suspendedAt: undefined, suspendedReason:
  undefined, suspendedUntil: undefined }`

Because the schema models three *independent* optionals, illegal triplets remain
representable and are not prevented by anything: e.g. `suspendedReason` set with
`suspendedAt` undefined (a "reason for a non-suspension"), or `suspendedUntil` set alone.
The reader happens to key entirely off `suspendedAt`, so these orphan states are silently
ignored — which means a partial write (or a future careless writer) produces a state the
type system permits, the reader hides, and no test would catch.

### Ratings
- **Encapsulation**: 5/10 — read side is well-encapsulated; write side is wide open. The
  abstraction leaks on exactly half its surface.
- **Invariant Expression**: 6/10 — the `Suspension` interface (`at: number`,
  `reason: string | null`, `until: number | null`) is a *better* model than the schema (it
  expresses "at is mandatory once suspended; reason/until are optional"), but that better
  model exists only at read time. The schema's three bare optionals don't express it.
- **Invariant Usefulness**: 8/10 — the collapse-to-one-nullable-union is genuinely valuable
  and the right shape; callers no longer branch on three fields.
- **Invariant Enforcement**: 4/10 — the central invariant ("`at` is the discriminant; the
  others are dependent") is enforced nowhere on writes. Three call sites independently
  reconstruct the write shape.

### Recommended Improvements
- Add the missing symmetric writers next to the reader, e.g. `suspensionPatch(opts): {...}`
  returning the three-field patch object, and `clearSuspensionPatch()` returning the
  all-undefined patch. Route the three write sites through them. This makes the triplet a
  closed read+write abstraction *without* a schema migration — the exact "swap the impl
  without touching consumers" property the file comment promises, extended to writes.
- Longer term, the cleanest fix is the migration the file already anticipates: a single
  `suspension: v.optional(v.object({ at, reason, until }))`. That makes the illegal triplets
  *unrepresentable* at the schema level (you can't have a reason without an `at`), which is
  strictly stronger than any helper. Worth it only if a migration is otherwise on the table.

---

## Type: `userProfiles` new fields (`postSignupEmailsSent`, suspension triplet) + boolean-soup

`schema.ts:230, 247-249, 89-130, 183-188`

### Notes
- `postSignupEmailsSent: v.optional(v.boolean())` is a one-shot flag. `optional(boolean)` →
  `boolean | undefined`, i.e. three states (`true`/`false`/absent) for a two-state concept.
  Fine for backwards-compat, and the read sites treat `undefined`/`false` identically, so no
  real footgun — just the standard "optional boolean = tri-state" caveat. Acceptable.
- **Boolean-soup observation (pre-existing, not new this PR but worth flagging):**
  `userProfiles` carries ~20 independent `v.boolean()` notification/calendar toggles
  (`emailDeadlineReminder*` ×6, `calendarSync*` ×8, etc.). Several of these are
  master-toggle + sub-toggle pairs (`emailDeadlineReminders` master vs the six
  per-type optionals) where the legal states are constrained (a sub-toggle only matters when
  the master is on) but the type permits every combination. This is the classic boolean-soup
  anti-pattern; a discriminated/derived shape would make impossible combos unrepresentable.
  Not introduced by this diff, so out of scope for a fix, but it's the dominant type-design
  debt in this table.

### Ratings (new fields only)
- **Encapsulation**: 7/10 · **Expression**: 7/10 · **Usefulness**: 8/10 · **Enforcement**: 7/10
- All four are reasonable; the suspension triplet's enforcement weakness is captured above
  under `suspension.ts`.

---

## Type: `abuseBlocklist` (table)

`schema.ts:816-825`

### Invariants Identified
- One logical block per `ip` (via `by_ip`); `expiresAt` is the auto-lift discriminant
  (`now > expiresAt` ⇒ inactive); `manualOverride` distinguishes admin-set from auto.

### Ratings
- **Encapsulation**: 8/10 · **Expression**: 8/10 · **Usefulness**: 8/10 · **Enforcement**: 7/10

### Notes
- Clean, well-commented table. `strikes`, `reason`, `manualOverride` are all required
  (non-optional) booleans/numbers/strings — good, no tri-state ambiguity. The "active iff
  `expiresAt > now`" rule is a derived predicate (not a stored boolean), which is the right
  call — avoids a stale `isActive` field. No writer was in scope to cross-check, but the
  shape itself makes few illegal states representable. Minor: `ip` uniqueness is index-based,
  not enforced, so duplicate rows per IP are possible (acceptable for a blocklist where any
  non-expired hit blocks).

---

## Type: `conversations.summary` new fields (`facts`, `summarizingAt`)

`schema.ts:635-644`

### Notes
- `facts: v.optional(v.string())` is a JSON-string-in-a-string (structured entities encoded
  as a string). This is a stringly-typed escape hatch — the actual shape (cases, people,
  dates, preferences, openActions) is invisible to the type system and must be parsed/validated
  at every read. Documented intent ("merged losslessly across compactions") is a real
  invariant with zero type support. Pragmatically fine if the schema is genuinely dynamic,
  but it's the weakest-typed field in the diff. If the entity shape is stable, a nested
  `v.object` (or even `v.record`) would make it self-describing.
- `summarizingAt: v.optional(v.number())` as a race lock with "stale entries >60s treated as
  unlocked" — the lock-vs-stale distinction is a runtime convention, not expressible in the
  type. Acceptable for an advisory lock; the comment carries the invariant.

### Ratings
- **Encapsulation**: 7/10 · **Expression**: 5/10 (the `facts` stringly-typing) ·
  **Usefulness**: 8/10 · **Enforcement**: 5/10

---

## Type: Resend contact shapes (`marketingEmail.ts`)

`marketingEmail.ts:48-53, 59-74, 109-164`

### Notes
- `ResendContact` interface (`id/email/first_name/unsubscribed`) is a clean hand-typed view
  of the external API. Good.
- **Untyped JSON boundary:** `resendFetch` returns `Response`; every consumer does
  `await res.json()` into an implicit `any` and then reads `data.data`, `data.unsubscribed`,
  `page[...]` with no validation (`marketingEmail.ts:67, 130, 211`). `listAllResendContacts`
  assigns `const page: ResendContact[] = data.data || []` — an *assertion*, not a check; a
  shape change in Resend's API would pass the type checker and fail at runtime. This is the
  standard "trust the external API" trade-off and is contained to this module, but it's the
  one place `any` flows in unchecked. A small `zod`/manual parse at the `res.json()` boundary
  would close it. Severity: low (admin-run sync/backfill, not user-facing).
- `getMarketingSubscriptionStatus` returns `boolean | null` — a clean tri-state
  (subscribed / unsubscribed / unknown) with each null branch documented. Good use of `null`
  as a distinct "unknown" rather than collapsing into `false`.
- Array-index access under `noUncheckedIndexedAccess`: `page[page.length - 1]!.id`
  (`marketingEmail.ts:71`) and `fullName.trim().split(/\s+/)[0] || ""` (`:84`). The `!` is
  guarded by the preceding `page.length < 100` break logic (page is non-empty when reached);
  the `|| ""` correctly handles the `undefined` from indexing. Both safe.

### Ratings
- **Encapsulation**: 7/10 · **Expression**: 7/10 · **Usefulness**: 7/10 · **Enforcement**: 5/10
  (untyped JSON ingress)

---

## Type: `notifications` (no new types; rate-limit add only)

`notifications.ts` — diff adds a `rateLimiter.limit(...)` call to `markAllAsRead` and the
import. No type/shape change. Existing types reviewed in passing: `notificationType` union is
single-sourced as a `const` and reused for both the table mirror and the `getNotifications`
filter (good), and mutation result shapes (`{ count, hasMore }`, `{ success: true }`,
`{ count }`) are ad-hoc per-mutation literals rather than a shared outcome type — see
cross-cutting note below.

---

## Type: `lib/perm/constants.ts`

Diff is a one-line comment deletion only. No type change. Constants are
`export const X = <number>` (literal-typed, e.g. `30`, `180`) which is already maximally
narrow — TS infers the literal type, so each constant is its own singleton type. No issues.

---

## Type: `UpdateEmail.tsx` (`UpdateEmailProps`)

`UpdateEmail.tsx:14-24` — `{ firstName?: string; unsubscribeUrl?: string }` with safe
defaults (`"there"`, the Resend placeholder). Clean, well-documented presentational prop
interface. Not a data-model type; no concerns.

---

## Cross-Cutting Observations

1. **Literal-union duplication is the recurring theme.** `marketingEvents.eventType` (×3
   copies), `systemErrors.source` (×3, and one disagrees), and the `caseStatus` /
   `progressStatus` unions (duplicated between `cases` and `userCaseOrder.filters`,
   `schema.ts:277-291` vs `749-763`) are all hand-maintained in multiple files. None are
   single-sourced via an exported validator. This is the highest-leverage systemic fix:
   export each closed-set validator once and consume it everywhere (schema, mutation args,
   and derive TS types via `Infer`). It directly caused the `systemErrors` drift bug.

2. **Ad-hoc per-mutation result shapes.** `notifications.ts` returns five different inline
   shapes (`{ success: true }`, `{ count, hasMore }`, `{ count }`, raw id). Minor, but a
   shared `BatchResult = { count: number; hasMore: boolean }` and a `MutationOk` type would
   make the API surface consistent and self-documenting. Not a correctness issue.

3. **`any` casts are rare and contained.** Only `errorRecording.ts:23`
   (`internal as any`, with a documented reason — `FilterApi` can't resolve the internal
   reference) and the implicit `any` from untyped `res.json()` in `marketingEmail.ts`. Both
   justified/contained. No gratuitous casts found in the new code.

4. **`v.optional` vs nullable is used correctly throughout.** New optionals are genuine
   backwards-compat fields, and the read sites consistently treat `undefined` as the absent
   case. `getMarketingSubscriptionStatus` and `suspension.ts` deliberately use `null` (not
   `undefined`) for "unknown"/"not suspended" at the *return* boundary while the *storage*
   stays `optional` — that's the right split.

---

## Severity-Ranked Findings

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | **Medium** | `systemErrors.source` schema allows `"query"` but mutation validator + `ErrorSource` TS type omit it → `"query"` is an unreachable/unenforceable state; validator/schema drift | `systemErrors.ts:13-18`, `errorRecording.ts:33` vs `schema.ts:942-948` |
| 2 | **Medium** | `suspension.ts` is a typed reader with no symmetric writer → illegal triplets (reason/until without `at`) remain representable; 3 write sites set raw optionals by hand | `suspension.ts:29-39`, `abuseDetection.ts:81-85`, `adminSecurity.ts:200-202,224-226` |
| 3 | **Low** | `marketingEvents.eventType` literal union duplicated across 3 files with no single source | `schema.ts:975-980`, `marketingWebhook.ts:27-32`, `http.ts:62-66` |
| 4 | **Low** | `occurredAt` can be stored as `NaN` from malformed `created_at` (passes `v.number()`) | `http.ts:85-87` |
| 5 | **Low** | Untyped Resend JSON ingress (`res.json()` → implicit `any`, asserted not validated) | `marketingEmail.ts:67, 130, 211` |
| 6 | **Low** | `conversations.summary.facts` is JSON-in-a-string; rich invariant, zero type support | `schema.ts:638` |
| 7 | **Info** | Boolean-soup in `userProfiles` (master/sub toggle pairs permit illegal combos) — pre-existing, not this diff | `schema.ts:89-130, 183-188` |
| 8 | **Info** | Ad-hoc per-mutation result shapes; no shared outcome type | `notifications.ts` |

## Qualitative Ratings (new/changed types, weighted)

| Axis | Score | One-line rationale |
|---|---|---|
| Encapsulation | 7/10 | Read paths well-guarded; suspension writes + Resend JSON ingress are open |
| Invariant Expression | 6.5/10 | Strong literal unions, but triplicated and one self-contradictory; stringly-typed `facts` |
| Invariant Usefulness | 8/10 | The chosen invariants (literal event types, suspension collapse, append-only audit) are the right ones |
| Invariant Enforcement | 6/10 | Boundary type-guard on webhook is exemplary; suspension writes + source-union drift undercut it |

**Overall: solid (7/10).** The `marketingEvents`/webhook design is genuinely good (boundary
type-guard + matching validators + shared idempotent mutation). The two medium findings are
both single-sourcing problems — fixing #1 and #2 plus #3 by exporting shared validators would
lift Expression/Enforcement to ~8 with no schema migration required.
