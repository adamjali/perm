/**
 * Accessibility statement.
 *
 * WHY THIS EXISTS (2026-09-22). USCIS grants API access only to organizations
 * that "offer Section 508 compliant" applications, and it reads the policies
 * before it grants anything. The site already builds to the craft floor this
 * page describes (16px body text, 4.5:1 contrast, 44px targets, keyboard paths,
 * reduced motion honoured); what it lacked was a page saying so and a place to
 * report a barrier. This is a statement of the standard and the process, not a
 * claim of a completed audit, and it says which is which.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_NAME } from "@/lib/constants/about";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

export const dynamic = "force-static";

const DESCRIPTION =
  "The standard PERM Tracker builds to (WCAG 2.2 AA, the basis of Section 508), what that means on this site, its known limits, and how to report a barrier.";

export const metadata: Metadata = withSocialCard({
  title: "Accessibility",
  description: DESCRIPTION,
  alternates: { canonical: "/accessibility" },
  openGraph: {
    ...openGraphBase,
    title: "Accessibility | PERM Tracker",
    description: DESCRIPTION,
    url: "/accessibility",
  },
  robots: { index: true, follow: true },
}, "accessibility");

const STATEMENT_DATE = "September 22, 2026";

const LINK =
  "font-bold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="font-heading text-4xl font-black">Accessibility</h1>{" "}
        <p className="mt-3 mb-8 text-foreground/60">
          Statement dated {STATEMENT_DATE}. Operated by {LEGAL_NAME}.
        </p>{" "}

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-bold mt-2 mb-4">The standard</h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker builds to the Web Content Accessibility Guidelines (WCAG) 2.2
              at level AA. Section 508 of the Rehabilitation Act incorporates WCAG 2.0 AA
              for web content, and 2.2 AA includes every one of those success criteria,
              so meeting the newer standard meets the older one. This page states the
              standard and how the site is built against it. It doesn&apos;t claim a
              completed third-party audit, because none has been commissioned.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">What that means here</h2>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Body text is at least 16px and text contrast is at least 4.5:1 (3:1 for large text), in light and dark mode.</li>{" "}
              <li>Every control can be reached and operated from a keyboard, with a visible focus state, and nothing depends on hovering.</li>{" "}
              <li>Standalone tap targets are at least 44px so they work on a phone.</li>{" "}
              <li>Pages carry one heading outline, landmarks, and labels on every form field; native controls are used where they exist.</li>{" "}
              <li>Motion is reduced when your system asks for it (prefers-reduced-motion), and nothing pulses or loops.</li>{" "}
              <li>Charts are inline SVG with text labels and titles, and every figure a chart draws is also printed as text or in a table on the same page.</li>{" "}
              <li>Wide tables scroll inside their own container rather than the whole page.</li>
            </ul>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">Known limits</h2>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Some government documents are shown as the printed first page of a PDF; the text of each is linked beside the image.</li>{" "}
              <li>Third-party widgets (the review carousel, the contact form&apos;s bot check) render their own markup, which this site can&apos;t change.</li>{" "}
              <li>Screenshots inside the guides describe the screen in their alt text, not every figure on it.</li>
            </ul>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">Report a barrier</h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If something on this site is hard or impossible for you to use, email{" "}
              <a href="mailto:support@permtracker.app?subject=Accessibility" className={LINK}>
                support@permtracker.app
              </a>{" "}
              with the page address and what happened. You&apos;ll get a reply within five
              business days, and fixes for a real barrier ship in the next release. The{" "}
              <Link href="/contact" className={LINK}>
                contact page
              </Link>{" "}
              works too.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
