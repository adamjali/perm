/**
 * Contact Page
 *
 * Contact information for PERM Tracker support.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import { Mail, MessageSquare, Github } from "lucide-react";
import Link from "next/link";

// Force static generation for instant loading
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact PERM Tracker support for help with your immigration case management. Email, feature requests, and bug reports.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact PERM Tracker",
    description:
      "Get in touch with PERM Tracker support for help with your immigration case management.",
    url: "/contact",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="font-heading text-4xl font-black mb-4">Contact Us</h1>
        <p className="text-foreground/60 mb-8">
          Have questions about PERM Tracker? We&apos;re here to help.
        </p>

        <div className="space-y-8">
          {/* Email */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-black bg-primary shadow-hard-sm dark:border-white">
              <Mail className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">Email</h2>
              <p className="text-foreground/60 text-sm mb-2">
                Best for general inquiries and support requests.
              </p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-black bg-secondary shadow-hard-sm dark:border-white">
              <MessageSquare className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Feature Requests & Feedback
              </h2>
              <p className="text-foreground/60 text-sm mb-2">
                Have an idea to improve PERM Tracker? We&apos;d love to hear it.
              </p>
              <a
                href="https://github.com/adamjali/perm/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="hover-underline text-primary font-medium"
              >
                Submit on GitHub
              </a>
            </div>
          </div>

          {/* Bug Reports */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-black bg-accent shadow-hard-sm dark:border-white">
              <Github className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Bug Reports
              </h2>
              <p className="text-foreground/60 text-sm mb-2">
                Found something that&apos;s not working right? Report it here.
              </p>
              <a
                href="https://github.com/adamjali/perm/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="hover-underline text-primary font-medium"
              >
                Report a Bug
              </a>
            </div>
          </div>
        </div>

        {/* Response time */}
        <div className="mt-12 rounded-lg border-2 border-black bg-muted p-6 shadow-hard-sm dark:border-white">
          <h3 className="font-heading text-lg font-bold mb-2">Response Time</h3>
          <p className="text-foreground/60">
            We typically respond to inquiries within 24-48 hours during business
            days. For urgent matters related to case deadlines, please include
            &quot;URGENT&quot; in your email subject.
          </p>
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
