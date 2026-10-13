# The mail Worker (Cloudflare Email Routing)

`permtracker-mail` on Cloudflare, live since Oct 12 2026. Two jobs, both free and
outside Resend's 100 emails a day:

| job | how |
|---|---|
| **Inbound**: every message to an `@permtracker.app` address | the zone's catch-all rule hands it to the Worker's `email` handler, which forwards it to the owner's verified Gmail and posts it to Convex `POST /inbound-email` (stored in `supportEmails`, `resendEmailId` = `cloudflare:<Message-ID>`) |
| **Owner mail**: every email to one of the owner's inboxes (alerts, admin notices, the morning report, the contact form, the site's own mail to the owner's accounts) | `POST https://permtracker-mail.permtracker.workers.dev/owner` with `x-owner-mail-key` and JSON `{ subject, text, html?, to?, replyTo? }`; `to` must be `OWNER_EMAIL` or listed in `OWNER_ADDRESSES` (else 403), and the `OWNER` send binding can only send to Cloudflare-verified addresses |

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

`OWNER` (send_email, `destination_address` = the owner), `OWNER_EMAIL`, optional
`OWNER_ADDRESSES` (comma-separated, more of the owner's inboxes), `FROM_EMAIL`
(`alerts@permtracker.app`), `CONVEX_SITE`, and `KEYS`, the KV namespace
`permtracker-mail-keys` holding `owner_mail_key` and `inbound_key`.

## Keys

The two keys live only in `~/.config/permtracker-mail/` on the owner's Mac (mode
600), Convex env (`OWNER_MAIL_KEY`, `INBOUND_EMAIL_SECRET`), the server's
`owner-mail.env`, and the Worker's KV. They never pass through the Cloudflare API
in plain text: `POST /provision` sets both once, from a machine that reads them
from its own files, and answers with each key's SHA-256 tag (first 8 hex) to
compare. It refuses once keys are set, and it answers 404 at all times except
inside a rotation window: an upload carrying the plain-text binding
`PROVISION_UNTIL`, an instant at most an hour ahead (`provisionOpen` in
`rules.mjs`). Without that gate, anyone could set keys of their own while the
old ones were deleted.

To rotate: generate new files; upload with `PROVISION_UNTIL` 15 minutes ahead;
delete the two KV entries (Cloudflare API, KV namespace `permtracker-mail-keys`);
provision; upload again WITHOUT `PROVISION_UNTIL`; then pipe the new values to
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

## A second inbox for the owner

1. Cloudflare dashboard, Email Routing, Destination addresses: add it; Cloudflare emails it a link, and the
   owner clicks it.
2. Upload with the `OWNER` binding as `allowed_destination_addresses: [main, second]` (in place of
   `destination_address`) and a plain-text `OWNER_ADDRESSES` naming the second.
3. Add it to `OWNER_INBOXES` on Convex (comma-separated); `sendOrQueue` then sends its mail here.
   Note `npx convex env get` exits 0 even for a variable that isn't set: read its output.
