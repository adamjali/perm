/**
 * A short group of counts, each with the population it counts over.
 *
 * ## The rule this component is built around
 *
 * Every figure on this product names its population and its as-of date. So the
 * label column is not decoration and it is not a caption: it IS the population
 * ("Pending cases filed before yours"), and the group carries one provenance
 * line naming where the numbers came from and when. A figure without those two
 * things is not shippable here, and making the component require them is
 * cheaper than remembering.
 *
 * One group means one source. Two datasets with two as-of dates need two
 * groups, because a single provenance line under mixed sources is false about
 * half of them.
 *
 * ## Two constraints borrowed from EmailLinkList
 *
 * One hairline, above the whole group. Not one under every row: a rule per row
 * is the laziest possible list and reads as a spec table.
 *
 * Values are set in the mono face and right-aligned so they form a column that
 * can be scanned without reading the labels. The site already sets every
 * published figure in mono (`.stat-val` in globals.css), so this carries the
 * same distinction: these are data, not headlines.
 *
 * @module
 */

import { Section, Text } from "@react-email/components";
import { MONO_STACK, SANS_STACK } from "./QueueStamp";

export interface FigureRow {
  /** The population this counts over. A noun phrase, not a title. */
  label: string;
  /** Already formatted for display, thousands separators included. */
  value: string;
}

export interface FigureTableProps {
  /** Tracked-caps label for the group. */
  heading: string;
  rows: readonly FigureRow[];
  /**
   * Where these numbers came from and when. Required, not optional: a group
   * without provenance is the exact defect this component exists to prevent.
   */
  provenance: string;
}

export function FigureTable({ heading, rows, provenance }: FigureTableProps) {
  return (
    <Section className="em-divider" style={styles.wrap}>
      <Text className="em-text-secondary" style={styles.heading}>
        {heading}
      </Text>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="cs-fig-label" style={styles.label}>
                {row.label}
              </td>
              <td className="cs-fig-value" style={styles.value}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Text className="em-text-secondary" style={styles.provenance}>
        {provenance}
      </Text>
    </Section>
  );
}

const styles = {
  wrap: {
    borderTop: "1px solid #D9D9D9",
    paddingTop: "24px",
    marginTop: "32px",
    marginBottom: "8px",
  },
  heading: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    margin: "0 0 12px 0",
  },
  label: {
    fontFamily: SANS_STACK,
    // 8.6:1 on the card. The label carries the population, so it is body text
    // rather than a caption and it is held to the body floor.
    color: "#2A2A2A",
    fontSize: "15px",
    lineHeight: "22px",
    paddingTop: "9px",
    paddingBottom: "9px",
    paddingRight: "16px",
    verticalAlign: "top" as const,
  },
  value: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "17px",
    fontWeight: 700 as const,
    lineHeight: "22px",
    paddingTop: "9px",
    paddingBottom: "9px",
    textAlign: "right" as const,
    verticalAlign: "top" as const,
    // A long label must never push the number onto two lines. The widest value
    // this renders is a six-digit count with separators, which is 7 characters
    // at 0.6em x 17px = 72px; 96px leaves room for a seventh digit.
    width: "96px",
    whiteSpace: "nowrap" as const,
  },
  provenance: {
    fontFamily: MONO_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "14px 0 0 0",
  },
} as const;

export default FigureTable;
