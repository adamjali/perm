/**
 * Security Page, public security disclosures + incident history
 *
 * Purpose: give anyone (customers, auditors, recipients of unauthorized emails
 * from our domain, journalists, etc.) a single discoverable URL they can land on
 * to verify claims about our platform's security posture and past incidents.
 *
 * Design: matches existing neo-brutalist aesthetic of /privacy and /terms, 
 * card-brutalist container, space-grotesk headings, structured sections.
 *
 * This page is expected to grow over time as new security facts emerge.
 * Keep incident entries concise, factual, neutral, this is a legal record.
 */

import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import Link from "next/link";
import { Shield, CheckCircle2 } from "lucide-react";

export const dynamic = "force-static";

export const metadata: Metadata = {
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
  robots: {
    index: true,
    follow: true,
  },
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="font-heading text-4xl font-black">Security</h1>
        </div>{" "}
        <p className="text-foreground/60 mb-8">
          Security posture and public incident record for permtracker.app
        </p>{" "}

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">

          {/* Security posture overview */}
          <section>
            <h2 className="font-heading text-2xl font-bold mt-2 mb-4">
              Overview
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker takes security seriously. Infrastructure is operated on
              SOC&nbsp;2-compliant providers (Convex, Vercel). User data is encrypted at
              rest and in transit. Authentication uses email-verified one-time codes
              or Google OAuth; all passwords are salted and hashed using industry-standard
              algorithms. Outbound transactional mail is DKIM-, SPF-, and DMARC-authenticated.
            </p>
          </section>

          {/* Reporting vulnerabilities */}
          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              Reporting a Vulnerability
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If you believe you have discovered a security vulnerability in PERM
              Tracker, please report it privately by emailing{" "}
              <a
                href="mailto:security@permtracker.app"
                className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                security@permtracker.app
              </a>
              . Include a description of the issue, steps to reproduce, and any
              proof-of-concept details. We’ll acknowledge your report within 72
              hours and coordinate on disclosure timing. We don’t operate a paid
              bug-bounty program at this time, but we credit reporters who wish to
              be named in the incident record below.
            </p>
          </section>

          {/* Incident history */}
          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              Incident Record
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed mb-6">
              Below are public-facing summaries of security-relevant incidents.
              Entries are factual and preserved for transparency.
            </p>

            {/* Incident: April 19-20, 2026 signup abuse */}
            <article
              id="2026-04-19-signup-abuse"
              className="border-2 border-border bg-muted/30 p-6 mt-6 shadow-hard"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-heading text-xl font-bold">
                    Unauthorized use of signup form to transmit unsolicited email
                  </h3>{" "}
                  <p className="text-sm text-foreground/60 mono mt-1">
                    April 19-20, 2026 &nbsp;·&nbsp; Status: resolved
                  </p>
                </div>{" "}
                <div className="shrink-0 flex items-center gap-2 rounded-full border-2 border-green-600 bg-green-50 dark:bg-green-950/30 px-3 py-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                  <span className="text-xs mono font-bold uppercase tracking-wider text-green-800 dark:text-green-400">
                    Resolved
                  </span>
                </div>
              </div>{" "}

              <div className="space-y-4 text-foreground/80 leading-relaxed">
                <p>
                  <strong>What happened.</strong> Between approximately{" "}
                  <span className="mono text-sm">2026-04-19 22:38 UTC</span> and{" "}
                  <span className="mono text-sm">2026-04-20 01:13 UTC</span>, an
                  unauthorized third party submitted a high volume of automated
                  requests to the PERM Tracker public signup endpoint. The attacker
                  placed unsolicited Turkish-language marketing content inside the
                  submitted &quot;name&quot; field, causing that content to appear
                  in standard transactional emails generated for the attacker-
                  supplied recipient addresses.
                </p>{" "}
                <p>
                  <strong>What was affected.</strong> Approximately 139
                  attacker-chosen third-party email addresses received one or more
                  messages. Upstream rate limits imposed by our email provider
                  significantly constrained the volume that was actually
                  transmitted. No customer data was accessed, viewed, exported,
                  or modified. No existing PERM Tracker user accounts were affected.
                </p>{" "}
                <p>
                  <strong>Immediate action.</strong> The activity was identified
                  and stopped on <span className="mono text-sm">2026-04-20 01:13 UTC</span>.
                  Additional safeguards were deployed the same day:
                </p>{" "}
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    Server-side input validation on the affected endpoint, rejecting
                    requests containing external URLs, non-alphabetic abuse patterns,
                    or excessive length.
                  </li>{" "}
                  <li>
                    Transactional messages (welcome email and administrative
                    notifications) are now generated only after email-verification
                    is completed, preventing automated requests from triggering
                    outbound email.
                  </li>{" "}
                  <li>
                    Cloudflare Turnstile anti-automation challenge added to the
                    signup endpoint with server-side token verification.
                  </li>
                </ul>{" "}
                <p>
                  <strong>If you received an unexpected email.</strong> If you
                  received a message referencing permtracker.app that you didn’t expect, particularly one containing a link or promotional content in Turkish, <strong>please don’t click any links</strong>{" "}
                  in that message. The content wasn’t authorized by PERM Tracker,
                  wasn’t directed to you by us, and doesn’t reflect our product
                  or services. You may safely delete the email. You won’t
                  receive further messages from us unless you choose to sign up
                  for an account directly at{" "}
                  <Link href="/" className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                    permtracker.app
                  </Link>
                  .
                </p>{" "}
                <p>
                  <strong>Coordinating with downstream providers.</strong> The
                  phishing URL used in the attack has been reported to Google Safe
                  Browsing, PhishTank, Netcraft, APWG, Bitly Trust &amp; Safety, and
                  Turkey&apos;s national CERT. Our email service provider has been
                  notified proactively.
                </p>
              </div>
            </article>
          </section>

          {/* Footer */}
          <section className="mt-10 pt-8 border-t-2 border-border">
            <p className="text-sm text-foreground/60 leading-relaxed">
              Last updated: April 20, 2026. This page will be amended when new
              security-relevant events occur. For questions about this page, contact{" "}
              <a
                href="mailto:security@permtracker.app"
                className="font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                security@permtracker.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
