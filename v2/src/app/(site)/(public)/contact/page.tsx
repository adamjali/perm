/**
 * Contact Page
 *
 * Contact information for PERM Tracker support.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { BugIcon, ChatTextIcon, EnvelopeIcon as Mail } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { openGraphBase } from "@/lib/openGraphBase";
import { ContactForm } from "./ContactForm";
import { RoutingFigure } from "@/components/marketing/PageFigures";
import {
  BUG_REPORT_URL,
  FEATURE_REQUEST_URL,
} from "@/lib/constants/externalLinks";

// Force static generation for instant loading
export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "Contact",
  description:
    "Contact PERM Tracker support for help with your immigration case management. Email, feature requests, and bug reports.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    ...openGraphBase,
    title: "Contact PERM Tracker",
    description:
      "Get in touch with PERM Tracker support for help with your immigration case management.",
    url: "/contact",
  },
}, "contact");

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="font-heading text-4xl font-black mb-4">Contact Us</h1>{" "}
        <p className="text-foreground/60 mb-8">
          Questions, feature requests and bug reports all land in the same inbox.
        </p>{" "}

        {/* THE FORM MOVED TO THE BOTTOM, on Adam's call. It was the first
            thing on the page, which asks a reader to start typing before the
            page has told them where their question actually goes. Several of
            the routes below answer faster than a form does - a bug report
            belongs on the issue tracker, and a case question is usually
            answered by the case lookup - so they read first and the form
            catches whatever they do not cover. */}
        {/* The figure before the routes, because its point is the thing the
            headings below cannot say at a glance: these are three doors into
            one inbox, not three different teams. */}
        <figure className="mt-8 border-2 border-border bg-background p-6 shadow-hard-sm">
          <RoutingFigure className="h-auto w-full text-foreground" />{" "}
          <figcaption className="mt-4 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Three ways in, one inbox
          </figcaption>
        </figure>

        <h2 className="mt-10 font-heading text-2xl font-black">Where to send it</h2>
        <div className="mt-6 space-y-8">
          {/* Email */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-primary shadow-hard-sm dark:border-white">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">Email</h2>{" "}
              <p className="text-foreground/60 text-sm mb-2">
                Best for general inquiries and support requests.
              </p>{" "}
              <a
                href="mailto:support@permtracker.app"
                className="hover-underline text-primary font-medium"
              >
                support@permtracker.app
              </a>
            </div>
          </div>

          {/* Feature Requests */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-secondary shadow-hard-sm dark:border-white">
              <ChatTextIcon className="h-6 w-6 text-secondary-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Feature Requests & Feedback
              </h2>{" "}
              <p className="text-foreground/60 text-sm mb-2">
                Have an idea for PERM Tracker? Email it. Every idea is read by
                the person who runs the site.
              </p>{" "}
              <a
                href={FEATURE_REQUEST_URL}
                className="hover-underline text-primary font-medium"
              >
                Email an idea
              </a>
            </div>
          </div>

          {/* Bug Reports */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-primary shadow-hard-sm dark:border-white">
              <BugIcon className="h-6 w-6 text-accent-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Bug Reports
              </h2>{" "}
              <p className="text-foreground/60 text-sm mb-2">
                Found something that&apos;s not working right? Report it here.
              </p>{" "}
              <a
                href={BUG_REPORT_URL}
                className="hover-underline text-primary font-medium"
              >
                Report a Bug
              </a>
            </div>
          </div>
        </div>

        {/* Response time */}
        <div className="mt-12 border-2 border-black bg-muted p-6 shadow-hard-sm dark:border-white">
          <h3 className="font-heading text-lg font-bold mb-2">Response Time</h3>{" "}
          <p className="text-foreground/60">
            We typically respond to inquiries within 24-48 hours during business
            days. For urgent matters related to case deadlines, please include
            &quot;URGENT&quot; in your email subject.
          </p>
        </div>

        {/* The form, last: everything above says where a question goes, and
            this is the catch-all for the ones that do not have a better
            route. */}
        <h2 className="mt-12 font-heading text-2xl font-black">
          Or write to us here
        </h2>{" "}
        <p className="mt-2 text-foreground/60">
          Goes to the same inbox as the address above. No account needed.
        </p>{" "}
        <div className="mt-6">
          <ContactForm />
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="hover-underline text-foreground/60 text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
