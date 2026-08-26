/**
 * QueueStamp: the one figure a queue email exists to deliver.
 *
 * A lime block bearing a single month, set in the mono face at display size,
 * with its provenance, where it has any, immediately beneath it. Each queue
 * email carries exactly one stamp: lime marks the figure the email was sent to
 * deliver. (The confirmation stamp has no provenance line, because the month it
 * shows is the reader's own input rather than a published figure.)
 *
 * The confirmation also spends lime on its button, because there the click IS
 * the payload. The alert does not, because there the payload is already on the
 * page and a lime button would compete with the stamp for it. Same accent, same
 * job in both: whatever the reader is here for.
 *
 * Why mono for the month. The site sets every published figure in JetBrains
 * Mono already (`.stat-val`, `.vtl-date`, `.recruit-range-date` in
 * globals.css). Carrying that here makes the month read as a data value rather
 * than a headline, which is what it is. No email client will have JetBrains
 * Mono, so it falls back to the system mono and keeps the distinction, which is
 * the part that carries.
 *
 * ## Two colour decisions that are not stylistic
 *
 * The label on the lime block is `#000001`, not white. Measured: ink on
 * `#2ECC40` is 9.82:1, white on the same lime is 2.14:1 and fails outright. A
 * solid brand fill takes an ink label.
 *
 * The near-black is `#000001` rather than `#000000`, matching the convention
 * already used across `src/emails/`. Gmail's dark mode rewrites pure `#000000`
 * and `#ffffff`; an off-pure value is usually left alone. The `.qa-stamp` dark
 * rules in EmailLayout are the second line of defence, because an inverted
 * stamp would be white-on-lime, the 2.14:1 pairing.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";
import * as React from "react";

export interface QueueStampProps {
  /** Small tracked-caps label naming who or what the month belongs to. */
  eyebrow: string;
  /** The month itself, already formatted for display (e.g. "September 2024"). */
  month: string;
  /** Provenance lines rendered under the block, in the mono face. */
  children?: React.ReactNode;
}

/**
 * The signature block. One per email, never two.
 */
export function QueueStamp({ eyebrow, month, children }: QueueStampProps) {
  return (
    <Section style={styles.wrap}>
      <Text className="em-text-secondary" style={styles.eyebrow}>
        {eyebrow}
      </Text>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={styles.table}
      >
        <tbody>
          <tr>
            <td className="qa-stamp" style={styles.stamp}>
              <div className="qa-stamp-value" style={styles.month}>
                {month}
              </div>
            </td>
            {/*
              Absorbs the remaining width so the lime cell shrinks to its own
              content. Full-width, the block read as a highlight bar with the
              month stranded at the left end and the offset lost against the
              card edge. A stamp is an object with edges.

              A shrink-wrapped table with `align="left"` would float, and a
              float needs clearing in clients that have no idea what that means.
              A spacer cell is the same result with no float.
            */}
            <td style={styles.spacer}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
      {children}
    </Section>
  );
}

/**
 * Font stacks.
 *
 * The branded face leads and the system face catches it. No email client loads
 * a webfont reliably (Outlook ignores `@font-face` outright), so these resolve
 * to the system grotesque and the system mono in practice. Naming the branded
 * faces first costs nothing and pays off in the clients that do have them.
 */
export const MONO_STACK =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";
export const SANS_STACK =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const styles = {
  wrap: {
    // Wider than the gaps inside the block, so the provenance lines read as
    // part of the stamp rather than floating between it and what follows.
    marginBottom: "36px",
  },
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    margin: "0 0 10px 0",
  },
  table: {
    // The 6px offset shadow needs room inside the card's 32px padding, which it
    // has. Kept as a table so Outlook's Word engine sizes the fill correctly.
    borderCollapse: "separate" as const,
  },
  spacer: {
    // 10px keeps the 6px offset clear of the next column even where a client
    // collapses the cell to its content.
    width: "100%",
    paddingLeft: "10px",
    fontSize: "1px",
    lineHeight: "1px",
  },
  stamp: {
    backgroundColor: "#2ECC40",
    border: "3px solid #000001",
    // Outlook drops box-shadow and renders a solid bordered block, which is the
    // same idiom one layer flatter. Not worth VML for a decorative offset.
    boxShadow: "6px 6px 0 #000001",
    padding: "22px 24px",
  },
  month: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "34px",
    fontWeight: 700 as const,
    lineHeight: "38px",
    letterSpacing: "-0.02em",
    /*
     * A sibling cell at `width: 100%` squeezes this one to its MIN-content
     * width, which is the longest single word. Measured on the render: that
     * broke "November 2024" across two lines at full desktop width while
     * "September 2024" stayed on one, so the block changed shape depending on
     * the month. `nowrap` asks for max-content instead.
     *
     * It is safe here and only here: the widest month measures 287px in the
     * worst-case fallback face (Courier New at 34px) against 448px of card. The
     * 480px media query in EmailLayout releases it back to `normal` before the
     * card gets narrow enough for that to overflow.
     */
    whiteSpace: "nowrap" as const,
    margin: "0",
  },
} as const;

export default QueueStamp;
