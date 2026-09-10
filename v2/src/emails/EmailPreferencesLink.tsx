/**
 * The magic link to the email preference centre.
 *
 * THIS EMAIL WAS PLAIN TEXT UNTIL 2026-09-09, and it was the only one in the
 * codebase that was: twenty templates exist and every other sending path
 * renders one. Nothing in `emailPrefs.ts` explained the exception, which is
 * how it reads as an oversight rather than a decision.
 *
 * It matters more here than on any other message. Every piece of this email
 * is a phishing signal when it arrives unstyled: an unfamiliar sender shape,
 * a long opaque token, and an instruction to click a link in order to change
 * your email settings. This is the one email whose entire job is to be
 * trusted enough to click, so it gets the same frame, the same button and the
 * same footer as everything else the reader has already received from us.
 *
 * ONE BUTTON, NO ONWARD LINKS. Same reasoning as the confirmation emails: a
 * reader who clicks straight away never sees anything below the CTA, and this
 * message has exactly one thing for them to do.
 *
 * The copy states the consent asymmetry in the reader's own terms - this link
 * can turn things OFF and can never turn anything on - because that asymmetry
 * is the reason the link is safe to be replayable and never expires, and the
 * reader is the one carrying the risk if it is not true.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";

import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface EmailPreferencesLinkProps {
  /** Absolute, purpose-scoped preferences URL on the public site. */
  prefsUrl: string;
}

export function EmailPreferencesLink({ prefsUrl }: EmailPreferencesLinkProps) {
  return (
    <EmailLayout
      previewText="See everything PERM Tracker sends to this address, and turn any of it off."
      hideSettingsLink
      footerText="This link was requested from the email preferences page. If it wasn't you, ignore this message: nothing changes unless the link is used."
    >
      <Text className="em-text-body" style={styles.body}>
        Here is your link to see everything PERM Tracker sends to this address.
        The page lists each alert separately and lets you turn any of them off,
        or stop all of it at once.
      </Text>

      <Text className="em-text-secondary" style={styles.note}>
        This link can only turn things off. Starting something new always
        happens on the site itself, never from an emailed link.
      </Text>

      <Section style={styles.cta}>
        <EmailButton href={prefsUrl} variant="primary">
          Open my email preferences
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        If you didn&rsquo;t ask for this, ignore it. Nothing changes unless the
        link is used.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 20px 0",
  },
  // Above the button. A reader who clicks immediately never sees anything
  // under the CTA, and the off-only rule is the thing that makes this link
  // safe to be replayable - it has to be read before the click.
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 24px 0",
  },
  cta: {
    marginBottom: "20px",
  },
} as const;

export default EmailPreferencesLink;
