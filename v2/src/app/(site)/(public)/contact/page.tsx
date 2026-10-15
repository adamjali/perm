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
    // Full width, two columns: where each kind of question goes on the left,
    // the form on the right, staying in view. Below `lg` it stacks in source
    // order, routes first and the catch-all form last.
    <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-8 sm:py-16">
      <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Contact us</h1>{" "}
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
        Questions, feature requests and bug reports all land in the same inbox.
      </p>{" "}
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <div className="min-w-0">

        {/* The routes come before the form: several answer faster than a
            message does (a case question is usually answered by the case
            lookup), and the form catches the rest. */}
        {/* The figure before the routes, because its point is the thing the
            headings below cannot say at a glance: these are three doors into
            one inbox, not three different teams. */}
        <figure className="bg-tint p-6 border-2 shadow-hard-sm border-border">
          <RoutingFigure className="h-auto w-full text-foreground" />{" "}
          <figcaption className="mt-4 border-t-2 border-border pt-3 text-sm font-bold text-muted-foreground">
            Three ways in, one inbox
          </figcaption>
        </figure>

        <h2 className="mt-10 font-heading text-2xl font-bold">Where to send it</h2>
        <div className="mt-6 space-y-8">
          {/* Email */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center text-primary-text border-black bg-primary">
              <Mail className="h-6 w-6" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">Email</h2>{" "}
              <p className="text-muted-foreground text-sm mb-2">
                Best for general inquiries and support requests.
              </p>{" "}
              <a
                href="mailto:support@permtracker.app"
                className="link"
              >
                support@permtracker.app
              </a>
            </div>
          </div>

          {/* Feature Requests */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center border-black bg-secondary border">
              <ChatTextIcon className="h-6 w-6 text-secondary-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Feature requests and feedback
              </h2>{" "}
              <p className="text-muted-foreground text-sm mb-2">
                Have an idea for PERM Tracker? Email it. Every idea is read by
                the person who runs the site.
              </p>{" "}
              <a
                href={FEATURE_REQUEST_URL}
                className="link"
              >
                Email an idea
              </a>
            </div>
          </div>

          {/* Bug Reports */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center text-primary-text border-black bg-primary">
              <BugIcon className="h-6 w-6 text-accent-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Bug reports
              </h2>{" "}
              <p className="text-muted-foreground text-sm mb-2">
                Found something that&apos;s not working right? Report it here.
              </p>{" "}
              <a
                href={BUG_REPORT_URL}
                className="link"
              >
                Report a Bug
              </a>
            </div>
          </div>
        </div>

        {/* Response time */}
        <div className="mt-12 bg-tint p-6 border-2 border-black shadow-hard-sm">
          <h3 className="font-heading text-lg font-bold mb-2">Response time</h3>{" "}
          <p className="text-muted-foreground">
            We typically respond to inquiries within 24-48 hours during business
            days. For urgent matters related to case deadlines, please include
            &quot;URGENT&quot; in your email subject.
          </p>
        </div>

      </div>

      {/* The form, in its own column: everything on the left says where a
          question goes, and this is the catch-all for the ones that do not
          have a better route. Sticky on desktop so it is in reach from any of
          the routes; a normal block below `lg`. */}
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="bg-tint p-6 sm:p-8">
          <h2 className="font-heading text-2xl font-bold">
            Or write to us here
          </h2>{" "}
          <p className="mt-2 text-muted-foreground">
            Goes to the same inbox as the address above. No account needed.
          </p>{" "}
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </div>
      </div>

      {/* Back link */}
      <div className="mt-10 text-center">
        <Link
          href="/"
          className="underline-offset-4 hover:underline text-muted-foreground text-sm"
        >
          &larr; Back to Home
        </Link>
      </div>
    </div>
  );
}
