# Spam filter on our mail and the contact form (Oct 25 2026)

The owner's yes, Sun Oct 25 2026 ("yes do all what you said 1-4"). Mechanics: `v2/CLAUDE.md`, "Oct 25 2026 (afternoon)".

## What shipped

| part | where | live |
|---|---|---|
| the rules | `convex/lib/spamCheck.ts` | with Convex, 3:19 PM EDT |
| verdict route, held list, Not spam, Delete, Spam, 30-day clean-up, morning-report line | `convex/inboundFilter.ts`, `convex/http.ts`, `convex/retention.ts`, `convex/dailyReport.ts` | with Convex, 3:19 PM EDT |
| the mail Worker asks before it forwards, Workers AI second opinion, `/classify` | `workers/mail/` | uploaded about 3:10 PM EDT (bundle SHA-256 00d30a18...) |
| contact form: server Turnstile check and the same hold | `convex/http.ts`, `convex/contactForm.ts`, `convex/lib/turnstileVerify.ts` | with Convex, 3:19 PM EDT |
| contact form widget, admin "Spam filter" panel, Privacy Policy | `src/` | the night deploy after Oct 25 |

## Proof

- Calibration on the 152 stored messages (support@ and the other addresses; Medium's notices and DMARC reports left
  out), through the deployed Worker's `/classify`: 39 held, no real person's message among them; 23 by the rules
  alone, 17 more where the AI agreed with a one-pitch score. Oracle Cloud's account activation would have been held
  by the rules; the account-domain list lets it through.
- The live verdict route, 3:19 PM EDT: a link-selling pitch held at score 6, a person's question forwarded at 0, a
  wrong key refused 401.
- Tests: 27 rules, 11 database, 5 Turnstile, 7 Worker email handler, 2 Worker helpers, 1 morning report; each probed
  by breaking the rule it holds. `pnpm check` and GitHub's full suite green on b6fa83e4.

## Found on the way

- `@cf/meta/llama-3.1-8b-instruct` was retired May 30 2026; the binding answered error 5028 while the REST API still
  answered. Every AI opinion was empty until calibration counted them. Now `@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
  about 7 neurons a message.

## Still to watch

- The first real mail through the filter (a check is scheduled for 7:07 PM EDT Oct 25).
- Spam the rules miss: 18 stored cold pitches the AI called spam got through, by design (the AI can't hold alone).
  If they pile up, add their shapes to `PITCHES`.
