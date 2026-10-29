/**
 * Double opt-in confirmation for the weekly digest signed up for on its own (convex/digestSignup.ts).
 *
 * Mirrors the alert confirmations: what was asked for, one button, and a line for someone who didn't ask. No
 * onward links: everything on it is subordinate to the confirm button.
 */
import { Section, Text } from "@react-email/components";
import type { MailLang } from "../lib/i18n/mailLang";
import { DIGEST_CONFIRM_TEXT } from "./i18n/confirm";
import { EmailButton, EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface DigestConfirmProps {
  /** Absolute, purpose-scoped confirmation URL. */
  confirmUrl: string;
  /** The reader’s language. English when not given. */
  lang?: MailLang;
}

export function DigestConfirm({ confirmUrl, lang = "en" }: DigestConfirmProps) {
  const t = DIGEST_CONFIRM_TEXT[lang];
  return (
    <EmailLayout
      lang={lang}
      previewText={t.preview}
      hideSettingsLink
      footerText={t.footer}
    >
      <Section style={styles.stamp}>
        <Text className="em-text-secondary" style={styles.stampEyebrow}>{t.eyebrow}</Text>
        <Text className="em-text" style={styles.stampValue}>{t.what}</Text>
      </Section>

      <Text className="em-text-body" style={styles.body}>
        {t.body}
      </Text>

      <Section style={styles.cta}>
        <EmailButton href={confirmUrl} variant="primary">
          {t.button}
        </EmailButton>
      </Section>

      <Text className="em-text-secondary" style={styles.note}>
        {t.ignore}
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
