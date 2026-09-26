/**
 * Double opt-in confirmation for following an employer.
 *
 * Mirrors BulletinAlertConfirm: beyond the button, it shows the employer the
 * reader picked, by the name DOL prints, so a click on the wrong company is
 * visible before they confirm it. The name comes from our own records, never
 * from the form, so a stranger cannot put words in this email.
 */
import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface EmployerAlertConfirmProps {
  /** The employer as DOL prints it. */
  employerName: string;
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
  /**
   * True when the subscriber also ticked the product-news box, so the same
   * confirm click opts them into that as well.
   *
   * A plain sentence, never a link and never a second button: like its two
   * siblings this email carries no onward links and everything on it is
   * subordinate to the confirm button. But the sentence has to be here,
   * because a click that confirms two things is only consent for the second if
   * the email said so.
   */
  includesNews?: boolean;
  /** Optional, default off: links already in inboxes predate it. */
  includesNewsletter?: boolean;
}

export function EmployerAlertConfirm({
  employerName,
  confirmUrl,
  includesNews = false,
  includesNewsletter = false,
}: EmployerAlertConfirmProps) {
  return (
    <EmailLayout
      previewText={`Confirm and we’ll email you when DOL moves ${employerName}’s PERM cases as a group.`}
      hideSettingsLink
      footerText={`This address was entered to follow ${employerName}’s PERM cases on PERM Tracker. It isn’t confirmed yet, so nothing else will be sent.`}
    >
      <Section style={styles.stamp}>
        <Text style={styles.stampEyebrow}>Employer to follow</Text>
        <Text style={styles.stampValue}>{employerName}</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        You asked to follow this employer&rsquo;s PERM cases. Confirm and
        we&rsquo;ll email you when DOL puts five or more of them on hold or
        takes them off it in a day, or decides a batch of them well above its
        usual pace. Never more than one email a day.
      </Text>

      {includesNews ? (
        <Text className="em-text-secondary" style={styles.newsNote}>
          You also asked for occasional product news. The same click confirms
          that.
        </Text>
      ) : null}
      {includesNewsletter ? (
        <Text className="em-text-secondary" style={styles.newsNote}>
          You also asked for the weekly bulletin digest, once it launches. The
          same click confirms that.
        </Text>
      ) : null}

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          Follow this employer
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        If you didn&rsquo;t ask for this, ignore it. Nothing will be sent.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  stamp: {
    marginBottom: "24px",
  },
  stampEyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 4px 0",
  },
  stampValue: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: "34px",
    margin: 0,
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "26px",
    margin: "0 0 24px 0",
  },
  // Above the button, not below it: a reader who clicks straight away never
  // sees anything under the CTA, and this line has to be read before the click
  // rather than after it.
  newsNote: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "22px",
    margin: "0 0 24px 0",
  },
  cta: {
    marginBottom: "20px",
  },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
  },
} as const;
