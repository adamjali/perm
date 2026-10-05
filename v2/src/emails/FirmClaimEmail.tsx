/**
 * The three emails a law firm gets when it claims its page.
 *
 * - `confirm`: the link that proves the claimant reads mail at the address.
 * - `approved`: the admin checked a claim by hand and published it.
 * - `edit`: a fresh link to edit the firm's profile.
 *
 * Every link here GRANTS something, so every one expires (convex/lib/expiringToken.ts),
 * and each email says when. The firm's name comes from our records, never from
 * the form, so a stranger can't put words of their choosing in this email.
 * Like the alert confirmations it carries no opt-out: there's no subscription.
 */
import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export type FirmClaimEmailKind = "confirm" | "approved" | "edit";

export interface FirmClaimEmailProps {
  kind: FirmClaimEmailKind;
  /** The firm as DOL prints it on our page. */
  firmName: string;
  /** Absolute link: the confirm page or the edit page. */
  url: string;
  /** How long the link works, in words: "7 days", "2 days". */
  validFor: string;
  /** confirm only: whether DOL's files already tie the address's domain to the firm. */
  domainVerified?: boolean;
}

const COPY: Record<FirmClaimEmailKind, { preview: (f: string) => string; body: (f: string, auto: boolean) => string; button: string }> = {
  confirm: {
    preview: (f) => `Confirm your claim on ${f}'s PERM Tracker page.`,
    body: (_f, auto) =>
      auto
        ? "Confirm and your profile goes up on the firm's page, marked as the firm's own words, next to DOL's figures."
        : "Confirm and we'll check the claim by hand, because DOL's files don't tie this address's domain to the firm. We'll email you when it's done.",
    button: "Confirm the claim",
  },
  approved: {
    preview: (f) => `Your claim on ${f}'s page is approved.`,
    body: () => "We checked your claim and your profile is up on the firm's page, marked as the firm's own words. You can change it or take it down here.",
    button: "Edit the profile",
  },
  edit: {
    preview: (f) => `Edit ${f}'s profile on PERM Tracker.`,
    body: () => "Here's your link to change the firm's profile or take it down.",
    button: "Edit the profile",
  },
};

export function FirmClaimEmail({ kind, firmName, url, validFor, domainVerified = false }: FirmClaimEmailProps) {
  const c = COPY[kind];
  return (
    <EmailLayout
      previewText={c.preview(firmName)}
      hideSettingsLink
      footerText={`This address was entered to claim ${firmName}'s page on PERM Tracker.`}
    >
      <Section style={styles.stamp}>
        <Text style={styles.stampEyebrow}>Law firm</Text>
        <Text style={styles.stampValue}>{firmName}</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        {c.body(firmName, domainVerified)}
      </Text>

      <Section style={styles.cta}>
        <EmailButton href={url} variant="primary">
          {c.button}
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        {`The link works for ${validFor}. If you didn’t ask for this, ignore it: nothing changes.`}
      </Text>
    </EmailLayout>
  );
}

const styles = {
  stamp: { marginBottom: "24px" },
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
  cta: { marginBottom: "20px" },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
  },
} as const;
