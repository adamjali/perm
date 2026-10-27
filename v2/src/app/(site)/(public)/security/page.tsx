/**
 * Security Page, public security disclosures + incident history
 *
 * Purpose: give anyone (customers, auditors, recipients of unauthorized emails
 * from our domain, journalists, etc.) a single discoverable URL they can land on
 * to verify claims about our platform's security posture and past incidents.
 *
 * Laid out like /privacy and /terms: a card surface, Space Grotesk
 * headings, structured sections.
 *
 * This page is expected to grow over time as new security facts emerge.
 * Keep incident entries concise, factual, neutral, this is a legal record.
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { openGraphBase } from "@/lib/openGraphBase";
import Link from "next/link";
import { Fragment } from "react";
import {
  CloudIcon,
  EnvelopeSimpleIcon,
  KeyIcon,
  LockKeyIcon,
  PlusIcon,
  ShieldIcon,
} from "@phosphor-icons/react/ssr";
import { buttonVariants } from "@/components/ui/button";
import { ToneBadge } from "@/components/ui/badge";
import { CodeWindow } from "@/components/marketing/CodeWindow";

export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "Security",
  description:
    "Security posture, incident history, and vulnerability disclosure for PERM Tracker: encryption, access control, and how to report an issue.",
  alternates: {
    canonical: "/security",
  },
  openGraph: {
    ...openGraphBase,
    title: "Security | PERM Tracker",
    description:
      "Security posture and public incident record for permtracker.app.",
    url: "/security",
  },
}, "security");


/** How the site is run, in the words the page has carried since Sep 30 2026. */
const POSTURE = [
  {
    Icon: CloudIcon,
    title: "Audited hosts",
    body: "Convex (accounts and case data), Oracle Cloud (the website's server) and Cloudflare (the network in front of it), each with a SOC 2 Type II report.",
  },
  { Icon: LockKeyIcon, title: "Encrypted", body: "User data is encrypted at rest and in transit." },
  {
    Icon: KeyIcon,
    title: "Sign-in",
    body: "Emailed one-time codes or Google. Passwords are salted and hashed with industry-standard algorithms.",
  },
  {
    Icon: EnvelopeSimpleIcon,
    title: "Signed mail",
    body: "Every message we send is authenticated with DKIM, SPF and DMARC, so a forgery can be told apart.",
  },
] as const;

/**
 * The security headers the live site sent, asked from outside and kept as printed (one HEAD request to the home
 * page; the rest of the reply left out), with the day it was asked. Ask again and replace both when nginx's
 * headers change (scripts/oracle/nginx).
 */
const HEADERS_ASKED = "October 22, 2026";
const HEADERS = "HTTP/2 200 \ncontent-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://browser.sentry-cdn.com https://challenges.cloudflare.com https://analytics.ahrefs.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://*.sentry.io https://browser.sentry-cdn.com https://fonts.googleapis.com https://fonts.gstatic.com https://us.i.posthog.com https://us-assets.i.posthog.com https://challenges.cloudflare.com https://analytics.ahrefs.com; media-src 'self' blob: data:; frame-src 'self' https://app.supademo.com https://*.convex.cloud https://challenges.cloudflare.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'\ncross-origin-opener-policy: same-origin-allow-popups\npermissions-policy: camera=(), microphone=(self), geolocation=()\nreferrer-policy: strict-origin-when-cross-origin\nstrict-transport-security: max-age=63072000; includeSubDomains; preload\nx-content-type-options: nosniff\nx-frame-options: DENY";

