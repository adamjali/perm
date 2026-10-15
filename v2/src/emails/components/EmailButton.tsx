/**
 * EmailButton Component
 * CTA button component for email templates.
 *
 * Features:
 * - The site's main-button lime with an ink label (default and primary)
 * - A 2px ink edge, solid fill, no offset (Outlook drops one anyway)
 * - Inline styles for email client compatibility
 * - Urgency variants (urgent=red, warning=orange)
 * - Dark mode via CSS class
 */

import { Button } from "@react-email/components";
import * as React from "react";

export interface EmailButtonProps {
  /** Button text */
  children: React.ReactNode;
  /** Link URL */
  href: string;
  /**
   * Visual variant.
   *
   * `default` and `primary` are the email's one main action, in lime;
   * `outline` is a second action beside it. They mirror the site's own button
   * variants in `src/components/ui/button.tsx`.
   */
  variant?: "default" | "primary" | "outline" | "urgent" | "warning";
}

/**
 * The email's call-to-action button.
 * Use for primary actions in email templates.
 */
export function EmailButton({
  children,
  href,
  variant = "default",
}: EmailButtonProps) {
  const buttonStyle = {
    ...styles.button,
    ...(variant === "primary" && styles.primary),
    ...(variant === "outline" && styles.outline),
    ...(variant === "urgent" && styles.urgent),
    ...(variant === "warning" && styles.warning),
  };

  // The two new variants carry ink labels on light fills, so they must opt out
  // of the dark-mode rule that repaints `.em-cta-button` / `.em-button` for a
  // dark ground. Their own classes pin the colours instead.
  const className =
    variant === "primary" || variant === "outline"
      ? `em-button em-button-${variant}`
      : "em-button";

  return (
    <Button href={href} className={className} style={buttonStyle}>
      {children}
    </Button>
  );
}

/**
 * Inline styles for email client compatibility.
 */
const styles = {
  // Unless a variant says otherwise, an email's button is its one main
  // action, in the site's main-button lime with an ink label (9.8:1).
  button: {
    backgroundColor: "#2ECC40",
    color: "#000001",
    padding: "14px 28px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    border: "2px solid #000001",
  },
  /**
   * The site's primary button: brand fill, ink label, ink offset.
   *
   * The label is ink because white on `#2ECC40` measures 2.14:1 and fails
   * outright, while ink on the same lime is 9.82:1.
   */
  primary: {
    backgroundColor: "#2ECC40",
    color: "#000001",
    borderColor: "#000001",
  },
  /** The site's outline button: paper fill, ink border and label, ink offset. */
  outline: {
    backgroundColor: "#FAFAFA",
    color: "#000001",
    borderColor: "#000001",
  },
  urgent: {
    backgroundColor: "#dc2626",
    borderColor: "#000001",
  },
  warning: {
    backgroundColor: "#C2410C",
    borderColor: "#000001",
  },
} as const;
