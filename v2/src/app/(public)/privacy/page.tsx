/**
 * Privacy Policy Page
 *
 * Privacy policy for PERM Tracker.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import Link from "next/link";

// Force static generation for instant loading
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for PERM Tracker. Learn how we protect your immigration case data with bank-level encryption and row-level security.",
  alternates: {
    canonical: "/privacy",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="card-brutalist p-8">
        <h1 className="font-heading text-4xl font-black mb-2">Privacy Policy</h1>
        <p className="text-foreground/60 mb-8">
          Effective Date: November 24, 2025 | Last Updated: November 24, 2025
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              1. Introduction
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              Welcome to PERM Tracker (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our web application for tracking Permanent
              Labor Certification (PERM) cases.
            </p>
            <p className="text-foreground/80 leading-relaxed mt-4">
              By using PERM Tracker, you agree to the collection and use of
              information in accordance with this policy. If you do not agree with
              this policy, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              2. Information We Collect
            </h2>

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Account Information
            </h3>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>
                <strong>Email address</strong> - Used for account creation and
                notifications
              </li>
              <li>
                <strong>Name</strong> - Obtained via Google OAuth for
                personalization
              </li>
              <li>
                <strong>Password</strong> - Securely hashed, never stored in plain
                text
              </li>
            </ul>

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">Case Data</h3>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Employer names and position titles</li>
              <li>Case status and progress information</li>
              <li>Important dates (PWD filing, recruitment dates, etc.)</li>
              <li>Notes and case-related documentation references</li>
            </ul>

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              User Preferences
            </h3>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>UI settings (dark mode, sorting preferences)</li>
              <li>Notification preferences</li>
              <li>Dismissed deadline alerts</li>
            </ul>

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Technical Information
            </h3>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>IP address and browser type</li>
              <li>Device information</li>
              <li>Usage patterns and interaction data</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>Provide and maintain the PERM tracking service</li>
              <li>Authenticate your account and ensure security</li>
              <li>Send email notifications about upcoming deadlines</li>
              <li>Improve user experience and application features</li>
              <li>Respond to customer support requests</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              4. Google OAuth Disclosure
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker uses Google OAuth for authentication. When you sign in
              with Google:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                We access only your <strong>email address</strong> and{" "}
                <strong>display name</strong>
              </li>
              <li>
                This information is used{" "}
                <strong>solely for authentication</strong> and account
                identification
              </li>
              <li>
                We do <strong>not</strong> access your Google contacts, calendar,
                or any other Google services
              </li>
              <li>
                We do <strong>not</strong> share your Google account data with any
                third parties
              </li>
              <li>
                We do <strong>not</strong> store your Google password
              </li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Our use of Google user data complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              5. Data Storage & Security
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              Your data is stored securely using industry-standard practices:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Database:</strong> PostgreSQL hosted on Supabase with
                Row-Level Security (RLS)
              </li>
              <li>
                <strong>Encryption:</strong> All data transmitted via HTTPS/TLS
                encryption
              </li>
              <li>
                <strong>Access Control:</strong> Each user can only access their
                own data
              </li>
              <li>
                <strong>Authentication:</strong> JWT tokens with secure expiration
              </li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              While we implement robust security measures, no method of
              transmission over the Internet is 100% secure. We cannot guarantee
              absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              6. Cookies & Local Storage
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              We use the following storage technologies:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Session Cookies:</strong> Essential for authentication and
                maintaining your login session
              </li>
              <li>
                <strong>LocalStorage:</strong> Stores preferences such as dark
                mode settings, authentication tokens, and UI preferences
              </li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              These are <strong>strictly necessary</strong> for the application to
              function and do not track you across other websites.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              7. Third-Party Services
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              We use the following third-party services to operate PERM Tracker:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Convex:</strong> Database hosting and real-time sync
              </li>
              <li>
                <strong>Vercel:</strong> Frontend hosting and deployment
              </li>
              <li>
                <strong>Resend:</strong> Email notification delivery
              </li>
              <li>
                <strong>Google:</strong> OAuth authentication provider
              </li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Each of these services has their own privacy policies. We recommend
              reviewing their policies for additional information.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              8. Data Retention & Deletion
            </h2>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Your data is retained for as long as your account is active</li>
              <li>
                You may request deletion of your account and all associated data
                at any time
              </li>
              <li>
                Upon deletion request, we will remove your data within 30 days
              </li>
              <li>Some data may be retained longer if required by law</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              To request data deletion, please email us at{" "}
              <a
                href="mailto:support@permtracker.app"
                className="text-primary hover:underline"
              >
                support@permtracker.app
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              9. Your Rights
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Access:</strong> Request a copy of the data we hold about
                you
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate data
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your data
              </li>
              <li>
                <strong>Portability:</strong> Request your data in a portable
                format
              </li>
              <li>
                <strong>Objection:</strong> Object to certain processing of your
                data
              </li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:support@permtracker.app"
                className="text-primary hover:underline"
              >
                support@permtracker.app
              </a>
              . We will respond within 30-45 days.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              10. Children&apos;s Privacy
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker is not intended for use by individuals under the age of
              13. We do not knowingly collect personal information from children
              under 13. If you become aware that a child has provided us with
              personal information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              11. Changes to This Policy
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify
              you of any changes by:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the &quot;Last Updated&quot; date at the top</li>
              <li>Sending an email notification for material changes</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              Your continued use of the service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              12. Contact Us
            </h2>
            <p className="text-foreground/80 leading-relaxed">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
            </p>
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@permtracker.app"
                  className="text-primary hover:underline"
                >
                  support@permtracker.app
                </a>
              </li>
              <li>
                <strong>Application:</strong> PERM Tracker
              </li>
            </ul>
          </section>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
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
