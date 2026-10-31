/**
 * Double opt-in confirmation for the weekly digest signed up for on its own (convex/digestSignup.ts).
 *
 * Mirrors the alert confirmations: what was asked for, one button, and a line for someone who didn't ask. No
 * onward links: everything on it is subordinate to the confirm button.
 */
import { Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface DigestConfirmProps {
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
}

export function DigestConfirm({ confirmUrl }: DigestConfirmProps) {
  return (
    <EmailLayout
      previewText="Confirm and the weekly digest comes to this address on Tuesdays."
      hideSettingsLink
      footerText="This address was entered for PERM Tracker’s weekly digest. It isn’t confirmed yet, so nothing else will be sent."
    >
      <Section style={styles.stamp}>
        <Text className="em-text-secondary" style={styles.stampEyebrow}>You asked for</Text>
        <Text className="em-text" style={styles.stampValue}>The weekly digest</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        Every Tuesday: where DOL&rsquo;s queue stands, what the visa bulletin moved, USCIS&rsquo;s processing times
        and the rules on their way. Confirm and the next issue comes to this address.
      </Text>

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          Confirm the digest
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        If you didn&rsquo;t ask for this, ignore it. Nothing will be sent.
      </Text>
    </EmailLayout>
  );
}

DigestConfirm.PreviewProps = {
  confirmUrl: "https://permtracker.app/digest/confirm?token=preview",
} satisfies DigestConfirmProps;

export default DigestConfirm;

const styles = {
  stamp: { marginBottom: "24px" },
  stampEyebrow: { fontFamily: SANS_STACK, color: "#5A5A5A", fontSize: "14px", margin: "0 0 4px 0" },
  stampValue: { fontFamily: SANS_STACK, color: "#1A1A1A", fontSize: "28px", fontWeight: 700, lineHeight: "34px", margin: 0 },
  body: { fontFamily: SANS_STACK, color: "#2A2A2A", fontSize: "16px", lineHeight: "26px", margin: "0 0 24px 0" },
  cta: { marginBottom: "20px" },
  note: { fontFamily: SANS_STACK, color: "#5A5A5A", fontSize: "14px", lineHeight: "20px", margin: 0 },
} as const;
