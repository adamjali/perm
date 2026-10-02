/**
 * The terms for the API (permtracker.app/v1) and the MCP server
 * (permtracker.app/mcp). They sit on top of the Terms of Service and carve
 * out what §4 of those forbids: scripted access, within the limits here.
 *
 * Legal register on purpose: no contractions, defined terms capitalised.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { API_PLANS } from "@convex/lib/apiPlans";
import { LEGAL_FORM, LEGAL_NAME } from "@/lib/constants/about";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

const DESCRIPTION =
  "The terms for the PERM Tracker API and MCP server: keys, limits, attribution, what you may build and what you may not do with the data.";

export const metadata: Metadata = withSocialCard(
  {
    title: "API Terms",
    description: DESCRIPTION,
    alternates: { canonical: "/api-terms" },
    openGraph: { ...openGraphBase, title: "API Terms | PERM Tracker", description: DESCRIPTION, url: "/api-terms" },
  },
  "api-terms",
);

export const dynamic = "force-static";

const link = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-b-2 border-border py-6 last:border-b-0">
      <h2 id={id} className="font-heading text-2xl font-bold">
        {title}
      </h2>{" "}
      <div className="mt-3 space-y-3 leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

export default function ApiTermsPage() {
  const free = API_PLANS.free;
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="mb-2 font-heading text-4xl font-black">API Terms</h1>{" "}
        <p className="mb-6 text-foreground/60">Effective Date: October 2, 2026</p>

        <Section id="agreement" title="1. Agreement">
          <p>
            These API Terms govern your use of the PERM Tracker application programming interface at
            permtracker.app/v1 and the Model Context Protocol server at permtracker.app/mcp (together, the
            &ldquo;API&rdquo;), provided by {LEGAL_NAME}, {LEGAL_FORM} (&ldquo;we&rdquo; or &ldquo;us&rdquo;). They
            supplement the{" "}
            <Link href="/terms" className={link}>
              Terms of Service
            </Link>
            , which also apply. Where the two conflict, these API Terms govern your use of the API. By making an API
            key or calling the API, you agree to them.
          </p>
        </Section>

        <Section id="keys" title="2. API keys">
          <p>
            An API key identifies your account. You are responsible for every call made with your keys. You must keep
            them confidential, send them only in a request header, and never publish them in public code, web pages or
            URLs. You may not share a key with another person or organization. If a key may have been exposed, revoke
            it in Settings and make a new one. We may revoke a key that has been published or misused.
          </p>
        </Section>

        <Section id="limits" title="3. Limits">
          <p>
            Each plan has limits on calls a minute, a day and a month, published on the{" "}
            <Link href="/developers" className={link}>
              developers page
            </Link>
            . The Free plan currently allows {free.perMinute} calls a minute, {free.perDay.toLocaleString("en-US")} a
            day and {free.perMonth.toLocaleString("en-US")} a month. You may not use more than one account, rotate keys
            or use any other means to exceed the limits of your plan. Calls to the MCP server without a key share a
            common allowance and may be refused when it is in use.
          </p>
        </Section>

        <Section id="permitted-use" title="4. What you may do">
          <p>
            You may use the API to build applications, websites, research, internal tools and AI assistant
            integrations, and to show what it returns to your users, commercially or otherwise, subject to these
            terms.
          </p>{" "}
          <p>
            Where you show results from the API, you must credit &ldquo;PERM Tracker (permtracker.app)&rdquo; in a
            way your users can see, with a link to permtracker.app where the medium allows one.
          </p>
        </Section>

        <Section id="restrictions" title="5. What you may not do">
          <ul className="ml-4 list-inside list-disc space-y-2">
            <li>
              Use the API to copy, compile or redistribute all or a substantial part of PERM Tracker&rsquo;s
              compilation as a dataset, or to build a substitute for it. The files on{" "}
              <Link href="/open-data" className={link}>
                Open data
              </Link>{" "}
              remain available under their own licence.
            </li>{" "}
            <li>Resell, sublicense or rent access to the API, or offer it as a service under another name.</li>{" "}
            <li>
              Use results to send unsolicited communications to employers, law firms or any person named in the
              records, or to identify, profile or contact the individuals behind a case.
            </li>{" "}
            <li>
              Present an estimate from the API as a determination, prediction or statement of any government agency,
              or as legal advice.
            </li>{" "}
            <li>Interfere with the API or the site, or probe, scan or test their security without our written consent.</li>
          </ul>
        </Section>

        <Section id="the-data" title="6. The data">
          <p>
            The underlying records come from the U.S. Department of Labor and the U.S. Department of State. As works
            of the United States Government they are not subject to copyright (17 U.S.C. §105), and nothing in these
            terms restricts them. Our selection, arrangement and presentation of them, and the estimates we compute,
            are covered by section 6 of the Terms of Service.
          </p>{" "}
          <p>
            Estimates are estimates. They describe how comparable cases have moved and are not a promise about any
            case. Nothing the API returns is legal advice.
          </p>
        </Section>

        <Section id="availability" title="7. Availability and changes">
          <p>
            The API is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without any warranty and without
            any promise of uptime, accuracy or completeness. We may change, limit, suspend or discontinue any part of
            it. We will announce changes that break existing use on the developers page and, where practical, before
            they take effect. Changes that break existing use will be made in a new version of the API where
            practical.
          </p>
        </Section>

        <Section id="fees" title="8. Fees">
          <p>
            The Free plan is free. If we offer paid plans, their prices and terms will be shown before purchase and
            will govern them.
          </p>
        </Section>

        <Section id="suspension" title="9. Suspension and termination">
          <p>
            We may suspend or revoke your keys, or end your access to the API, if you breach these terms or the Terms
            of Service, or where needed to protect the API, the site, its users or the sources of its data. You may stop
            using the API at any time by revoking your keys. Sections 5, 6 and 10 survive termination.
          </p>
        </Section>

        <Section id="liability" title="10. Liability and indemnification">
          <p>
            Sections 7 (Disclaimers), 8 (Limitation of Liability) and 10 (Indemnification) of the Terms of Service
            apply to the API and to anything you build with it.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to these terms">
          <p>
            We may update these terms. The effective date above changes when we do. Using the API after an update
            means you accept the updated terms.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            Questions about these terms or the API:{" "}
            <a href="mailto:support@permtracker.app" className={link}>
              support@permtracker.app
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
