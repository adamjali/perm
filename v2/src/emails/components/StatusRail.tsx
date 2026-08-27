/**
 * StatusRail: the one thing a status-change email exists to say.
 *
 * ## Why this is not QueueStamp
 *
 * `QueueStamp` is the "one figure" idiom and its own docstring says one per
 * email, never two. A transition is not one figure, it is two states of which
 * only one still exists. Rendering it as two equal stamps would say they are
 * equally weighty, and they are not: the old status is context, the new one is
 * the news. Its prop is also literally named `month`, and a month is 14
 * characters where `DENIED - BALCA DISMISSED` is 24, so its `nowrap` pin would
 * have to come out anyway.
 *
 * ## The rail
 *
 * One ink rule down the left with two stops on it, old above and new below. A
 * status change IS a segment of a timeline, so the device encodes the content
 * rather than decorating it, and the reading order is the chronological order
 * with no arrow glyph needed. That matters in this medium: `→` is a font
 * dependency, and `StatusChange.tsx` ships one that renders as a box in clients
 * without it. A `border-left` on a table cell renders everywhere including
 * Outlook's Word engine.
 *
 * ## Two tones, and the refusal to use red
 *
 * The new-status block takes one of two treatments, chosen by a single fact
 * from the data rather than by an opinion about the status:
 *
 * - **lime fill, ink label** when the case is still live, or ended CERTIFIED.
 *   It is still moving, or it landed.
 * - **paper fill, 3px ink border, no fill colour** for every other final
 *   status: denied, withdrawn, expired.
 *
 * Bad news is not red here and that is deliberate. Every transactional email in
 * the world paints a bad outcome red, and for someone who has waited fourteen
 * months an alarm colour adds no information to a fact they can already read.
 * The ABSENCE of the fill is the signal, and it survives an inverting client,
 * which a red fill with a light label does not.
 *
 * The two treatments differ in fill, not in opacity. Two states that differ
 * only in opacity end up sharing one caption and meaning opposite things, which
 * this codebase has already shipped once on the priority-date chart.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";
import { MONO_STACK, SANS_STACK } from "./QueueStamp";

export interface StatusRailProps {
  /** The status the case has left, already display-cased. */
  fromStatus: string;
  /** The status the case is in now, already display-cased. */
  toStatus: string;
  /**
   * Whether the new status still leaves the case somewhere to go.
   *
   * Drives the fill. Comes straight from `is_final` in the mirror plus the
   * single word CERTIFIED, never from a judgement about the status text.
   */
  tone: "live" | "closed";
}

export function StatusRail({ fromStatus, toStatus, tone }: StatusRailProps) {
  const isLive = tone === "live";
  return (
    <Section style={styles.wrap}>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td className="cs-rail" style={styles.rail}>
              <Text className="em-text-secondary" style={styles.eyebrow}>
                Was
              </Text>
              <Text className="em-text-secondary" style={styles.was}>
                {fromStatus}
              </Text>

              <Text className="em-text-secondary" style={styles.eyebrowNow}>
                Now
              </Text>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                border={0}
                style={styles.blockTable}
              >
                <tbody>
                  <tr>
                    <td
                      className={isLive ? "cs-block-live" : "cs-block-closed"}
                      style={isLive ? styles.blockLive : styles.blockClosed}
                    >
                      <div className="cs-block-value" style={styles.blockValue}>
                        {toStatus}
                      </div>
                    </td>
                    {/*
                      Absorbs the remaining width so the block shrinks to its
                      own content instead of stretching into a highlight bar.
                      Same device as QueueStamp's spacer, and for the same
                      reason: a stamp is an object with edges.
                    */}
                    <td style={styles.spacer}>&nbsp;</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

const styles = {
  wrap: {
    marginBottom: "32px",
  },
  rail: {
    borderLeft: "3px solid #000001",
    paddingLeft: "20px",
  },
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    margin: "0 0 6px 0",
  },
  eyebrowNow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    // The gap between the two stops. Wide enough to read as two moments on one
    // line rather than a two-line label.
    margin: "26px 0 8px 0",
  },
  was: {
    fontFamily: MONO_STACK,
    // 6.90:1 on the card. Quieter than the block, still comfortably over the
    // body floor, because a status nobody can read is not context.
    color: "#5A5A5A",
    fontSize: "17px",
    fontWeight: 400 as const,
    lineHeight: "24px",
    margin: "0",
  },
  blockTable: {
    borderCollapse: "separate" as const,
  },
  blockLive: {
    backgroundColor: "#2ECC40",
    border: "3px solid #000001",
    boxShadow: "6px 6px 0 #000001",
    padding: "18px 24px",
  },
  blockClosed: {
    // No fill. See the docstring: the absence IS the signal, and it is the one
    // treatment that cannot be turned into a false positive by an inverting
    // client.
    backgroundColor: "#FAFAFA",
    border: "3px solid #000001",
    boxShadow: "6px 6px 0 #000001",
    padding: "18px 24px",
  },
  blockValue: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "26px",
    fontWeight: 700 as const,
    lineHeight: "32px",
    letterSpacing: "-0.01em",
    /*
     * Pinned to one line at desktop, released below 600px by EmailLayout.
     *
     * The sibling spacer at `width: 100%` squeezes this cell to its MIN-content
     * width, which is the longest single WORD. Without the pin that broke "RFI
     * ISSUED" across two lines at full desktop width, on a block with room for
     * three times the text: the block was sized by the wrong thing entirely,
     * not by a shortage of space.
     *
     * Safe here because every status fits. Measured in the worst-case fallback
     * mono (Courier New, a flat 0.6em advance), the widest string in the corpus
     * is "DENIED - BALCA DISMISSED" at 24 characters: 24 x 0.6 x 26 = 374px
     * plus 48px of padding = 422px inside the 465px the rail leaves at a 600px
     * card. The release below 600px is what handles a genuinely narrow card,
     * where the same string does NOT fit and must be allowed to break rather
     * than push the card into horizontal overflow.
     */
    whiteSpace: "nowrap" as const,
    margin: "0",
  },
  spacer: {
    width: "100%",
    paddingLeft: "10px",
    fontSize: "1px",
    lineHeight: "1px",
  },
} as const;

export default StatusRail;
