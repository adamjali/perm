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
  /**
   * Visual variant.
   *
   * `default` is the original black fill and is left exactly as it was, because
   * fourteen templates render it. Note that on `default` the `4px 4px 0`
   * shadow is the same colour as the fill, so it does not read as an offset. It
   * reads as a ragged edge. `primary` and `outline` were added for the queue
   * alerts and mirror the two button variants the site actually ships in
   * `src/components/ui/button.tsx`, where the shadow contrasts with the fill and
   * the device works.
   */
  variant?: "default" | "primary" | "outline" | "urgent" | "warning";
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
  button: {
    backgroundColor: "#000001",
    color: "#fffffe",
    padding: "14px 28px",
    fontSize: "14px",
    fontWeight: "700" as const,
    textDecoration: "none",
    textAlign: "center" as const,
    display: "inline-block",
    border: "3px solid #000001",
    boxShadow: "4px 4px 0 #000001",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
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
    boxShadow: "4px 4px 0 #000001",
  },
  /** The site's outline button: paper fill, ink border and label, ink offset. */
  outline: {
    backgroundColor: "#FAFAFA",
    color: "#000001",
    borderColor: "#000001",
    boxShadow: "4px 4px 0 #000001",
  },
  urgent: {
    backgroundColor: "#dc2626",
    borderColor: "#000001",
  },
  warning: {
    backgroundColor: "#f97316",
    borderColor: "#000001",
  },
} as const;

export default EmailButton;
