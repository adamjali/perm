/**
 * Privacy Policy Page
 *
 * Privacy policy for PERM Tracker.
 * Statically generated for fast loading.
 *
 */

import type { Metadata } from "next";
import { PlusIcon } from "@phosphor-icons/react/ssr";
import { withSocialCard } from "@/lib/socialCard";
import { SectionIndex } from "@/components/legal/SectionIndex";
import { LEGAL_DBA, LEGAL_FORM, LEGAL_NAME, POSTAL_ADDRESS, TRADE_NAME } from "@/lib/constants/about";
import { openGraphBase } from "@/lib/openGraphBase";
import Link from "next/link";

// Force static generation for instant loading
export const dynamic = "force-static";

export const metadata: Metadata = withSocialCard({
  title: "Privacy policy",
  description:
    "Privacy policy for PERM Tracker: what we collect, how we use it, who processes it and how we protect immigration case data.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    ...openGraphBase,
    title: "Privacy policy | PERM Tracker",
    description:
      "How PERM Tracker collects, uses and protects immigration case data.",
    url: "/privacy",
  },
}, "privacy");

const SECTIONS = [
  { id: "introduction", title: "1. Introduction" },
  { id: "information-we-collect", title: "2. Information We Collect" },
  { id: "how-we-use-your-information", title: "3. How We Use Your Information" },
  { id: "google-oauth-disclosure", title: "4. Google OAuth Disclosure" },
  { id: "data-storage-security", title: "5. Data Storage & Security" },
  { id: "ai-chat-assistant", title: "6. AI Chat Assistant" },
  { id: "product-analytics", title: "7. Product Analytics" },
  { id: "error-monitoring-session-replay", title: "8. Error Monitoring & Session Replay" },
  { id: "bot-fraud-prevention", title: "9. Bot & Fraud Prevention" },
  { id: "push-notifications", title: "10. Push Notifications" },
  { id: "google-calendar-integration", title: "11. Google Calendar Integration" },
  { id: "cookies-local-storage", title: "12. Cookies & Local Storage" },
  { id: "thirdparty-services", title: "13. Third-Party Services" },
  { id: "data-retention-deletion", title: "14. Data Retention & Deletion" },
  { id: "your-rights", title: "15. Your Rights" },
  { id: "international-data-transfers", title: "16. International Data Transfers" },
  { id: "childrens-privacy", title: "17. Children's Privacy" },
  { id: "uscis-case-status", title: "18. USCIS Case Status Lookups" },
  { id: "changes-to-this-policy", title: "19. Changes to This Policy" },
  { id: "contact-us", title: "20. Contact Us" },
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
      <div>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">Privacy policy</h1>{" "}
        <p className="mb-8 mt-4 text-lg text-muted-foreground">
          {/* REVIEW (date): set "Last Updated" to the day this version is published, and send the notice Section 19
              promises for material changes (question 11). */}
          Effective Date: February 17, 2026 | Last Updated: [DATE TO SET ON THE DAY THIS VERSION IS PUBLISHED]
        </p>{" "}

        <SectionIndex sections={SECTIONS} />


        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="introduction" className="font-heading text-2xl font-bold m-0">1. Introduction</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              Welcome to PERM Tracker. PERM Tracker is operated by {LEGAL_NAME},{" "}
              {LEGAL_FORM} doing business as {TRADE_NAME} (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), which
              runs permtracker.app and is the controller of the personal information this policy describes. This Privacy Policy explains
              how we collect, use,
              disclose, and safeguard your information when you use our web
              application for tracking Permanent Labor Certification (PERM)
              cases.
            </p>{" "}
            <p className="text-soft leading-relaxed mt-4">
              By using PERM Tracker, you agree to the collection and use of
              information in accordance with this policy. If you don’t agree with
              this policy, please don’t use our service.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="information-we-collect" className="font-heading text-2xl font-bold m-0">2. Information We Collect</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Account Information
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                <strong>Email address</strong>: used to sign you in, to confirm
                the address is yours, to send the email you’ve asked for, and to
                send occasional product updates you can turn off (see Product
                Update Emails below)
              </li>{" "}
              <li>
                <strong>Name</strong>: from Google if you sign in with Google,
                or typed at sign-up, where it’s optional
              </li>{" "}
              <li>
                <strong>Profile photo</strong>: if you sign in with Google, the
                address of your Google profile photo (see Section 4)
              </li>{" "}
              <li>
                <strong>Password</strong>: if you sign up with an email address
                and a password, we store only a one-way hash of the password,
                never the password itself
              </li>{" "}
              <li>
                <strong>One-time codes</strong>: to confirm your address, and
                when you reset your password, we email you a one-time code. It
                works once and expires after 10 minutes
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">Case Data</h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
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
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>UI settings (dark mode, sorting preferences)</li>{" "}
              <li>Notification preferences (email, push, quiet hours)</li>{" "}
              <li>Dismissed deadline alerts</li>{" "}
              <li>Calendar sync preferences</li>{" "}
              <li>AI chat action mode preferences</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Contact Form Submissions
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                Name, email address and message text you submit through the
                contact form, plus the submitting IP address, which we use only
                to limit abuse and keep with the message
              </li>{" "}
              <li>
                Submissions are stored and forwarded to the inbox we read, in
                Gmail, so we can reply. They’re never used for marketing and
                never shared. We keep them, and the email you send to an
                @permtracker.app address, until you ask us to delete them (see
                Section 14)
              </li>{" "}
              <li>
                Each submission, like each email sent to an @permtracker.app
                address, goes through a spam check first (see Section 9). A
                message the check holds is stored for us to read and deleted 30
                days later
              </li>
            </ul>{" "}

            <h3 id="email-alerts" className="font-heading text-lg font-bold mt-6 mb-3">
              Email Alerts Without an Account
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                You can ask for an email when DOL changes a case’s status, when
                DOL’s queue reaches your filing month, when a visa bulletin
                cutoff moves, or when DOL moves an employer’s cases as a group.
                No account is needed. For each, we keep your email address, what
                you asked to follow (a case number, a filing month, a bulletin
                category and country, or an employer’s page), the page you signed
                up on, and when we confirmed, checked and emailed. The queue
                alert also asks, if you choose to say, whether you’re an
                attorney, an applicant or an employer
              </li>{" "}
              <li>
                Nothing is sent until you click the link in our confirmation
                email. An alert you never confirm is deleted after 30 days. If
                you’re signed in with a confirmed address and choose to watch
                your own case during setup, that alert starts at once
              </li>{" "}
              <li>
                Your IP address is used only to limit how many sign-ups one
                address can make. It’s kept in our rate-limit records, not with
                the alert, and those are deleted within a day
              </li>{" "}
              <li>
                A case alert keeps watching for a year after DOL decides the
                case, in case it’s appealed or reopened, and then stops
              </li>{" "}
              <li>
                A copy of each alert email waits with us until it’s sent, and is
                deleted 30 days after that
              </li>{" "}
              {/* REVIEW (question 2): the code keeps an opted-out address on its alert row with no end date, because
                  that record is what refuses a restart without a new confirmation. This wording says so and offers
                  deletion on request; a fixed period would need a code change. */}
              <li>
                Every alert email has a link that stops it in one click, and a
                link to a page listing everything your address receives, where
                you can turn any of it off. When you stop an alert, we keep a
                note that your address opted out, so it can’t be restarted
                without a new confirmation. To have that note deleted too, write
                to{" "}
                <a href="mailto:support@permtracker.app" className="link">
                  support@permtracker.app
                </a>
              </li>{" "}
              <li>
                If you delete your account, the alerts sent to its email address
                stop as well
              </li>
            </ul>{" "}

            {/* REVIEW (product updates): the owner chose opt-out for account holders on Nov 4 2026. Under CAN-SPAM
                every product update must carry the unsubscribe link and the postal address (Resend's broadcasts add
                the link). For visitors in the EEA and UK, sending these to account holders without a tick rests on
                the existing-customer rule (PECR regulation 22(3), ePrivacy Article 13(2)); please confirm that fits,
                or say if those visitors should be asked first. Nothing is sent under this wording until it's live. */}
            <h3 id="product-updates" className="font-heading text-lg font-bold mt-6 mb-3">
              Product Update Emails
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                If you have an account, we may email you occasional product
                updates: new features and changes to PERM Tracker. You can turn
                them off at any time in Settings, under Notifications, or with
                the unsubscribe link in any of them. Turning them off doesn’t
                stop the reminders, alerts and account emails you’ve set up
              </li>{" "}
              <li>
                Without an account, you get product updates only if you tick the
                box for them when you sign up for an alert, and then confirm it
              </li>{" "}
              <li>
                We send them through Resend, which keeps your email address,
                your first name if you gave one, and whether you’ve turned them
                off (see Section 13)
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Reviews
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                The rating, review and name you submit through the review form.
                Once we approve a review, its rating, text and name show on the
                site
              </li>{" "}
              <li>
                An email address, if you give one. It&apos;s never shown or
                shared, and is used only to follow up about your review. If
                you&apos;re signed in, or arrive from a link in our email, the
                form fills in your name and address for you to keep or change.
                A link from our email is kept in this browser for one day,
                sealed so it can&apos;t be read there, so the form still knows
                it&apos;s you after a reload; it&apos;s cleared once you send
                the review
              </li>{" "}
              <li>
                The submitting IP address, used only to limit spam and never
                stored with the review
              </li>{" "}
              <li>
                A review we don&apos;t show (spam, abuse, someone&apos;s
                personal details, or not about PERM Tracker) has its words,
                name and email deleted 90 days after we decide; its rating and
                the reason stay
              </li>{" "}
              <li>
                After a rating of 3 stars or fewer, an optional private note on
                what we could do better. Only we read it; it&apos;s never shown
                with the review, and it&apos;s deleted 90 days after you send it
              </li>{" "}
              <li>
                The 1 to 5 rating you tap in a case&apos;s last alert email,
                kept with your address and the case, the time of each tap, and
                the browser line your browser sends with it. We keep that line
                so a mail scanner opening the links isn&apos;t counted as your
                rating. A note you add can be kept without your address. Once
                we approve it, the rating can show on the reviews page as
                &quot;Case alert reader&quot; with the month, never with your
                name, address or case. If you also write a review, it takes the
                rating&apos;s place, so you&apos;re counted once
              </li>
            </ul>{" "}

            <h3 id="community-timelines" className="font-heading text-lg font-bold mt-6 mb-3">
              Your Timeline After PERM
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                On a case’s page you can save the dates that came after PERM
                (the I-140, the I-485, a work permit, a travel document, an
                interview, the green card) and a few choices from fixed lists,
                such as your category and country. There’s no free-text box. The
                PERM dates come from DOL’s own record and are never typed by you
              </li>{" "}
              <li>
                No account is needed. Your browser keeps a random key for that
                case, and we keep only a one-way hash of it. Anyone using that
                browser can change or remove the timeline, and removing it
                deletes it
              </li>{" "}
              <li>
                We also keep a hash of your IP address with the timeline, to
                limit how many timelines one address can save. It’s made with a
                secret key, so it can’t be turned back into your address by
                trying every address; timelines saved before November 4, 2026
                carry an older hash made without that key. We treat both as
                personal data
              </li>{" "}
              <li>
                If you tick &quot;Show my timeline on the public board&quot;,
                it’s listed there with its filing month and how many days each
                step took. The board never shows the case number, the employer or
                an exact PERM date, and it lists nothing until 25 people have
                shared
              </li>{" "}
              <li>
                Whether or not you tick that box, your dates count toward the
                anonymous medians on the green card timelines page, which show no
                figure from fewer than 5 timelines
              </li>{" "}
              <li>
                Anyone who looks up the same case number can see how many
                timelines were saved for it and how many report each step, but
                only once at least 3 people have added dates for that case. They
                can never see the dates
              </li>{" "}
              <li>
                We keep a timeline until you remove it, or until we take it down
              </li>
            </ul>{" "}

            {/* REVIEW (question 9): a DOL case number saved in an account, or watched by email, notification or
                webhook, that DOL knows and we didn't hold is added to our public case tables, which publish DOL's
                record for it. The record is DOL's public information; this wording discloses it rather than
                changing it. Not adding saved cases would be a code change. */}
            <h3 id="case-numbers" className="font-heading text-lg font-bold mt-6 mb-3">
              Case Numbers You Look Up or Save
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                When you look up a DOL case number we don’t hold yet, we ask
                DOL’s public case-status service about it. If DOL has a record,
                we add it to our case tables, where it shows like any other case
                DOL publishes: its number, status, employer, job title and filing
                date. Nothing about you is stored with it
              </li>{" "}
              <li>
                A DOL case number you save in your account, and any case number
                someone asks us to watch by email, browser notification or
                webhook, is checked with DOL every 5 minutes on weekdays from 7
                AM to 9 PM Eastern, and every 30 minutes at other times. We send
                DOL the case number only. What DOL returns goes into the same
                case tables, so a saved case DOL knows becomes part of the case
                records we show. You can turn this off for one saved case, or
                for every case in your account, in the app
              </li>{" "}
              <li>
                Our analytics removes case numbers from page addresses before
                anything is sent
              </li>{" "}
              <li>
                The USCIS lookup can keep up to 12 of your receipt numbers, with
                a label for each, on this device. They stay in your browser’s
                storage, and we never receive them
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Technical Information
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>IP address and browser type</li>{" "}
              <li>Device information and screen resolution</li>{" "}
              <li>Usage patterns and interaction data</li>{" "}
              <li>Performance metrics (page load times, Core Web Vitals)</li>{" "}
              <li>Error logs and stack traces (for debugging)</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              API Keys
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                If you make an API key, we keep its name, a one-way hash of it
                (never the key itself), its scopes, when you made it, and when it
                stops if you gave it a lifetime. A key you revoke keeps that
                record, marked revoked, so a call with it can be told the key was
                revoked. The records go when you delete your account
              </li>{" "}
              <li>
                How many calls each key made each day and when it was last used,
                under a random account number that names nobody. We keep these
                counts for 400 days, to enforce your plan&rsquo;s limits and show
                your usage in Settings. If you delete your account, the counts
                stay under that random number, which then points to no one
              </li>{" "}
              <li>
                If you register a webhook, its address, the events it receives
                and its signing secret, stored encrypted. We keep a log of
                deliveries for 30 days
              </li>
            </ul>{" "}

            <h3 id="firm-claims" className="font-heading text-lg font-bold mt-6 mb-3">
              Claiming a Law Firm&rsquo;s Page
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              When someone claims a law firm&rsquo;s page, we keep the email
              address they used, the role they gave (shown to no one but us)
              and what they sent for the profile. The profile is public on the
              firm&rsquo;s page as the firm&rsquo;s own words; the address and
              role are not. To check a claim we compare the address&rsquo;s
              domain with the domains DOL&rsquo;s public filings list beside
              the firm, of which we keep only the domains, never the addresses.
              We may remove a profile at any time. Ask us to delete a claim and
              its profile at the address below.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="how-we-use-your-information" className="font-heading text-2xl font-bold m-0">3. How We Use Your Information</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              We use the information we collect to:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>Provide and maintain the PERM tracking service</li>{" "}
              <li>Authenticate your account and ensure security</li>{" "}
              <li>
                Send the deadline reminders, case alerts and other email and
                browser notifications you ask for
              </li>{" "}
              <li>
                Send account holders occasional product updates, which you can
                turn off (see Product Update Emails in Section 2)
              </li>{" "}
              {/* REVIEW (question 6): the congratulations note goes to an alert subscriber's address, by hand from
                  the press mailbox, two business days after DOL certifies or approves the watched case. It wasn't
                  described before. Is describing it here enough, or does it need a line at sign-up? */}
              <li>
                Send a personal note, written and sent by a person, after DOL
                certifies or approves a case you asked us to watch
              </li>{" "}
              <li>Power the AI chat assistant with case context for relevant responses</li>{" "}
              <li>Sync deadlines to your Google Calendar (if enabled)</li>{" "}
              <li>Monitor application errors and improve reliability</li>{" "}
              <li>Improve user experience and application features</li>{" "}
              <li>Respond to customer support requests</li>{" "}
              <li>Comply with legal obligations</li>
            </ul>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="google-oauth-disclosure" className="font-heading text-2xl font-bold m-0">4. Google OAuth Disclosure</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              PERM Tracker uses Google OAuth as one of our authentication methods.
              When you sign in with Google:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                We receive your <strong>email address</strong>, your{" "}
                <strong>name</strong> and the address of your{" "}
                <strong>Google profile photo</strong>. We show the photo in your
                Settings; your browser loads it from Google&apos;s servers
              </li>{" "}
              {/* REVIEW (Google sign-in): this bullet said Google's data was used "solely for authentication". The
                  address from Google sign-in now also receives the account emails and, unless turned off, product
                  updates, so it's worded as what we do. Please check it against the Google API Services User Data
                  Policy for the basic profile and email scopes. */}
              <li>
                This information is used to sign you in, to identify your
                account, and to send you the email described in Section 2
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
            <p className="text-soft leading-relaxed mt-4">
              Our use of Google user data complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="data-storage-security" className="font-heading text-2xl font-bold m-0">5. Data Storage &amp; Security</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              Your data is stored securely using industry-standard practices:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
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
              </li>{" "}
              <li>
                <strong>Backups:</strong> each night we copy our databases to
                Cloudflare R2 storage. The copies that hold your account, your
                cases, our alert lists and the website&apos;s own database are
                sealed before they leave our systems, so that only a key kept
                off our servers and out of R2 can open them. The one copy that
                isn&apos;t sealed holds only DOL&apos;s published H-1B LCA
                records. We keep the newest 15 nightly copies and the first copy
                of each of the last 3 months, so something you delete leaves our
                backups within about three months
              </li>{" "}
              <li>
                <strong>Signing out:</strong> when you&apos;re signed in, the app
                signs you out after 30 minutes without activity, and warns you
                two minutes before
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              While we implement robust security measures, no method of
              transmission over the Internet is 100% secure. We can’t guarantee
              absolute security of your data.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="ai-chat-assistant" className="font-heading text-2xl font-bold m-0">6. AI Chat Assistant</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              PERM Tracker includes an AI-powered chat assistant to help you
              understand your cases, deadlines, and PERM processes. When you use
              the AI chat feature:
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What Data Is Shared
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
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
            <p className="text-soft leading-relaxed">
              Your AI chat data is processed by the following third-party
              providers through their APIs, each tried in turn when another is
              unavailable. Your case data reaches them only when you use the
              chat. The assistant uses these providers&apos; free tiers, under
              their own terms:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Google Gemini</strong> (Google LLC): the primary
                provider. Under Google&apos;s terms for unpaid use, Google may
                use what is sent, and the responses, to provide, improve and
                develop its products, and human reviewers may read it after
                Google separates it from our account.
              </li>{" "}
              <li>
                <strong>Groq</strong>: doesn&apos;t keep requests by default.
                It may log them for up to 30 days to fix errors or investigate
                abuse.
              </li>{" "}
              <li>
                <strong>OpenRouter</strong>: routes a request to a
                model&apos;s own provider, whose policy decides whether the
                request is kept or used for training.
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Web Search
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              When the AI assistant performs web searches on your behalf, search
              queries are sent to:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Tavily</strong>: Primary web search provider
              </li>{" "}
              <li>
                <strong>Brave Search</strong>: Fallback web search provider
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              Search queries are derived from your questions and don’t include
              your personal information or case data.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Your Controls
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>You can choose not to use the AI chat feature</li>{" "}
              <li>
                You can configure AI action modes (off, confirm, auto) in
                Settings
              </li>{" "}
              <li>
                You can delete your conversation history at any time
              </li>
            </ul>{" "}

            <div className="bg-tint p-4 mt-4 border-2 border-black shadow-hard-sm">
              <p className="text-soft leading-relaxed font-medium">
                <strong>IMPORTANT:</strong> Don’t share Social Security numbers,
                passport numbers, financial account information, or other highly
                sensitive personal data in AI chat messages. The AI assistant is
                designed to help with case management, not to process sensitive
                identity documents. Because it runs on the providers&apos; free
                tiers, don&apos;t put anything in a chat message you wouldn&apos;t
                want a provider to read.
              </p>
            </div>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="product-analytics" className="font-heading text-2xl font-bold m-0">7. Product Analytics</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              We use PostHog (PostHog, Inc.) for product analytics to understand
              how the application is used and to improve features.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What We Collect
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>Page views and navigation patterns</li>{" "}
              <li>Feature usage events (e.g., creating a case, using AI chat)</li>{" "}
              <li>Browser exceptions and JavaScript errors</li>{" "}
              <li>Browser type, device information, and screen resolution</li>{" "}
              <li>
                The country you’re visiting from, as our network provider
                (Cloudflare) reports it: the country only, never your city or
                your IP address. When you’re signed in, PostHog may also
                estimate your city from your IP address.
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              User Identification
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              When you aren’t signed in, PostHog runs in cookie-free mode: it
              sets no cookies and stores nothing in your browser. PostHog’s
              servers count visits with a one-way hash of your IP address,
              browser type and our site name, mixed with a random value that
              changes every day and is deleted once that day is processed, so a
              visit today can’t be linked to a visit tomorrow.
            </p>{" "}
            <p className="text-soft leading-relaxed mt-4">
              When you’re signed in, analytics events are linked to your
              account to help us understand usage patterns, and PostHog uses a
              cookie and local storage to keep that link. Your identity is
              reset when you sign out, and analytics goes back to cookie-free
              mode.
            </p>{" "}
            <p className="text-soft leading-relaxed mt-4">
              You can switch usage analytics off at any time with the switch at
              the foot of every page: while it’s off, this browser sends PostHog
              nothing at all, signed in or not. Signed in, you can also switch it
              off in Settings, under Support, and that setting follows your
              account to every device you sign in on.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Data Routing
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Analytics data is sent through a reverse proxy on our domain
              (permtracker.app/ingest) to PostHog&apos;s US servers
              (us.posthog.com). This means analytics requests appear as
              first-party traffic in your browser&apos;s network tab rather than
              as requests to a third-party domain.
            </p>{" "}

            <p className="text-soft leading-relaxed mt-4">
              PostHog acts as our data processor. For details, see{" "}
              <a
                href="https://posthog.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                PostHog&apos;s Privacy Policy
              </a>
              .
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Session Replay
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              PostHog can also record session replays: playbacks of page
              interactions (clicks, scrolls, navigation and on-screen content).{" "}
              <strong>Session replay is switched off as of September 6, 2026</strong>{" "}
              and no replays are being recorded. If we turn it back on, this
              section will say so first, and the rules below will apply.
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Form inputs are masked</strong>: values you type into
                fields, and all passwords, are redacted and not captured.
              </li>{" "}
              <li>
                <strong>On-screen text is masked too</strong>: the recorder is
                set to hide all text on the page, which can include case
                information. We would never use replays for advertising and
                never sell them.
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
            <p className="text-soft leading-relaxed mt-4">
              Enabling Global Privacy Control in your browser opts you out of
              PostHog analytics (and replay, whenever it is on). The only other
              analytics on the site is Ahrefs Web Analytics (Section 13), which
              sets no cookies and collects no personal data, so there is nothing
              for GPC to switch off there.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Surveys
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              PostHog Surveys is switched off. If we ever use it to ask for
              in-app feedback, responses you choose to give are processed by
              PostHog as our data processor, and taking part is always
              optional.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="error-monitoring-session-replay" className="font-heading text-2xl font-bold m-0">8. Error Monitoring &amp; Session Replay</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              We use Sentry (Functional Software, Inc.) to monitor application
              errors and improve reliability.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Error Tracking
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>JavaScript error messages and stack traces</li>{" "}
              <li>Browser and device information (browser type, OS, screen size)</li>{" "}
              <li>User actions leading to errors (page navigation, clicks)</li>{" "}
              <li>Application performance metrics</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Session Replay
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Sentry does not record session replays for this site. That
              feature was removed on August 29, 2026; Sentry receives error
              reports and performance timings only.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Privacy Protections
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                When you&apos;re signed in, Sentry is told only your account
                number, never your name or email address, so an error can be
                traced to the account it happened in
              </li>{" "}
              <li>
                Email addresses in the message and details of an error report
                from your browser or from our backend are replaced by a short
                code before the report is sent
              </li>{" "}
              <li>
                The script in your browser removes request contents before it
                sends an error. Cookies aren&apos;t sent
              </li>{" "}
              {/* REVIEW (server error reports): true from the Nov 5 2026 2 AM deploy (commit 1a82294a turned off
                  Sentry's default of attaching up to 10 KB of a failed request's body). This branch ships after it. */}
              <li>
                Error reports from the website&apos;s own server carry the page
                address and the error, never what was sent in the request that
                failed. We use them only to fix the error
              </li>{" "}
              <li>
                Sentry runs only on the live site; copies we run for development
                send nothing
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              Sentry acts as our data processor under a Data Processing Agreement.
              For details, see{" "}
              <a
                href="https://sentry.io/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Sentry&apos;s Privacy Policy
              </a>
              .
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="bot-fraud-prevention" className="font-heading text-2xl font-bold m-0">9. Bot &amp; Fraud Prevention</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              To protect our sign-up, password-reset and contact forms from
              automated abuse, we use Cloudflare Turnstile, operated by
              Cloudflare, Inc.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Signals Collected by Turnstile
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Per Cloudflare&apos;s Turnstile Privacy Addendum, the following
              signals are processed when a Turnstile challenge is rendered:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>Client IP address</li>{" "}
              <li>TLS fingerprint</li>{" "}
              <li>HTTP User-Agent header</li>{" "}
              <li>Your interactions with our forms (mouse movement, click timing)</li>{" "}
              <li>The PERM Tracker sitekey and origin URL</li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              Turnstile does <strong>not</strong> use third-party tracking
              cookies and does <strong>not</strong> read the contents of form
              fields you type (email, password, or name).
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Cloudflare&apos;s Role
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Cloudflare acts as our data processor when providing Turnstile
              to us, and as an independent data controller when using
              aggregated signals to improve its own bot-detection capabilities.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              When Turnstile Appears
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                <strong>Sign-up:</strong> required. It runs out of sight for most
                visitors and asks for a click only when Cloudflare&apos;s risk
                analysis wants one
              </li>{" "}
              <li>
                <strong>Password reset:</strong> the widget is always visible
              </li>{" "}
              <li>
                <strong>Contact form:</strong> it runs out of sight for most
                visitors. A message whose check fails is refused. If the check
                couldn&apos;t run, the message isn&apos;t lost: it goes through
                the spam check below with that taken into account
              </li>{" "}
              <li>
                <strong>Sign-in:</strong> there&apos;s no Turnstile check.
                Sign-in is protected by your password and by limits on how many
                attempts one IP address and one email address can make
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Spam Check on Email and the Contact Form
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Email sent to an @permtracker.app address and messages sent
              through our contact form are checked for spam before they reach
              our inbox. The check uses our own rules (links, sales pitches,
              bulk-mail headers) and a second opinion from an AI model run by
              Cloudflare Workers AI, which reads the sender&apos;s domain, the
              subject and the start of the message. Per Cloudflare&apos;s Workers
              AI data-usage terms, Cloudflare doesn&apos;t keep that text after
              the check and doesn&apos;t use it to train AI models. A message the
              check holds is never deleted unread or bounced: it&apos;s stored,
              listed for us to read, and deleted 30 days after it was held.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Legal Basis
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              We process this data on the basis of our legitimate interest
              in preventing fraud, spam, and abuse of our service (GDPR
              Art. 6(1)(f); CCPA service-provider disclosure).
            </p>{" "}

            <p className="text-soft leading-relaxed mt-4">
              For more detail, see{" "}
              <a
                href="https://www.cloudflare.com/turnstile-privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Cloudflare&apos;s Turnstile Privacy Addendum
              </a>{" "}
              and{" "}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                Cloudflare&apos;s Privacy Policy
              </a>
              .
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-8 mb-3">
              Rate Limiting
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              We enforce multiple layers of rate limiting to prevent abuse:
              per-IP limits at the network edge (covering all traffic to
              sign-up, sign-in, password-reset, OTP verification, and AI
              chat endpoints), per-email limits on authentication actions,
              and per-user limits on hot backend mutations (case create,
              conversation create, notification marks, knowledge search,
              etc.). When a limit is reached, requests return an HTTP 429
              response for the duration of the rate-limit window. We keep
              only the minimum counter state needed (a request count and a
              timestamp) and an internal blocklist of IP addresses that hit
              our limits three times within 15 minutes. A blocked address is
              unblocked automatically after one hour. Counter records are
              deleted within a day.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Automated Account Protection
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              If one account has 10 failed sign-in attempts within 30
              minutes while our limits are also catching an IP address
              flooding sign-in, which is the signature of credential
              stuffing, we lock that account for one hour to protect its
              owner. We record the lock and are told about it by email. If
              you&apos;re locked out, write to support and we can lift it
              sooner.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="push-notifications" className="font-heading text-2xl font-bold m-0">10. Push Notifications</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              When you turn on browser notifications, your browser makes a
              subscription: an address at its push service and two encryption
              keys. If you&apos;re signed in, we store it on your user profile to
              deliver deadline reminders and case alerts.
            </p>{" "}

            <h3 id="push-without-account" className="font-heading text-lg font-bold mt-6 mb-3">
              Without an Account
            </h3>{" "}
            {/* REVIEW (question 4): a stopped account-free subscription keeps its row, subscription included, marked
                stopped, and nothing deletes it; the code never sends to it again. This wording says so. Deleting them
                when they stop would be a code change and would let this say "deleted when it stops". */}
            <p className="text-soft leading-relaxed">
              You can also turn on a browser notification for one case&apos;s DOL
              status, or for each new visa bulletin for one category and
              country, without an account or an email address. We keep the
              subscription, a one-way hash of it, the case number or the bulletin
              line, and the last status we told you about. Your IP address is
              used only to limit how many subscriptions one address can make, and
              that record is deleted within a day. A notification stops when you
              press stop on the page, when your browser or its push service ends
              the subscription, or when deliveries to it keep failing; a case
              notification also stops when DOL decides the case. A stopped
              subscription is kept in our records, marked stopped, and never used
              again.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              What We Collect
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                <strong>Endpoint URL</strong>: Browser-generated URL for
                receiving notifications
              </li>{" "}
              <li>
                <strong>Encryption keys</strong> (p256dh, auth): Browser-generated keys for secure message delivery
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              This data identifies a browser and doesn&apos;t name anyone.
              Because it can be tied to the case you asked about, we treat it as
              personal data.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Delivery Services
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              Notifications are delivered through your browser&apos;s push
              service: Google&apos;s (Chrome, Edge on Android and other Chromium
              browsers), Mozilla&apos;s (Firefox), Microsoft&apos;s Windows push
              service (Edge on Windows) or Apple&apos;s (Safari). We only send to
              those services. They may collect technical device data.
              Notification content is encrypted end to end where the browser
              supports it.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              Your Controls
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>Push notifications require explicit opt-in via browser permission</li>{" "}
              <li>Disable anytime in browser settings or in-app notification preferences</li>{" "}
              <li>Configure quiet hours and notification types in Settings</li>{" "}
              <li>
                If you&apos;re signed in, your subscription is removed from your
                profile when you turn notifications off in the app, when your
                browser&apos;s push service tells us it has ended (for example
                after you block notifications in the browser), or when you
                delete your account
              </li>
            </ul>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="google-calendar-integration" className="font-heading text-2xl font-bold m-0">11. Google Calendar Integration</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              You may optionally connect your Google Calendar to sync PERM
              deadlines as calendar events.
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
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
            <p className="text-soft leading-relaxed mt-4">
              We don’t access your existing calendar events, contacts, or other
              Google services through this integration.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="cookies-local-storage" className="font-heading text-2xl font-bold m-0">12. Cookies &amp; Local Storage</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              We use the following storage technologies:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Session Cookies:</strong> Essential for authentication and
                maintaining your login session
              </li>{" "}
              <li>
                <strong>LocalStorage:</strong> Stores preferences such as dark
                mode settings, UI preferences, temporary authentication state
                during OAuth redirects, for one day the sealed review link from
                our email (see Reviews above), your saved USCIS receipt numbers,
                and the key that lets you change a timeline you saved (see
                Section 2)
              </li>{" "}
              <li>
                <strong>Error Monitoring:</strong> Sentry’s script runs only on
                the sign-in pages and inside the app, where it reports errors.
                It doesn’t record sessions; that feature was removed on August
                29, 2026
              </li>{" "}
              <li>
                <strong>Analytics:</strong> if you aren’t signed in, PostHog
                stores nothing in your browser (cookie-free mode, Section 7).
                If you’re signed in, it uses a cookie and local storage to link
                your events to your account. Analytics data is routed through
                our domain (permtracker.app/ingest) rather than directly to
                PostHog
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              These storage technologies are used for application functionality
              and service improvement. They don’t track you across other
              websites.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="thirdparty-services" className="font-heading text-2xl font-bold m-0">13. Third-Party Services</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              We use the following third-party services to operate PERM Tracker:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Convex:</strong> Backend platform, database, and
                authentication (SOC 2 Type II, hosted on AWS)
              </li>{" "}
              <li>
                <strong>Oracle Cloud Infrastructure:</strong> Hosting for the website and
                its public-data database, on servers in the United States
              </li>{" "}
              <li>
                <strong>Cloudflare:</strong> The network in front of the
                website. Every request passes through it, so it receives your
                browser&apos;s standard request data (IP address, user agent)
                to deliver the page and screen out abusive traffic. It also
                runs Turnstile (Section 9)
              </li>{" "}
              <li>
                <strong>Resend:</strong> Transactional email delivery
                (notifications, OTP verification, password resets) and product
                update emails. For product updates we give Resend the email
                address and first name of each account holder, and of each person
                without an account who asked for them; Resend keeps whether
                you&apos;ve turned them off (see Product Update Emails in Section
                2)
              </li>{" "}
              <li>
                <strong>Google:</strong> sign-in with Google, the Calendar API,
                and Gmail, which receives a copy of every message sent to an
                @permtracker.app address and every contact-form message, so we can
                read and answer them
              </li>{" "}
              <li>
                <strong>Zoho Mail:</strong> the mailbox our press address runs on.
                When we write to you by hand from it, such as a note after DOL
                certifies a case you watched or a reply to a message you sent,
                the message and your address are kept in that mailbox
              </li>{" "}
              <li>
                <strong>Senja:</strong> the review form we used before October 23,
                2026. Some emails we sent before then link to it. Reviews left
                there are copied once a day into our own reviews, where they wait
                for approval like any other. Senja keeps its own copy under its
                own policy
              </li>{" "}
              <li>
                <strong>PostHog:</strong> Product analytics and event tracking
                (see Section 7)
              </li>{" "}
              <li>
                <strong>Sentry:</strong> Error tracking and performance
                monitoring (see Section 8)
              </li>{" "}
              <li>
                <strong>Ahrefs Web Analytics:</strong> Cookieless, aggregate
                page-view analytics loaded on every page. It sets no cookies,
                stores no identifiers on your device and collects no personal
                data; we see page counts and referrers, not people.
              </li>{" "}
              <li>
                <strong>AI Providers:</strong> Google Gemini, Groq and
                OpenRouter for AI chat assistance (see Section 6)
              </li>{" "}
              <li>
                <strong>Search Providers:</strong> Tavily and Brave Search for AI
                web search capabilities (see Section 6)
              </li>{" "}
              <li>
                <strong>Cloudflare, Inc.:</strong> DNS, encryption and the network
                edge in front of the site (rate limiting and bot mitigation),
                Turnstile on authentication and contact forms, email routing for
                @permtracker.app addresses, Workers AI for the spam check on
                that email and contact form messages (see Section 9), and R2
                storage for our nightly backups (see Section 5)
              </li>{" "}
              <li>
                <strong>Browser Push Services:</strong> Google FCM, Mozilla Push
                Service, Microsoft Windows Push Notification Services and Apple
                APNs, for browser notifications (see Section 10)
              </li>{" "}
              <li>
                <strong>USCIS (U.S. Citizenship and Immigration Services):</strong>{" "}
                the Case Status API behind the USCIS receipt lookup, once USCIS
                has granted access. What is sent and what is stored is in
                Section 18.
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              Each of these services has their own privacy policies. We recommend
              reviewing their policies for additional information. Convex
              maintains a public list of sub-processors at{" "}
              <a
                href="https://www.convex.dev/legal/subprocessors"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                convex.dev/legal/subprocessors
              </a>
              .
            </p>{" "}

            {/* REVIEW (Section 13): the old sentence said every provider is "prohibited from using it for their own
                purposes"; Gemini's unpaid tier and Senja aren't. Whether those two still count as CCPA service
                providers, and so whether "we don't share" holds as written, is the attorney's call. */}
            <div className="bg-tint p-4 mt-4 border-2 border-black shadow-hard-sm">
              <p className="text-soft leading-relaxed font-medium">
                <strong>
                  We don’t sell or share your personal information.
                </strong>{" "}
                We have never sold your data, and we don’t share it for
                cross-context behavioral advertising, as those terms are defined
                under the California Consumer Privacy Act (CCPA). We disclose
                personal information only to the service providers listed above,
                to run the site, and they process it for us under their terms.
                Two exceptions: the chat&apos;s AI providers may use what the chat
                sends them as Section 6 describes for each, and Senja keeps its
                own copy of a review left on its form. We run no third-party
                advertising trackers.
              </p>
            </div>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="data-retention-deletion" className="font-heading text-2xl font-bold m-0">14. Data Retention &amp; Deletion</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>Your data is retained for as long as your account is active</li>{" "}
              <li>
                You may request deletion of your account and all associated data
                at any time from Settings
              </li>{" "}
              <li>
                When you ask to delete your account, it enters a 30-day grace
                period during which you can cancel, or you can choose to delete
                it at once. Then your account, your cases and the rest of your
                account&apos;s data are permanently deleted, and the email alerts
                sent to its address stop. Copies in our backups leave them within
                about three months (see Section 5)
              </li>{" "}
              <li>
                <strong>What deleting an account doesn&apos;t remove:</strong>{" "}
                reviews you wrote, emails you sent to our support address,
                messages you sent through the contact form, and star ratings you
                tapped in an alert email. These aren&apos;t part of your account:
                they&apos;re records of what was published on the site or said to
                us, so we keep them, with the email address they came from if
                they had one, after the account is gone. A note we sent you by hand stays in the
                mailbox it was sent from. To have any of them removed, write to{" "}
                <a href="mailto:support@permtracker.app" className="link">
                  support@permtracker.app
                </a>{" "}
                with the address you used
              </li>{" "}
              <li>
                <strong>Email alert sign-ups</strong> you never confirm are
                deleted after 30 days
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
              <li>
                <strong>USCIS case-status lookups</strong> are deleted twelve
                months after the last lookup of that receipt (see Section 18)
              </li>{" "}
              <li>Some data may be retained longer if required by law</li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              AI Provider Retention
            </h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>
                Google Gemini: under Google&apos;s terms for unpaid use, Google
                may keep what is sent and use it to improve its products (see AI
                Service Providers above)
              </li>{" "}
              <li>
                Groq: not kept by default; it may be logged for up to 30 days to
                fix errors or investigate abuse
              </li>{" "}
              <li>
                OpenRouter: decided by the policy of the model&apos;s own
                provider, which may keep a request or use it for training
              </li>
            </ul>{" "}

            <p className="text-soft leading-relaxed mt-4">
              To request data deletion, please email us at{" "}
              <a
                href="mailto:support@permtracker.app"
                className="link"
              >
                support@permtracker.app
              </a>
              .
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="your-rights" className="font-heading text-2xl font-bold m-0">15. Your Rights</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Access:</strong> Download all your data at any time via
                the &quot;Download everything (.json)&quot; button in Settings, or request a copy by
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
            <p className="text-soft leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{" "}
              <a
                href="mailto:support@permtracker.app"
                className="link"
              >
                support@permtracker.app
              </a>
              . We’ll respond within 30-45 days.
            </p>{" "}
            <p className="text-soft leading-relaxed mt-4">
              These rights cover the information you give us and the data your
              account holds. The case records and employer names the site shows
              from the Department of Labor’s disclosure files and other federal
              sources are public government records, not data you gave us. To
              ask about one, write to the same address.
            </p>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              California Residents (CCPA/CPRA)
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              If you’re a California resident, you have the right to know what
              personal information we collect and how we use it, to access and
              delete it, to correct inaccurate information, to opt out of the
              sale or sharing of personal information, and to limit the use of
              sensitive personal information. We won’t discriminate against
              you for exercising these rights.
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>
                  We don’t sell or share your personal information
                </strong>{" "}
                (including for cross-context behavioral advertising), so there’s
                nothing to opt out of, but we still honor opt-out signals.
              </li>{" "}
              <li>
                <strong>Global Privacy Control (GPC):</strong> we detect and
                honor the GPC browser signal; when it’s present, we disable
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
                  className="link"
                >
                  support@permtracker.app
                </a>{" "}
                (no account changes are required, and you may use an authorized agent).
              </li>
            </ul>{" "}

            <h3 className="font-heading text-lg font-bold mt-6 mb-3">
              EEA, UK &amp; Switzerland (GDPR / UK GDPR)
            </h3>{" "}
            <p className="text-soft leading-relaxed">
              If you’re located in the European Economic Area, the United
              Kingdom, or Switzerland, you have the rights of access,
              rectification, erasure, restriction, portability, and objection,
              and the right to withdraw consent at any time. Our legal bases for
              processing are:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Performance of a contract</strong>: to provide the
                case-tracking service you sign up for.
              </li>{" "}
              <li>
                <strong>Legitimate interests</strong>: to secure the service,
                prevent abuse, and improve the product (including analytics),
                and to send account holders occasional product updates, which
                you can turn off at any time.
              </li>{" "}
              <li>
                <strong>Consent</strong>: for optional features such as product
                updates for people without an account, which you can withdraw at
                any time.
              </li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              You also have the right to lodge a complaint with your local data
              protection authority (in the UK, the Information
              Commissioner&apos;s Office). International transfers of your data to
              the United States rely on Standard Contractual Clauses (see Section
              16). We don’t engage in solely-automated decision-making that
              produces legal or similarly significant effects.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="international-data-transfers" className="font-heading text-2xl font-bold m-0">16. International Data Transfers</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              Your data is primarily stored and processed in the United States.
              If you’re located in the European Economic Area (EEA), United
              Kingdom, or Switzerland, your data may be transferred to the United
              States by our service providers (Convex, Cloudflare, Resend,
              Google, Zoho, Sentry, PostHog and the AI chat providers).
            </p>{" "}
            {/* REVIEW (Section 16): nobody has confirmed that every provider's terms carry SCCs or a data processing
                agreement (Gemini's unpaid tier, Senja and Zoho are the ones to check). The attorney decides whether
                this sentence stays, narrows to the providers that do, or goes. */}
            <p className="text-soft leading-relaxed mt-4">
              These transfers are protected by Standard Contractual Clauses (SCCs)
              approved by the European Commission, as well as Data Processing
              Agreements with our service providers.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="childrens-privacy" className="font-heading text-2xl font-bold m-0">17. Children&apos;s Privacy</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            {/* REVIEW (question 10): Option A, adults for accounts and the rest of the site open to anyone, chosen to
                match Terms Section 3. Option B (the whole service for people 18 and older) is in the review notes. */}
            <p className="text-soft leading-relaxed">
              An account requires you to be at least 18 (Terms of Service,
              Section 3). The rest of the site isn&apos;t directed to children
              under 13, and we don&apos;t knowingly collect personal information
              from them. If you learn that a child under 13 has given us personal
              information, contact us and we&apos;ll delete it.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="uscis-case-status" className="font-heading text-2xl font-bold m-0">18. USCIS Case Status Lookups</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              The USCIS case status lookup lets you enter a receipt number and see what
              USCIS says about that case. It runs on USCIS&apos;s Case Status API under
              credentials issued to us, and it&apos;s available only once
              USCIS has granted that access; until then the page says so and looks
              nothing up.
            </p>{" "}
            <h3 className="font-heading text-lg font-bold mt-6 mb-3">What you give and what we send</h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>You type a receipt number (thirteen characters, such as IOE0912345678). No account is needed and no name is asked for.</li>{" "}
              <li>We send that receipt number to USCIS over an encrypted connection with our API credentials. USCIS&apos;s own terms of use and privacy policy apply to what USCIS does with the request.</li>{" "}
              <li>USCIS answers with the form type, the current status text, and a dated history of status changes. It doesn&apos;t return your name or any other identifier.</li>
            </ul>{" "}
            <h3 className="font-heading text-lg font-bold mt-6 mb-3">What we store</h3>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4">
              <li>The receipt number, the form type, the status text, the dated history, and the time of the lookup.</li>{" "}
              <li>We store it so a later lookup of the same receipt can show what changed, and so we can count lookups by form type and status. Counts are published only in aggregate; a receipt number is never published or shared.</li>{" "}
              <li>A receipt number identifies a case rather than a person, and we treat it as personal data anyway: it&apos;s encrypted at rest with the rest of the database, it&apos;s not sold, and it&apos;s not used for advertising.</li>{" "}
              <li>Stored lookups are deleted twelve months after the last lookup of that receipt, or sooner if you ask at <a href="mailto:support@permtracker.app?subject=USCIS%20lookup%20deletion" className="link">support@permtracker.app</a> with the receipt number.</li>{" "}
              <li>No email or notification is sent from a lookup. If alerts on USCIS receipts are ever offered they will be a separate, opt-in subscription described here first.</li>
            </ul>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="changes-to-this-policy" className="font-heading text-2xl font-bold m-0">19. Changes to This Policy</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            {/* REVIEW (question 11): which of this version's changes are material, and does the email notice go to
                account holders only or to alert subscribers too? Several describe processing the policy never named
                (alerts without an account, timelines, account-free notifications, the congratulations note, Zoho,
                Gmail, Senja, backups, case numbers added to the public tables, product updates by default). The
                Oct 29 notice about the AI providers is still unsent and could go in the same email. */}
            <p className="text-soft leading-relaxed">
              We may update this Privacy Policy from time to time. We’ll notify
              you of any changes by:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>Posting the new Privacy Policy on this page</li>{" "}
              <li>Updating the &quot;Last Updated&quot; date at the top</li>{" "}
              <li>Sending an email notification for material changes</li>
            </ul>{" "}
            <p className="text-soft leading-relaxed mt-4">
              Your continued use of the service after changes constitutes
              acceptance of the updated policy.
            </p>
          </details>{" "}

          <details className="legal-section group border-b-2 border-border">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 py-4 [&::-webkit-details-marker]:hidden">
              <h2 id="contact-us" className="font-heading text-2xl font-bold m-0">20. Contact Us</h2>{" "}
              <PlusIcon aria-hidden="true" weight="bold" className="size-5 shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none" />
            </summary>{" "}
            <p className="text-soft leading-relaxed">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
            </p>{" "}
            <ul className="list-disc list-inside text-soft space-y-2 ml-4 mt-4">
              <li>
                <strong>Email:</strong>{" "}
                <a
                  href="mailto:support@permtracker.app"
                  className="link"
                >
                  support@permtracker.app
                </a>
              </li>{" "}
              <li>
                <strong>Application:</strong> PERM Tracker
              </li>{" "}
              <li>
                <strong>Operator:</strong> {`${LEGAL_DBA}, ${LEGAL_FORM}`}
              </li>{" "}
              <li>
                <strong>Mailing address:</strong> {POSTAL_ADDRESS}
              </li>
            </ul>
          </details>
        </div>

        {/* Back link */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline text-muted-foreground text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
