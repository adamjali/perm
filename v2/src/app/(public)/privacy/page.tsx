/**
 * Privacy Policy Page
 *
 * Privacy policy for PERM Tracker.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
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
  openGraph: {
    ...openGraphBase,
    title: "Privacy Policy | PERM Tracker",
    description:
      "How PERM Tracker collects, uses and protects immigration case data.",
    url: "/privacy",
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
        <h1 className="font-heading text-4xl font-black mb-2">Privacy Policy</h1>{" "}
        <p className="text-foreground/60 mb-8">
          Effective Date: February 17, 2026 | Last Updated: June 15, 2026
        </p>{" "}

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              1. Introduction
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Welcome to PERM Tracker. PERM Tracker (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;) operates permtracker.app. This Privacy Policy explains
              how we collect, use,
              disclose, and safeguard your information when you use our web
              application for tracking Permanent Labor Certification (PERM)
              cases.
            </p>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              By using PERM Tracker, you agree to the collection and use of
              information in accordance with this policy. If you do not agree with
              this policy, please do not use our service.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              2. Information We Collect
            </h2>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Account Information
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>
                <strong>Email address</strong>: Used for account creation,
                authentication, and notifications
              </li>{" "}
              <li>
                <strong>Name</strong>: Obtained via Google OAuth or entered
                during signup
              </li>{" "}
              <li>
                <strong>Password</strong>: If you use email/password
                authentication, your password is securely hashed and never stored
                in plain text (managed by our authentication provider)
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">Case Data</h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Employer names and position titles</li>{" "}
              <li>Beneficiary identifiers</li>{" "}
              <li>Case status and progress information</li>{" "}
              <li>Important dates (PWD filing, recruitment dates, etc.)</li>{" "}
              <li>Notes and case-related documentation references</li>{" "}
              <li>RFI/RFE information and response dates</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              User Preferences
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>UI settings (dark mode, sorting preferences)</li>{" "}
              <li>Notification preferences (email, push, quiet hours)</li>{" "}
              <li>Dismissed deadline alerts</li>{" "}
              <li>Calendar sync preferences</li>{" "}
              <li>AI chat action mode preferences</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Technical Information
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>IP address and browser type</li>{" "}
              <li>Device information and screen resolution</li>{" "}
              <li>Usage patterns and interaction data</li>{" "}
              <li>Performance metrics (page load times, Core Web Vitals)</li>{" "}
              <li>Error logs and stack traces (for debugging)</li>
            </ul>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              3. How We Use Your Information
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We use the information we collect to:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>Provide and maintain the PERM tracking service</li>{" "}
              <li>Authenticate your account and ensure security</li>{" "}
              <li>Send email and push notifications about upcoming deadlines</li>{" "}
              <li>Power the AI chat assistant with case context for relevant responses</li>{" "}
              <li>Sync deadlines to your Google Calendar (if enabled)</li>{" "}
              <li>Monitor application errors and improve reliability</li>{" "}
              <li>Improve user experience and application features</li>{" "}
              <li>Respond to customer support requests</li>{" "}
              <li>Comply with legal obligations</li>
            </ul>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              4. Google OAuth Disclosure
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker uses Google OAuth as one of our authentication methods.
              When you sign in with Google:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                We access only your <strong>email address</strong> and{" "}
                <strong>display name</strong>
              </li>{" "}
              <li>
                This information is used{" "}
                <strong>solely for authentication</strong> and account
                identification
              </li>{" "}
              <li>
                We do <strong>not</strong> access your Google contacts, calendar
                (unless you separately enable Calendar Sync), or any other Google
                services
              </li>{" "}
              <li>
                We do <strong>not</strong> share your Google account data with any
                third parties
              </li>{" "}
              <li>
                We do <strong>not</strong> store your Google password
              </li>
            </ul>{" "}
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
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              5. Data Storage &amp; Security
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Your data is stored securely using industry-standard practices:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Database:</strong> Convex backend platform hosted on
                Amazon Web Services (AWS) in US East (N. Virginia)
              </li>{" "}
              <li>
                <strong>Encryption at Rest:</strong> 256-bit AES encryption for
                all stored data
              </li>{" "}
              <li>
                <strong>Encryption in Transit:</strong> All data transmitted via
                TLS/HTTPS encryption
              </li>{" "}
              <li>
                <strong>Access Control:</strong> Server-side authorization ensures
                each user can only access their own data through authenticated
                backend functions. Internal access to the database is restricted
                to authorized PERM Tracker personnel who may access your data
                only to provide technical support you have requested, diagnose
                and fix bugs, maintain service security and reliability, or
                fulfill legal obligations
              </li>{" "}
              <li>
                <strong>Authentication:</strong> Managed by Convex Auth with
                secure session handling
              </li>{" "}
              <li>
                <strong>Compliance:</strong> Our backend provider (Convex) is SOC
                2 Type II compliant and GDPR compliant
              </li>{" "}
              <li>
                <strong>Calendar Tokens:</strong> Google Calendar OAuth tokens are
                encrypted at rest using AES-256-GCM before storage
              </li>{" "}
              <li>
                <strong>Employer FEIN:</strong> Federal Employer Identification
                Numbers are encrypted at rest using AES-256-GCM and decrypted
                only when displayed to the authenticated case owner
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              While we implement robust security measures, no method of
              transmission over the Internet is 100% secure. We cannot guarantee
              absolute security of your data.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              6. AI Chat Assistant
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker includes an AI-powered chat assistant to help you
              understand your cases, deadlines, and PERM processes. When you use
              the AI chat feature:
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What Data Is Shared
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Your chat messages and questions</li>{" "}
              <li>
                Case data referenced in conversations (employer names, position
                titles, beneficiary identifiers, wage information, case numbers,
                status, dates, and notes)
              </li>{" "}
              <li>
                System-generated context (your name, case counts, current page)
              </li>{" "}
              <li>Conversation history for context continuity</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              AI Service Providers
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Your AI chat data is processed by the following third-party
              providers via their APIs. We use a multi-provider fallback system
              for reliability:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Google Gemini</strong> (Google LLC): Primary AI provider.
                Retains data for up to 55 days for abuse monitoring only. Does{" "}
                <strong>not</strong> use API data to train models.
              </li>{" "}
              <li>
                <strong>OpenRouter</strong>: AI model routing. Zero Data
                Retention (ZDR) by default; prompts are not stored.
              </li>{" "}
              <li>
                <strong>Mistral AI</strong>: Fallback AI provider. API data is
                not used for model training.
              </li>{" "}
              <li>
                <strong>Groq</strong>: Fast AI inference on US-based Google Cloud
                servers. Does not use API data for training when ZDR is enabled.
              </li>{" "}
              <li>
                <strong>Cerebras</strong>: Emergency fallback AI inference. Does
                not use API data for model training.
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Web Search
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              When the AI assistant performs web searches on your behalf, search
              queries are sent to:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Tavily</strong>: Primary web search provider
              </li>{" "}
              <li>
                <strong>Brave Search</strong>: Fallback web search provider
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              Search queries are derived from your questions and do not include
              your personal information or case data.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Your Controls
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>You can choose not to use the AI chat feature</li>{" "}
              <li>
                You can configure AI action modes (off, confirm, auto) in
                Settings
              </li>{" "}
              <li>
                You can delete your conversation history at any time
              </li>
            </ul>{" "}

            <div className="rounded-lg border-2 border-black bg-muted p-4 shadow-hard-sm dark:border-white mt-4">
              <p className="text-foreground/80 leading-relaxed font-medium">
                <strong>IMPORTANT:</strong> Do not share Social Security numbers,
                passport numbers, financial account information, or other highly
                sensitive personal data in AI chat messages. The AI assistant is
                designed to help with case management, not to process sensitive
                identity documents.
              </p>
            </div>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              7. Product Analytics
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We use PostHog (PostHog, Inc.) for product analytics to understand
              how the application is used and to improve features.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What We Collect
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Page views and navigation patterns</li>{" "}
              <li>Feature usage events (e.g., creating a case, using AI chat)</li>{" "}
              <li>Browser exceptions and JavaScript errors</li>{" "}
              <li>Browser type, device information, and screen resolution</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              User Identification
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              When you are logged in, analytics events are linked to your
              account to help us understand usage patterns. Your identity is
              reset on logout so anonymous browsing is not linked to your
              account.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Data Routing
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Analytics data is sent through a reverse proxy on our domain
              (permtracker.app/ingest) to PostHog&apos;s US servers
              (us.posthog.com). This means analytics requests appear as
              first-party traffic in your browser&apos;s network tab rather than
              as requests to a third-party domain.
            </p>{" "}

            <p className="text-foreground/80 leading-relaxed mt-4">
              PostHog acts as our data processor. For details, see{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                PostHog&apos;s Privacy Policy
              </a>
              .
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Session Replay
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              In addition to event analytics, PostHog records session replays, playbacks of page interactions (clicks, scrolls, navigation, and
              on-screen content), which we use to diagnose usability issues and
              improve the product.
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Form inputs are masked</strong>: values you type into
                fields, and all passwords, are redacted and not captured.
              </li>{" "}
              <li>
                <strong>On-screen text is not masked by default</strong>: text
                displayed on the pages you view, which can include case
                information, may be captured in a replay. We never use these
                replays for advertising and never sell them.
              </li>{" "}
              <li>
                Replays are routed first-party through{" "}
                <code>permtracker.app/ingest</code> rather than to a third-party
                domain.
              </li>{" "}
              <li>
                <strong>Global Privacy Control (GPC):</strong> if your browser
                sends a GPC signal, we automatically disable PostHog analytics
                and session replay for your session.
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              This is separate from the masked, error-diagnosis replays described
              in Section 8. You can opt out of all analytics and replay by
              enabling Global Privacy Control in your browser.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Surveys
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We occasionally use PostHog Surveys to ask for in-app feedback.
              Responses you choose to provide are processed by PostHog as our
              data processor. Participation is always optional.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              8. Error Monitoring &amp; Session Replay
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We use Sentry (Functional Software, Inc.) to monitor application
              errors and improve reliability.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Error Tracking
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>JavaScript error messages and stack traces</li>{" "}
              <li>Browser and device information (browser type, OS, screen size)</li>{" "}
              <li>User actions leading to errors (page navigation, clicks)</li>{" "}
              <li>Application performance metrics</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Session Replay
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              To help diagnose errors, Sentry records anonymized session replays
              of page interactions for <strong>10% of normal sessions</strong> and{" "}
              <strong>100% of sessions where an error occurs</strong>.
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>All text content is masked</strong>: replaced with
                asterisks so no readable text is captured
              </li>{" "}
              <li>
                <strong>All images and media are blocked</strong>: replaced with
                blank placeholders
              </li>{" "}
              <li>
                <strong>Form input values are not recorded</strong>: keystrokes
                are redacted
              </li>{" "}
              <li>
                Only page structure, mouse movements, clicks, and scrolls are
                captured
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Privacy Protections
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>
                <code>sendDefaultPii</code> is disabled, so cookies, user agent strings with PII, and request bodies are not sent
              </li>{" "}
              <li>Request body data is stripped before transmission to Sentry</li>{" "}
              <li>
                Sentry automatically scrubs credit card numbers, SSNs, and other
                PII patterns
              </li>{" "}
              <li>
                Development environment events are suppressed (not sent to Sentry)
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              Sentry acts as our data processor under a Data Processing Agreement.
              For details, see{" "}
              <a
                href="https://sentry.io/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Sentry&apos;s Privacy Policy
              </a>
              .
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              9. Bot &amp; Fraud Prevention
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              To protect our sign-up, sign-in, and password-reset forms from
              automated abuse, we use Cloudflare Turnstile, operated by
              Cloudflare, Inc.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Signals Collected by Turnstile
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Per Cloudflare&apos;s Turnstile Privacy Addendum, the following
              signals are processed when a Turnstile challenge is rendered:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>Client IP address</li>{" "}
              <li>TLS fingerprint</li>{" "}
              <li>HTTP User-Agent header</li>{" "}
              <li>Your interactions with our forms (mouse movement, click timing)</li>{" "}
              <li>The PERM Tracker sitekey and origin URL</li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              Turnstile does <strong>not</strong> use third-party tracking
              cookies and does <strong>not</strong> read the contents of form
              fields you type (email, password, or name).
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Cloudflare&apos;s Role
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Cloudflare acts as our data processor when providing Turnstile
              to us, and as an independent data controller when using
              aggregated signals to improve its own bot-detection capabilities.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              When Turnstile Appears
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>
                <strong>Sign-up:</strong> widget is always visible
              </li>{" "}
              <li>
                <strong>Password reset:</strong> widget is always visible
              </li>{" "}
              <li>
                <strong>Sign-in:</strong> widget is invisible for most
                visitors; an interactive challenge only appears if Cloudflare&apos;s
                risk analysis flags the attempt as suspicious
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Legal Basis
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We process this data on the basis of our legitimate interest
              in preventing fraud, spam, and abuse of our service (GDPR
              Art. 6(1)(f); CCPA service-provider disclosure).
            </p>{" "}

            <p className="text-foreground/80 leading-relaxed mt-4">
              For more detail, see{" "}
              <a
                href="https://www.cloudflare.com/turnstile-privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Cloudflare&apos;s Turnstile Privacy Addendum
              </a>{" "}
              and{" "}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Cloudflare&apos;s Privacy Policy
              </a>
              .
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-8 mb-3">
              Vercel BotID (Invisible Bot Detection)
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              In addition to Turnstile, we use Vercel BotID on our AI chat
              and authentication API endpoints. BotID passively observes
              browser-level signals to distinguish humans from automated
              scripts, without requiring any user interaction or showing
              any widget.
            </p>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              BotID may process the following client signals:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-2">
              <li>TLS handshake fingerprint (JA4 digest)</li>{" "}
              <li>Browser characteristics (rendering capabilities, engine internals)</li>{" "}
              <li>JavaScript execution timing patterns</li>{" "}
              <li>Pointer and interaction characteristics</li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              BotID does <strong>not</strong> read the contents of the
              requests it protects (your chat messages, credentials, or form
              fields), does <strong>not</strong> use tracking cookies, and
              is invisible to legitimate users. Vercel Inc. operates the
              service; its verification data is processed in the United
              States. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Vercel&apos;s Privacy Policy
              </a>
              .
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-8 mb-3">
              Rate Limiting
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We enforce multiple layers of rate limiting to prevent abuse:
              per-IP limits at the network edge (covering all traffic to
              sign-up, sign-in, password-reset, OTP verification, and AI
              chat endpoints), per-email limits on authentication actions,
              and per-user limits on hot backend mutations (case create,
              conversation create, notification marks, knowledge search,
              etc.). When a limit is reached, requests return an HTTP 429
              response for the duration of the rate-limit window. We
              retain only the minimum counter state needed (request count
              + timestamp) and an internal abuse blocklist of IP addresses
              that trip limits repeatedly (auto-expired after 24 hours).
              Counter state is automatically purged when the window closes.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Automated Account Protection
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If we detect an abnormal volume of failed sign-in attempts
              against the same account (for example, 10 failures within 30 minutes, which is the signature of credential-stuffing), we
              automatically place the account in a temporarily locked
              state for up to 24 hours to protect the legitimate owner. We
              notify our security team and record the event for audit.
              Owners of accounts placed in this state can contact support
              to appeal and have the lock lifted earlier.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              10. Push Notifications
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              When you enable push notifications, your browser generates a unique
              subscription including an endpoint URL and encryption keys. We store
              this subscription data on your user profile to deliver deadline
              reminders and case alerts.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What We Collect
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>
                <strong>Endpoint URL</strong>: Browser-generated URL for
                receiving notifications
              </li>{" "}
              <li>
                <strong>Encryption keys</strong> (p256dh, auth): Browser-generated keys for secure message delivery
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              This data does not contain personally identifiable information and
              consists of technical identifiers generated by your browser.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Delivery Services
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Notifications are delivered through your browser&apos;s push service
              (Google FCM for Chrome, Mozilla Push Service for Firefox, Apple Push
              Notification service for Safari). These services may collect
              technical device metadata. Notification content is encrypted
              end-to-end where supported.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Your Controls
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Push notifications require explicit opt-in via browser permission</li>{" "}
              <li>Disable anytime in browser settings or in-app notification preferences</li>{" "}
              <li>Configure quiet hours and notification types in Settings</li>{" "}
              <li>Subscription data is deleted when you revoke permissions or delete your account</li>
            </ul>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              11. Google Calendar Integration
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              You may optionally connect your Google Calendar to sync PERM
              deadlines as calendar events.
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>OAuth Scope:</strong> We request access only to create,
                update, and delete calendar events
                (calendar.events scope)
              </li>{" "}
              <li>
                <strong>Data Synced:</strong> Deadline dates, event titles with
                case information (employer, deadline type), and deadline
                descriptions
              </li>{" "}
              <li>
                <strong>Token Storage:</strong> Your Google Calendar OAuth tokens
                are encrypted at rest using AES-256-GCM before storage in our
                database
              </li>{" "}
              <li>
                <strong>Disconnect Anytime:</strong> You can disconnect Google
                Calendar from Settings, which revokes access and removes stored
                tokens
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              We do not access your existing calendar events, contacts, or other
              Google services through this integration.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              12. Cookies &amp; Local Storage
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We use the following storage technologies:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Session Cookies:</strong> Essential for authentication and
                maintaining your login session
              </li>{" "}
              <li>
                <strong>LocalStorage:</strong> Stores preferences such as dark
                mode settings, UI preferences, and temporary authentication state
                during OAuth redirects
              </li>{" "}
              <li>
                <strong>Error Monitoring:</strong> Sentry uses browser local
                storage to temporarily buffer error and session replay data before
                transmission
              </li>{" "}
              <li>
                <strong>Analytics:</strong> PostHog uses cookies and local
                storage to identify your device across sessions for analytics
                purposes. Analytics data is routed through our domain
                (permtracker.app/ingest) rather than directly to PostHog
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              These storage technologies are used for application functionality
              and service improvement. They do not track you across other
              websites.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              13. Third-Party Services
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We use the following third-party services to operate PERM Tracker:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Convex:</strong> Backend platform, database, and
                authentication (SOC 2 Type II, hosted on AWS)
              </li>{" "}
              <li>
                <strong>Vercel:</strong> Frontend hosting, deployment, and
                performance monitoring (Speed Insights)
              </li>{" "}
              <li>
                <strong>Resend:</strong> Transactional email delivery
                (notifications, OTP verification, password resets) and, if you
                opt in, marketing and product-update emails (we sync your email
                address and first name to Resend for this purpose)
              </li>{" "}
              <li>
                <strong>Google:</strong> OAuth authentication and Calendar API
                integration
              </li>{" "}
              <li>
                <strong>PostHog:</strong> Product analytics, event tracking, and
                session replay (see Section 7)
              </li>{" "}
              <li>
                <strong>Sentry:</strong> Error tracking, performance monitoring,
                and session replay (see Section 8)
              </li>{" "}
              <li>
                <strong>AI Providers:</strong> Google Gemini, OpenRouter, Mistral
                AI, Groq, and Cerebras for AI chat assistance (see Section 6)
              </li>{" "}
              <li>
                <strong>Search Providers:</strong> Tavily and Brave Search for AI
                web search capabilities (see Section 6)
              </li>{" "}
              <li>
                <strong>Cloudflare, Inc.:</strong> Bot and fraud prevention
                via Turnstile on authentication forms (see Section 9)
              </li>{" "}
              <li>
                <strong>Vercel Inc.:</strong> Frontend hosting + BotID
                invisible bot detection on AI chat and auth endpoints (see
                Section 9)
              </li>{" "}
              <li>
                <strong>Browser Push Services:</strong> Google FCM, Mozilla Push
                Service, and Apple APNs for push notification delivery (see
                Section 10)
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              Each of these services has their own privacy policies. We recommend
              reviewing their policies for additional information. Convex
              maintains a public list of sub-processors at{" "}
              <a
                href="https://www.convex.dev/legal/subprocessors"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                convex.dev/legal/subprocessors
              </a>
              .
            </p>{" "}

            <div className="rounded-lg border-2 border-black bg-muted p-4 shadow-hard-sm dark:border-white mt-4">
              <p className="text-foreground/80 leading-relaxed font-medium">
                <strong>
                  We do not sell or share your personal information.
                </strong>{" "}
                We have never sold your data, and we do not share it for
                cross-context behavioral advertising, as those terms are defined
                under the California Consumer Privacy Act (CCPA). We disclose
                personal information only to the service providers listed above,
                who process it on our behalf under written agreements and are
                prohibited from using it for their own purposes. We run no
                third-party advertising trackers.
              </p>
            </div>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              14. Data Retention &amp; Deletion
            </h2>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Your data is retained for as long as your account is active</li>{" "}
              <li>
                You may request deletion of your account and all associated data
                at any time from Settings
              </li>{" "}
              <li>
                Upon deletion request, your account enters a 30-day grace
                period during which you can cancel. After the grace period,
                all data is permanently deleted
              </li>{" "}
              <li>
                <strong>AI conversation data</strong> is automatically deleted
                after 90 days of inactivity, even if your account remains active
              </li>{" "}
              <li>
                <strong>Read notifications</strong> older than 90 days are
                automatically cleaned up
              </li>{" "}
              <li>
                <strong>Rate limit records</strong> are automatically cleaned up
                after 24 hours
              </li>{" "}
              <li>Some data may be retained longer if required by law</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              AI Provider Retention
            </h3>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4">
              <li>Google Gemini: Up to 55 days (abuse monitoring), then deleted</li>{" "}
              <li>OpenRouter: Not stored (Zero Data Retention)</li>{" "}
              <li>Mistral AI: Per their data processing terms</li>{" "}
              <li>Groq: Not stored when ZDR is enabled</li>{" "}
              <li>Cerebras: Per their data processing terms</li>
            </ul>{" "}

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
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              15. Your Rights
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Access:</strong> Download all your data at any time via
                the &quot;Export All My Data&quot; button in Settings, or request a copy by
                contacting us
              </li>{" "}
              <li>
                <strong>Correction:</strong> Request correction of inaccurate data
              </li>{" "}
              <li>
                <strong>Deletion:</strong> Request deletion of your data
              </li>{" "}
              <li>
                <strong>Portability:</strong> Request your data in a portable
                format
              </li>{" "}
              <li>
                <strong>Objection:</strong> Object to certain processing of your
                data
              </li>{" "}
              <li>
                <strong>AI Opt-Out:</strong> Choose not to use AI chat features
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:support@permtracker.app"
                className="text-primary hover:underline"
              >
                support@permtracker.app
              </a>
              . We will respond within 30-45 days.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              California Residents (CCPA/CPRA)
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If you are a California resident, you have the right to know what
              personal information we collect and how we use it, to access and
              delete it, to correct inaccurate information, to opt out of the
              sale or sharing of personal information, and to limit the use of
              sensitive personal information. We will not discriminate against
              you for exercising these rights.
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>
                  We do not sell or share your personal information
                </strong>{" "}
                (including for cross-context behavioral advertising), so there is
                nothing to opt out of, but we still honor opt-out signals.
              </li>{" "}
              <li>
                <strong>Global Privacy Control (GPC):</strong> we detect and
                honor the GPC browser signal; when it is present, we disable
                analytics and session replay for your session.
              </li>{" "}
              <li>
                <strong>Sensitive information:</strong> the case data you enter
                may relate to immigration status. We use it only to provide the
                service and never for advertising.
              </li>{" "}
              <li>
                To exercise any California right, email{" "}
                <a
                  href="mailto:support@permtracker.app"
                  className="text-primary hover:underline"
                >
                  support@permtracker.app
                </a>{" "}
                (no account changes are required, and you may use an authorized agent).
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              EEA, UK &amp; Switzerland (GDPR / UK GDPR)
            </h3>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If you are located in the European Economic Area, the United
              Kingdom, or Switzerland, you have the rights of access,
              rectification, erasure, restriction, portability, and objection,
              and the right to withdraw consent at any time. Our legal bases for
              processing are:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Performance of a contract</strong>: to provide the
                case-tracking service you sign up for.
              </li>{" "}
              <li>
                <strong>Legitimate interests</strong>: to secure the service,
                prevent abuse, and improve the product (including analytics).
              </li>{" "}
              <li>
                <strong>Consent</strong>: for optional features such as
                marketing emails, which you can withdraw at any time.
              </li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              You also have the right to lodge a complaint with your local data
              protection authority (in the UK, the Information
              Commissioner&apos;s Office). International transfers of your data to
              the United States rely on Standard Contractual Clauses (see Section
              16). We do not engage in solely-automated decision-making that
              produces legal or similarly significant effects.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              16. International Data Transfers
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              Your data is primarily stored and processed in the United States.
              If you are located in the European Economic Area (EEA), United
              Kingdom, or Switzerland, your data may be transferred to the United
              States by our service providers (Convex, AI providers, Sentry,
              PostHog).
            </p>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              These transfers are protected by Standard Contractual Clauses (SCCs)
              approved by the European Commission, as well as Data Processing
              Agreements with our service providers.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              17. Children&apos;s Privacy
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              PERM Tracker is not intended for use by individuals under the age of
              13. We do not knowingly collect personal information from children
              under 13. If you become aware that a child has provided us with
              personal information, please contact us immediately.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              18. Changes to This Policy
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify
              you of any changes by:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>Posting the new Privacy Policy on this page</li>{" "}
              <li>Updating the &quot;Last Updated&quot; date at the top</li>{" "}
              <li>Sending an email notification for material changes</li>
            </ul>{" "}
            <p className="text-foreground/80 leading-relaxed mt-4">
              Your continued use of the service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>{" "}

          <section>
            <h2 className="font-heading text-2xl font-bold mt-8 mb-4">
              19. Contact Us
            </h2>{" "}
            <p className="text-foreground/80 leading-relaxed">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
            </p>{" "}
            <ul className="list-disc list-inside text-foreground/80 space-y-2 ml-4 mt-4">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@permtracker.app"
                  className="text-primary hover:underline"
                >
                  support@permtracker.app
                </a>
              </li>{" "}
              <li>
                <strong>Application:</strong> PERM Tracker
              </li>{" "}
              <li>
                <strong>Operator:</strong> PERM Tracker, Washington, DC 20001
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
