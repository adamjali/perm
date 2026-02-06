/**
 * EmailHeader Component
 * Section header component for email templates.
 *
 * Features:
 * - Bold styling matching neobrutalist design
 * - Urgency color bars
 * - Icon support (emoji-based for email compatibility)
 * - Dark mode via CSS classes
 *
 * Phase: 24 (Notifications + Email)
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";

export interface EmailHeaderProps {
  /** Header title text */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Urgency level for color bar */
  urgency?: "normal" | "high" | "urgent" | "overdue";
  /** Optional emoji icon */
  icon?: string;
}

/**
 * Section header with optional urgency indicator.
 * Use at the top of email content sections.
 */
export function EmailHeader({
  title,
  subtitle,
  urgency = "normal",
  icon,
}: EmailHeaderProps) {
  const urgencyBarStyle = {
    ...styles.urgencyBar,
    backgroundColor: urgencyColors[urgency],
  };

  return (
    <Section style={styles.container}>
      {/* Urgency color bar */}
      <div className="em-banner" style={urgencyBarStyle} />

      {/* Title row */}
      <Section style={styles.titleRow}>
        {icon && <Text style={styles.icon}>{icon}</Text>}
        <div>
          <Text className="em-text" style={styles.title}>{title}</Text>
          {subtitle && <Text className="em-text-secondary" style={styles.subtitle}>{subtitle}</Text>}
        </div>
      </Section>
    </Section>
  );
}

/**
 * Urgency color mapping.
 */
const urgencyColors = {
  normal: "#3b82f6", // Blue
  high: "#f97316", // Orange
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
  titleRow: {
    display: "flex" as const,
    alignItems: "flex-start" as const,
  },
  icon: {
    fontSize: "28px",
    margin: "0 12px 0 0",
    lineHeight: "1",
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

export default EmailHeader;
