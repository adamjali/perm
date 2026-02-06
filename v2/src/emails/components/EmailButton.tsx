/**
 * EmailButton Component
 * CTA button component for email templates.
 *
 * Features:
 * - Black background, white text (default)
 * - Bold border (neobrutalist)
 * - Inline styles for email client compatibility
 * - Urgency variants (urgent=red, warning=orange)
 * - Dark mode via CSS class
 *
 * Phase: 24 (Notifications + Email)
 */

import { Button } from "@react-email/components";
import * as React from "react";

export interface EmailButtonProps {
  /** Button text */
  children: React.ReactNode;
  /** Link URL */
  href: string;
  /** Visual variant for urgency levels */
  variant?: "default" | "urgent" | "warning";
}

/**
 * CTA button with neobrutalist styling.
 * Use for primary actions in email templates.
 */
export function EmailButton({
  children,
  href,
  variant = "default",
}: EmailButtonProps) {
  const buttonStyle = {
    ...styles.button,
    ...(variant === "urgent" && styles.urgent),
    ...(variant === "warning" && styles.warning),
  };

  return (
    <Button href={href} className="em-button" style={buttonStyle}>
      {children}
    </Button>
  );
}

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  button: {
    backgroundColor: "#000000",
    color: "#ffffff",
    padding: "14px 28px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    border: "3px solid #000000",
    boxShadow: "4px 4px 0 #000000",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  urgent: {
    backgroundColor: "#dc2626",
    borderColor: "#000000",
  },
  warning: {
    backgroundColor: "#f97316",
    borderColor: "#000000",
  },
} as const;

export default EmailButton;
