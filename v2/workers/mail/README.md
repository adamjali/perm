# The mail Worker (Cloudflare Email Routing)

`permtracker-mail` on Cloudflare, live since Oct 12 2026. Two jobs, both free and
outside Resend's 100 emails a day:

| job | how |
|---|---|
| **Inbound**: every message to an `@permtracker.app` address | the zone's catch-all rule hands it to the Worker's `email` handler, which forwards it to the owner's verified Gmail and posts it to Convex `POST /inbound-email` (stored in `supportEmails`, `resendEmailId` = `cloudflare:<Message-ID>`) |
| **Owner mail**: alerts, admin notices, the morning report | `POST https://permtracker-mail.permtracker.workers.dev/owner` with `x-owner-mail-key`; the `OWNER` send binding can only send to the owner's verified address |

Callers: `convex/lib/ownerMail.ts` (`OWNER_MAIL_URL`, `OWNER_MAIL_KEY` on Convex),
`permtracker-alarm` and `permtracker-defend` on the server
(`/etc/permtracker/owner-mail.env`, root 600). Each falls back to Resend when the
Worker isn't set up or doesn't answer.

## Files

- `worker.mjs`: the two handlers. `rules.mjs`: forwarding rule (held to
  `convex/lib/supportEmailForward.ts` by `src/lib/__tests__/mailWorkerRules.test.ts`),
  key checks. `mime.mjs`: a small MIME reader for the stored copy.
- `node workers/mail/build.mjs` (from `v2/`) writes `dist/worker.js`, about 6 KB.

## Bindings

`OWNER` (send_email, `destination_address` = the owner), `OWNER_EMAIL`, `FROM_EMAIL`
(`alerts@permtracker.app`), `CONVEX_SITE`, and `KEYS`, the KV namespace
`permtracker-mail-keys` holding `owner_mail_key` and `inbound_key`.

## Keys

The two keys live only in `~/.config/permtracker-mail/` on the owner's Mac (mode
600), Convex env (`OWNER_MAIL_KEY`, `INBOUND_EMAIL_SECRET`), the server's
`owner-mail.env`, and the Worker's KV. They never pass through the Cloudflare API
in plain text: `POST /provision` sets both once, from a machine that reads them
from its own files, and answers with each key's SHA-256 tag (first 8 hex) to
compare. It refuses once keys are set.

To rotate: generate new files, delete the two KV entries (Cloudflare API, KV
namespace `permtracker-mail-keys`), provision again, then pipe the new values to
Convex (`npx convex env set NAME --prod < file`) and the server file.

## Upload

The script goes up through the Cloudflare API as a multipart PUT to
`/accounts/<account>/workers/scripts/permtracker-mail` with the bindings above;
compare the uploaded code's SHA-256 with the local `dist/worker.js`.

## DNS

Root MX: Cloudflare's `route1/2/3.mx.cloudflare.net` (Resend's Amazon SES inbound
MX was removed Oct 12 2026). Root SPF: `v=spf1 include:_spf.mx.cloudflare.net
include:amazonses.com -all`. DKIM: `cf2024-1._domainkey`. `send.permtracker.app`
(Resend's sending) and `press.permtracker.app` (Zoho) are unchanged.
