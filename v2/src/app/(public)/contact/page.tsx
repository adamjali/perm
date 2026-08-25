/**
 * Contact Page
 *
 * Contact information for PERM Tracker support.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import Link from "next/link";
import { openGraphBase } from "@/lib/openGraphBase";
import { ContactForm } from "./ContactForm";
import {
  GITHUB_BUG_REPORT_URL,
  GITHUB_FEATURE_REQUEST_URL,
} from "@/lib/constants/externalLinks";

// Brand icon as inline SVG: lucide-react v1.x removed brand icons
const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

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
    ...openGraphBase,
    title: "Contact PERM Tracker",
    description:
      "Get in touch with PERM Tracker support for help with your immigration case management.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="font-heading text-4xl font-black mb-4">Contact Us</h1>{" "}
        <p className="text-foreground/60 mb-8">
          Have questions about PERM Tracker? We&apos;re here to help.
        </p>{" "}

        {/* The form is the primary path; the addresses below stay for anyone
            who would rather use their own mail client. */}
        <ContactForm />

        <h2 className="mt-12 font-heading text-2xl font-black">Other ways in</h2>
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
              <MessageSquare className="h-6 w-6 text-secondary-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Feature Requests & Feedback
              </h2>{" "}
              <p className="text-foreground/60 text-sm mb-2">
                Have an idea to improve PERM Tracker? We&apos;d love to hear it.
              </p>{" "}
              <a
                href={GITHUB_FEATURE_REQUEST_URL}
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
            <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-accent shadow-hard-sm dark:border-white">
              <GithubIcon className="h-6 w-6 text-accent-foreground" />
            </div>{" "}
            <div>
              <h2 className="font-heading text-lg font-bold mb-1">
                Bug Reports
              </h2>{" "}
              <p className="text-foreground/60 text-sm mb-2">
                Found something that&apos;s not working right? Report it here.
              </p>{" "}
              <a
                href={GITHUB_BUG_REPORT_URL}
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
        <div className="mt-12 border-2 border-black bg-muted p-6 shadow-hard-sm dark:border-white">
          <h3 className="font-heading text-lg font-bold mb-2">Response Time</h3>{" "}
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
