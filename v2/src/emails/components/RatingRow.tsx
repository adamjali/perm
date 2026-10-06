import { Section, Text } from "@react-email/components";

import { MONO_STACK, SANS_STACK } from "./QueueStamp";

/**
 * One question, five numbered boxes, each a link to the feedback page with its
 * score. Numbers in boxes render the same in every mail client; stars and faces
 * need images or emoji, which some clients block or redraw.
 *
 * A link never records anything by itself: mail scanners open every link in a
 * message, so the box opens a page with the score picked and the reader's tap
 * there records it (convex/alertRatings.ts, `/case-alert/rate`). The boxes are 44px squares, the tap
 * floor, and five of them with their gaps measure 244px, which fits the
 * narrowest content column the layout has (256px at 320 wide).
 */
export interface RatingRowProps {
  question: string;
  /** The feedback page with its token; each box appends `r=1` to `r=5`. */
  baseUrl: string;
  lowLabel?: string;
  highLabel?: string;
}

export const RATING_SCALE = [1, 2, 3, 4, 5] as const;

export function ratingHref(baseUrl: string, score: number): string {
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}r=${score}`;
}

export function RatingRow({
  question,
  baseUrl,
  lowLabel = "Not useful",
  highLabel = "Very useful",
}: RatingRowProps) {
  return (
    <Section className="em-divider" style={styles.section}>
      <Text className="em-text" style={styles.question}>
        {question}
      </Text>
      <Text className="em-text-secondary" style={styles.hint}>
        Pick a number. The page it opens sends it, with a note if you like.
      </Text>
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0} style={styles.table}>
        <tbody>
          <tr>
            {RATING_SCALE.map((n) => (
              <td key={n} style={n < 5 ? styles.cellGap : styles.cell}>
                <a
                  href={ratingHref(baseUrl, n)}
                  className="rt-box"
                  aria-label={`${n} of 5`}
                  style={styles.box}
                >
                  {n}
                </a>
              </td>
            ))}
          </tr>
          <tr>
            <td colSpan={2} className="em-text-secondary" style={styles.labelLow}>
              {lowLabel}{" "}
            </td>
            <td style={styles.cell} />
            <td colSpan={2} className="em-text-secondary" style={styles.labelHigh}>
              {highLabel}{" "}
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

const styles = {
  section: {
    borderTop: "1px solid #D9D9D9",
    paddingTop: "24px",
    marginTop: "32px",
  },
  question: {
    fontFamily: SANS_STACK,
    color: "#000001",
    fontSize: "17px",
    fontWeight: 700 as const,
    lineHeight: "24px",
    margin: "0 0 4px 0",
  },
  hint: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "0 0 14px 0",
  },
  table: {
    borderCollapse: "separate" as const,
  },
  cell: {
    padding: "0",
  },
  cellGap: {
    padding: "0 6px 0 0",
  },
  box: {
    display: "block",
    width: "40px",
    height: "40px",
    lineHeight: "40px",
    border: "2px solid #000001",
    backgroundColor: "#FAFAFA",
    color: "#000001",
    fontFamily: MONO_STACK,
    fontSize: "18px",
    fontWeight: 700 as const,
    textAlign: "center" as const,
    textDecoration: "none",
  },
  labelLow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "18px",
    paddingTop: "8px",
    textAlign: "left" as const,
  },
  labelHigh: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "18px",
    paddingTop: "8px",
    textAlign: "right" as const,
  },
} as const;
