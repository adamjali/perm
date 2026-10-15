/**
 * EmailHeader Component
 * Section header component for email templates.
 *
 * Features:
 * - Bold styling matching neobrutalist design
 * - Urgency color bars
 * - Dark mode via CSS classes
 */

import { Section, Text } from "@react-email/components";

export interface EmailHeaderProps {
  /** Header title text */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Urgency level for color bar */
  urgency?: "normal" | "high" | "urgent" | "overdue";
}

/**
 * Section header with optional urgency indicator.
 * Use at the top of email content sections.
 */
export function EmailHeader({
  title,
  subtitle,
  urgency = "normal",
}: EmailHeaderProps) {
  const urgencyBarStyle = {
    ...styles.urgencyBar,
    backgroundColor: urgencyColors[urgency],
  };

  return (
    <Section style={styles.container}>
      {/* Urgency color bar */}
      <div className="em-banner" style={urgencyBarStyle} />

      {/* Title row — table layout for reliable rendering across email clients (flex is unsupported in Outlook) */}
      <table width="100%" cellPadding="0" cellSpacing="0" role="presentation">
        <tbody>
          <tr>
            <td style={styles.titleCell}>
              <Text className="em-text" style={styles.title}>{title}</Text>
              {subtitle && <Text className="em-text-secondary" style={styles.subtitle}>{subtitle}</Text>}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

/**
 * Urgency color mapping.
 */
const urgencyColors = {
  normal: "#3b82f6", // Blue
  high: "#C2410C", // Orange
  urgent: "#dc2626", // Red
  overdue: "#991b1b", // Dark red
} as const;

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  container: {
    marginBottom: "24px",
  },
  urgencyBar: {
    height: "4px",
    width: "100%",
    marginBottom: "16px",
  },
  titleCell: {
    verticalAlign: "top" as const,
  },
  title: {
    color: "#18181b",
    fontSize: "22px",
    fontWeight: "700" as const,
    lineHeight: "28px",
    margin: "0 0 4px 0",
  },
  subtitle: {
    color: "#71717a",
    fontSize: "14px",
    fontWeight: "400" as const,
    lineHeight: "20px",
    margin: "0",
  },
} as const;