/** The April 2026 incident's figures, each from its own account below. */
const INCIDENT_FACTS = [
  { value: "139", label: "Addresses that got a message" },
  { value: "2 h 35 min", label: "From the first request to the stop" },
  { value: "None", label: "Customer data accessed" },
] as const;

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <header className="max-w-2xl">
        <div className="flex items-center gap-3">
          <ShieldIcon className="h-9 w-9 text-primary-text" weight="bold" aria-hidden="true" />
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Security</h1>
        </div>{" "}
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          How permtracker.app is run, how to report a problem, and every security incident on the record.
        </p>
      </header>{" "}

      {/* The page's picture: what the site really sends, as text anyone can check with one request. */}
      <section aria-labelledby="headers" className="mt-10">
        <h2 id="headers" className="font-heading text-2xl font-bold">
          What every page is sent with
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-soft">
          HTTPS only, for two years, on every subdomain. No other site may show a page in a frame. No camera or
          location. And a content policy that lists where scripts, styles and connections may come from.
        </p>{" "}
        <CodeWindow
          className="mt-6"
          command="curl -sI https://permtracker.app"
          output={HEADERS}
          label="The security headers permtracker.app sends: a content security policy, strict transport security for two years with subdomains, no framing, no content sniffing, a referrer policy and a permissions policy with camera and location off."
          caption={`Asked ${HEADERS_ASKED}; the security headers from the reply.`}
        />{" "}
        {/* An outside grade, dated: Qualys's own test of the site's HTTPS. */}
        <p className="mt-4 max-w-2xl text-base text-soft">
          Qualys SSL Labs graded the site&apos;s HTTPS{" "}
          <a
            href="https://www.ssllabs.com/ssltest/analyze.html?d=permtracker.app"
            target="_blank"
            rel="noopener noreferrer"
            className="link font-semibold"
          >
            A+
          </a>{" "}
          on all four of its addresses on October 27, 2026.
        </p>
      </section>{" "}

      {/* THE POSTURE AS FOUR FACTS, each one a sentence the page already made.
          It had been one paragraph behind a "More" link. */}
      <section aria-labelledby="posture" className="mt-10">
        <h2 id="posture" className="font-heading text-2xl font-bold">
          How it&apos;s run
        </h2>{" "}
        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          {POSTURE.map(({ Icon, title, body }) => (
            <Fragment key={title}>
              {" "}
              <li className="flex gap-4 border-border p-5 border-2 shadow-hard-sm bg-card">
                <Icon size={24} className="shrink-0 text-primary-text" aria-hidden="true" />{" "}
                <span className="min-w-0">
                  <span className="block font-heading text-lg font-bold">{title}</span>{" "}
                  <span className="mt-1 block text-sm leading-relaxed text-soft">{body}</span>
                </span>
              </li>
            </Fragment>
          ))}
        </ul>
      </section>{" "}

      <section aria-labelledby="report" className="dark mt-12 border-2 shadow-hard border-black bg-[#141414] text-foreground p-6 sm:p-8">
        <h2 id="report" className="font-heading text-2xl font-bold">
          Report a vulnerability
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-soft">
          Email the issue, the steps to reproduce it and any proof of concept. We acknowledge every report within 72
          hours and agree on disclosure timing with you. There&apos;s no paid bug bounty yet; reporters who want to be
          named are credited in the record below.
        </p>{" "}
        <a
          href="mailto:security@permtracker.app"
          className={buttonVariants({ variant: "default", size: "lg", className: "mt-5" })}
        >
          <EnvelopeSimpleIcon size={18} weight="bold" aria-hidden="true" />
          security@permtracker.app
        </a>
      </section>{" "}

      <section aria-labelledby="incidents" className="mt-12">
        <h2 id="incidents" className="font-heading text-2xl font-bold">
          Incident record
        </h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Every security-relevant incident, kept permanently. One so far.
        </p>{" "}

        <article id="2026-04-19-signup-abuse" className="mt-6 border-border bg-card border">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-border p-5 sm:p-6">
            <div className="min-w-0">
              <h3 className="font-heading text-xl font-bold">
                The sign-up form was used to send unsolicited email
              </h3>{" "}
              <p className="mt-1 font-mono text-sm text-muted-foreground">April 19 to 20, 2026</p>
            </div>{" "}
            <ToneBadge tone="good" className="shrink-0">Resolved</ToneBadge>
          </div>{" "}
          <dl className="grid grid-cols-1 border-b-2 border-border sm:grid-cols-3 [&>*]:min-w-0">
            {INCIDENT_FACTS.map(({ value, label }, i) => (
              <Fragment key={label}>
                {" "}
                <div className={`p-5 ${i > 0 ? "border-t-2 border-border sm:border-l-2 sm:border-t-0" : ""}`}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>{" "}
                  <dd className="mt-1 font-heading text-2xl font-bold">{value}</dd>
                </div>
              </Fragment>
            ))}
          </dl>{" "}
          <div className="p-5 sm:p-6">
            <p className="text-base leading-relaxed text-soft">
              An automated script sent sign-up requests with marketing text in the name field, so that text reached the
              addresses it supplied inside our welcome email. Three safeguards went in the same day.
            </p>{" "}
            <details className="group mt-4 bg-tint">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 font-heading text-base font-bold [&::-webkit-details-marker]:hidden">
                The full account{" "}
                <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
              </summary>
              <div className="space-y-4 border-t-2 border-border p-4 text-base leading-relaxed text-soft">
                <p>
                  <strong>What happened.</strong> Between approximately{" "}
                  <span className="font-mono text-sm">2026-04-19 22:38 UTC</span> and{" "}
                  <span className="font-mono text-sm">2026-04-20 01:13 UTC</span>, an unauthorized third party submitted a
                  high volume of automated requests to the PERM Tracker public signup endpoint. The attacker placed
                  unsolicited Turkish-language marketing content inside the submitted &quot;name&quot; field, causing
                  that content to appear in standard transactional emails generated for the attacker-supplied recipient
                  addresses.
                </p>{" "}
                <p>
                  <strong>What was affected.</strong> Approximately 139 attacker-chosen third-party email addresses
                  received one or more messages. Upstream rate limits imposed by our email provider significantly
                  constrained the volume that was actually transmitted. No customer data was accessed, viewed, exported,
                  or modified. No existing PERM Tracker user accounts were affected.
                </p>{" "}
                <p>
                  <strong>Immediate action.</strong> The activity was identified and stopped on{" "}
                  <span className="font-mono text-sm">2026-04-20 01:13 UTC</span>. Additional safeguards were deployed
                  the same day:
                </p>{" "}
                <ul className="ml-5 list-disc space-y-2">
                  <li>
                    Server-side input validation on the affected endpoint, rejecting requests containing external URLs,
                    non-alphabetic abuse patterns, or excessive length.
                  </li>{" "}
                  <li>
                    Transactional messages (welcome email and administrative notifications) are now generated only after
                    email-verification is completed, preventing automated requests from triggering outbound email.
                  </li>{" "}
                  <li>
                    Cloudflare Turnstile anti-automation challenge added to the signup endpoint with server-side token
                    verification.
                  </li>
                </ul>{" "}
                <p>
                  <strong>If you received an unexpected email.</strong> If you received a message referencing
                  permtracker.app that you didn’t expect, particularly one containing a link or promotional content in
                  Turkish, <strong>please don’t click any links</strong> in that message. The content wasn’t authorized
                  by PERM Tracker, wasn’t directed to you by us, and doesn’t reflect our product or services. You may
                  safely delete the email. You won’t receive further messages from us unless you choose to sign up for
                  an account directly at{" "}
                  <Link href="/" className="link">
                    permtracker.app
                  </Link>
                  .
                </p>{" "}
                <p>
                  <strong>Coordinating with downstream providers.</strong> The phishing URL used in the attack has been
                  reported to Google Safe Browsing, PhishTank, Netcraft, APWG, Bitly Trust &amp; Safety, and
                  Turkey&apos;s national CERT. Our email service provider has been notified proactively.
                </p>
              </div>
            </details>
          </div>
        </article>
      </section>{" "}

      <p className="mt-10 border-t-2 border-border pt-6 text-sm leading-relaxed text-muted-foreground">
        The incident record was last amended on April 20, 2026, and is amended whenever a security-relevant event occurs.
        Questions about this page go to{" "}
        <a
          href="mailto:security@permtracker.app"
          className="link"
        >
          security@permtracker.app
        </a>
        .
      </p>
    </div>
  );
}
