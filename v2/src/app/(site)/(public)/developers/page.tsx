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

import { API_PLANS } from "@convex/lib/apiPlans";
import { API_BASE, ENDPOINTS, MCP_TOOLS, MCP_URL } from "@/lib/api/openapi";
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
  ["401", "missing_key, invalid_key, revoked_key", "No key, or one we don't recognise."],
  ["404", "not_found", "No such record. Counted, because the lookup ran."],
  ["429", "rate_limited, daily_limit, monthly_limit", "A limit. Retry-After says how many seconds until it lifts."],
  ["503", "unavailable, busy", "A source isn't loaded, or the site is busy. Try again shortly."],
];

export default function DevelopersPage() {
  const free = API_PLANS.free;
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
            <p className="mt-3 text-base leading-relaxed text-foreground/75">{s.body}</p>
            <Code>{s.code}</Code>
          </li>
        ))}
      </ol>

      <section className="mt-12" aria-labelledby="limits">
        <h2 id="limits" className="font-heading text-2xl font-black">
          Free plan
        </h2>{" "}
        <dl className="mt-4 grid grid-cols-2 gap-px border-3 border-border bg-border sm:grid-cols-4">
          {(
            [
              ["A minute", fmt(free.perMinute)],
              ["A day", fmt(free.perDay)],
              ["A month", fmt(free.perMonth)],
              ["Keys", fmt(free.keys)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="bg-card px-4 py-4">
              <dt className="text-sm font-semibold text-foreground/70">{label}</dt>{" "}
              <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>{" "}
        <p className="mt-3 text-base text-foreground/75">
          Calls, counted per account and reset at midnight UTC. Need more?{" "}
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
          All GET, all under <code className="font-mono">{API_BASE}</code>. The{" "}
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
                <tr key={e.path} className="align-top">
                  <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">{e.path}{" "}</td>
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
