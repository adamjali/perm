/**
 * The API and the MCP server, for people building on the data.
 *
 * The endpoint list, the tool list, the address and the plan's limits are
 * read from the modules the API itself runs on (src/lib/api/openapi.ts and
 * convex/lib/apiPlans.ts), so this page can't describe an endpoint or a
 * limit that isn't there.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { API_LIVE_DAILY_CAP, API_PLANS, GRANTABLE_SCOPES, SCOPE_LABELS } from "@convex/lib/apiPlans";
import { RETRY_DELAYS_MS, WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS } from "@convex/lib/webhookSign";
import { API_BASE, ENDPOINTS, MCP_TOOLS, MCP_URL } from "@/lib/api/openapi";
import { SANDBOX_CASE_NUMBERS } from "@/lib/api/sandbox";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

const TITLE = "PERM Tracker API and MCP Server";
const DESCRIPTION =
  "PERM, prevailing wage, H-1B and visa bulletin records as JSON, and the same reads as tools for Claude, Cursor and other AI assistants. Free keys.";

export const metadata: Metadata = withSocialCard(
  {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/developers" },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/developers" },
  },
  "developers",
);

export const dynamic = "force-static";

const fmt = (n: number) => n.toLocaleString("en-US");
const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 whitespace-pre-wrap [overflow-wrap:anywhere] border-2 border-border bg-muted px-4 py-3 font-mono text-sm leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

const ERRORS: Array<[string, string, string]> = [
  ["400", "bad_request", "The request isn't valid: the message says which part. Not counted."],
  ["401", "missing_key, invalid_key, revoked_key, expired_key", "No key, or one we don't recognise, revoked, past its lifetime or past a rotation's 24 hours."],
  ["403", "missing_scope, plan_feature, sandbox_key", "The key lacks the scope, the plan lacks the feature, or a sandbox key asked to change something. Not counted."],
  ["404", "not_found", "No such record. Counted, because the lookup ran."],
  ["429", "rate_limited, daily_limit, monthly_limit, live_daily_limit, live_api_limit", "A limit. Retry-After says how many seconds until it lifts."],
  ["503", "unavailable, dol_unavailable, busy", "A source isn't loaded, DOL didn't answer a live lookup in time, or the site is busy. Try again shortly."],
];

/** "1 minute", "5 minutes", "2 hours": a retry wait, said plainly. */
function wait(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return minutes === 1 ? "1 minute" : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

const WEBHOOK_EXAMPLE = `POST https://example.com/hooks/perm
webhook-id: msg_jd7abc123
webhook-timestamp: 1791561600
webhook-signature: v1,K5oZ...base64...=

{
  "type": "case.status_changed",
  "timestamp": "2026-10-09T16:05:00.000Z",
  "data": {
    "caseNumber": "G-100-26045-123456",
    "program": "perm",
    "from": "ANALYST REVIEW",
    "to": "CERTIFIED",
    "isFinal": true,
    "observedOn": "2026-10-09",
    "url": "https://permtracker.app/perm-case-status?case=G-100-26045-123456"
  }
}`;

const VERIFY_EXAMPLE = `import { createHmac, timingSafeEqual } from "node:crypto";

// secret: the whsec_... value shown when you made the endpoint
export function verify(secret, headers, rawBody) {
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signed = \`\${headers["webhook-id"]}.\${headers["webhook-timestamp"]}.\${rawBody}\`;
  const want = createHmac("sha256", key).update(signed).digest("base64");
  const age = Math.abs(Date.now() / 1000 - Number(headers["webhook-timestamp"]));
  return age < 300 && headers["webhook-signature"].split(" ").some((s) => {
    const got = s.split(",")[1] ?? "";
    return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  });
}`;

export default function DevelopersPage() {
  const free = API_PLANS.free;
  const plus = API_PLANS.plus;
  const steps: Array<{ title: string; body: React.ReactNode; code: string }> = [
    {
      title: "Make a key",
      body: (
        <>
          Sign in, then{" "}
          <Link href="/settings?tab=api-keys" className={link}>
            Settings, API keys
          </Link>
          . Free, no card. It&rsquo;s shown once.
        </>
      ),
      code: "pt_live_…",
    },
    {
      title: "Call the API",
      body: "Send the key in a header, from your server: browsers on other sites can't call it, which keeps keys out of web pages. Every answer names its source, its date and the page it came from.",
      code: `curl -H "Authorization: Bearer YOUR_KEY" \\\n${API_BASE}/queue`,
    },
    {
      title: "Or connect an assistant",
      body: "Add this address as a connector. It works without a key; a key gives an assistant your own limits.",
      code: MCP_URL,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <header className="pt-10 sm:pt-12">
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">API and AI assistants</h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/75">
          The federal records behind this site, as JSON for your code and as tools for Claude, Cursor and other assistants.
        </p>
      </header>

      <ol className="mt-10 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="border-3 border-border bg-card p-5 shadow-hard">
            <p className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center border-2 border-border bg-primary font-mono text-base font-black text-foreground">
                {i + 1}
              </span>{" "}
              <span className="font-heading text-xl font-black">{s.title}</span>
            </p>{" "}
            <p className="mt-3 text-base leading-relaxed text-foreground/75">{s.body}</p>{" "}
            <Code>{s.code}</Code>{" "}
          </li>
        ))}
      </ol>

      <section className="mt-12" aria-labelledby="limits">
        <h2 id="limits" className="font-heading text-2xl font-black">
          Plans
        </h2>{" "}
        <p className="mt-2 max-w-2xl border-2 border-border bg-primary/15 px-4 py-3 text-base">
          Paid features are free for now: every account gets the Plus plan&rsquo;s limits, exports, live DOL lookups and
          webhooks until billing opens. We&rsquo;ll say so here, and email key holders, before that changes.
        </p>{" "}
        <div className="mt-4 overflow-x-auto border-3 border-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Allowance{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Free{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Plus{" "}</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border">
              {(
                [
                  ["Calls a minute", free.perMinute, plus.perMinute],
                  ["Calls a day", free.perDay, plus.perDay],
                  ["Calls a month", free.perMonth, plus.perMonth],
                  ["Live keys", free.keys, plus.keys],
                  ["Sandbox keys", free.sandboxKeys, plus.sandboxKeys],
                  ["Rows in one export", free.exportRows, plus.exportRows],
                  ["Live DOL lookups a day", free.liveLookupsPerDay, plus.liveLookupsPerDay],
                  ["Webhook endpoints", free.webhookEndpoints, plus.webhookEndpoints],
                  ["Watched cases and employers", free.webhookWatches, plus.webhookWatches],
                ] as const
              ).map(([label, f, p]) => (
                <tr key={label}>
                  <th scope="row" className="px-4 py-3 font-semibold">{label}{" "}</th>
                  <td className="px-4 py-3 font-mono tabular-nums">{f === 0 ? "None" : fmt(f)}{" "}</td>
                  <td className="px-4 py-3 font-mono tabular-nums">{fmt(p)}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>{" "}
        <p className="mt-3 text-base text-foreground/75">
          Calls are counted per account and reset at midnight UTC. Need more?{" "}
          <a href="mailto:support@permtracker.app?subject=API%20limits" className={link}>
            Write to us
          </a>
          .
        </p>
      </section>

      <section className="mt-12" aria-labelledby="endpoints">
        <h2 id="endpoints" className="font-heading text-2xl font-black">
          Endpoints
        </h2>{" "}
        <p className="mt-2 text-base text-foreground/75">
          All under <code className="font-mono">{API_BASE}</code>; GET unless marked. The{" "}
          <a href={`${API_BASE}/openapi.json`} className={link}>
            OpenAPI description
          </a>{" "}
          has the same list for tools that read it.
        </p>{" "}
        <div className="mt-4 overflow-x-auto border-3 border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">Endpoint{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">What it answers{" "}</th>
                <th scope="col" className="px-4 py-3 font-bold">Example{" "}</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-border">
              {ENDPOINTS.map((e) => (
                <tr key={`${e.method ?? "GET"} ${e.path}`} className="align-top">
                  <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                    {e.method && e.method !== "GET" ? `${e.method} ` : ""}
                    {e.path}{" "}
                  </td>
                  <td className="px-4 py-3 leading-relaxed">
                    {e.summary}{" "}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground/75">{e.example}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>{" "}
        <details className="mt-4 border-2 border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-bold">The shape of every answer</summary>
          <Code>{`{
  "data": { ... },
  "meta": {
    "source": "Who published the records",
    "asOf": "YYYY-MM-DD, the date the data is true for",
    "url": "The page on permtracker.app showing the same thing"
  }
}`}</Code>
          <p className="mt-3 text-sm leading-relaxed text-foreground/75">
            Headers carry the limits: RateLimit-Remaining for the minute, X-Calls-Today and X-Calls-Month as used out of
            allowed.
          </p>
        </details>{" "}
        <details className="mt-3 border-2 border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-bold">Errors</summary>
          <p className="mt-3 text-sm leading-relaxed text-foreground/75">
            Every error is JSON with a code and a sentence saying what happened and what to do.
          </p>{" "}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <tbody className="divide-y-2 divide-border">
                {ERRORS.map(([status, codes, meaning]) => (
                  <tr key={status} className="align-top">
                    <td className="py-2 pr-4 font-mono font-bold">{status}{" "}</td>
                    <td className="py-2 pr-4 font-mono">{codes}{" "}</td>
                    <td className="py-2">{meaning}{" "}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="mt-12" aria-labelledby="keys">
        <h2 id="keys" className="font-heading text-2xl font-black">
          Scopes, lifetimes and rotation
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          Each key says what it may do. Give a script only what it needs; a call outside its scopes answers 403 and
          isn&rsquo;t counted. Writing to your cases is reserved for the firm tools and can&rsquo;t be granted yet.
        </p>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
          {GRANTABLE_SCOPES.map((sc) => (
            <li key={sc} className="border-2 border-border bg-card px-4 py-3">
              <p className="font-mono text-sm font-bold">{sc}</p>{" "}
              <p className="mt-1 text-sm text-foreground/75">{SCOPE_LABELS[sc]}</p>
            </li>
          ))}
        </ul>{" "}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/75">
          A key can last 30 days, 90, a year or until you revoke it. Rotating one gives you a new key at once and keeps
          the old one working for 24 hours, so you can switch over. A revoked key stops within a minute, usually at once.
          GET <code className="font-mono">/v1/me</code> shows the key&rsquo;s scopes, its end and what&rsquo;s left today.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="sandbox">
        <h2 id="sandbox" className="font-heading text-2xl font-black">
          Sandbox keys
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          A key that starts <code className="font-mono">pt_test_</code> answers every read and export from fixed sample
          data in the same shape as the real thing, and nothing it does is counted. Use one for tests and CI. Its
          sample cases are{" "}
          {SANDBOX_CASE_NUMBERS.map((n, i) => (
            <span key={n}>
              {i > 0 ? ", " : ""}
              <code className="font-mono">{n}</code>
            </span>
          ))}
          : numbers DOL&rsquo;s numbering never issues, so none is a real person&rsquo;s case.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="live">
        <h2 id="live" className="font-heading text-2xl font-black">
          Exports and live DOL lookups
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          <code className="font-mono">/v1/exports/cases</code> takes the case search&rsquo;s own parameters and returns
          the whole answer, up to {fmt(plus.exportRows)} rows on Plus, as JSON or CSV (cells a spreadsheet would run as
          a formula are written as text). When more matched, X-Export-Truncated says so. An export counts as one call.
        </p>{" "}
        <Code>{`curl -H "Authorization: Bearer YOUR_KEY" \
"${API_BASE}/exports/cases?q=acme&state=CA&format=csv"`}</Code>{" "}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/75">
          Add <code className="font-mono">live=1</code> to a case lookup and a number our records don&rsquo;t hold yet
          is asked of DOL right now, then kept, so the nightly sweep follows it. A case we hold answers from our record
          and costs nothing. Plus has {fmt(plus.liveLookupsPerDay)} a day, and every account together{" "}
          {fmt(API_LIVE_DAILY_CAP)}, so DOL never sees a spike from us. A refusal names the limit and when it
          resets.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="webhooks">
        <h2 id="webhooks" className="font-heading text-2xl font-black">
          Webhooks
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          Register an https endpoint in Settings or with POST <code className="font-mono">/v1/webhooks</code>, choose
          its events, and watch case numbers or employers with POST <code className="font-mono">/v1/watches</code>. Each
          delivery is a signed POST, the Standard Webhooks way, so any of its libraries can check it.
        </p>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
          {WEBHOOK_EVENTS.map((ev) => (
            <li key={ev} className="border-2 border-border bg-card px-4 py-3">
              <p className="font-mono text-sm font-bold">{ev}</p>{" "}
              <p className="mt-1 text-sm text-foreground/75">{WEBHOOK_EVENT_LABELS[ev]}</p>
            </li>
          ))}
        </ul>{" "}
        <details className="mt-4 border-2 border-border bg-card px-4 py-3">
          <summary className="cursor-pointer font-bold">A delivery, and how to check its signature</summary>
          <Code>{WEBHOOK_EXAMPLE}</Code>{" "}
          <p className="mt-3 text-sm leading-relaxed text-foreground/75">
            The signature is HMAC-SHA256, keyed by your secret without its whsec_ prefix (base64-decoded), over the id,
            the timestamp and the raw body joined by dots. Refuse a timestamp more than five minutes off, and use the
            id to skip a delivery you&rsquo;ve already handled: it&rsquo;s the same on every retry.
          </p>{" "}
          <Code>{VERIFY_EXAMPLE}</Code>
        </details>{" "}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/75">
          Answer with any 2xx within 10 seconds. Anything else, a redirect included, is retried after{" "}
          {RETRY_DELAYS_MS.slice(0, 6).map(wait).join(", ")} and at the 24-hour mark. After 24 hours the endpoint
          pauses, we email you once, and events wait for you to resume it. The delivery log in Settings keeps 30 days,
          with a button to send any one again.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="assistants">
        <h2 id="assistants" className="font-heading text-2xl font-black">
          AI assistants
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-foreground/75">
          Six read-only tools over the Model Context Protocol. Each calls the same code as its endpoint, so an assistant
          and the API can&rsquo;t disagree.
        </p>{" "}
        <ul className="mt-4 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2 lg:grid-cols-3">
          {MCP_TOOLS.map((t) => (
            <li key={t.name} className="border-2 border-border bg-card px-4 py-3">
              <p className="font-mono text-sm font-bold">{t.name}</p>{" "}
              <p className="mt-1 text-sm leading-relaxed text-foreground/75">{t.summary}</p>
            </li>
          ))}
        </ul>{" "}
        <div className="mt-6 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-3">
          <div>
            <h3 className="font-heading text-lg font-black">Claude</h3>{" "}
            <p className="mt-1 text-sm leading-relaxed text-foreground/75">
              Add a custom connector with this address. No key needed.
            </p>
            <Code>{MCP_URL}</Code>
          </div>{" "}
          <div>
            <h3 className="font-heading text-lg font-black">Claude Code</h3>{" "}
            <p className="mt-1 text-sm leading-relaxed text-foreground/75">The header is optional.</p>
            <Code>{`claude mcp add --transport http permtracker \\\n${MCP_URL} \\\n--header "Authorization: Bearer YOUR_KEY"`}</Code>
          </div>{" "}
          <div>
            <h3 className="font-heading text-lg font-black">Cursor</h3>{" "}
            <p className="mt-1 text-sm leading-relaxed text-foreground/75">In mcp.json.</p>
            <Code>{`{
  "mcpServers": {
    "permtracker": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer YOUR_KEY"
      }
    }
  }
}`}</Code>
          </div>
        </div>
      </section>

      <section className="mt-12 border-3 border-border bg-card p-5 shadow-hard sm:p-6">
        <h2 className="font-heading text-2xl font-black">The rules</h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/75">
          Use it under the{" "}
          <Link href="/api-terms" className={link}>
            API terms
          </Link>
          . Credit &ldquo;PERM Tracker (permtracker.app)&rdquo; where you show what it returns, keep your key out of
          public code, and don&rsquo;t use it to copy the whole compilation. The records come from DOL and the State
          Department; estimates are ours and say so.
        </p>
      </section>
    </div>
  );
}
