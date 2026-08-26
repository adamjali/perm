/**
 * A short group of onward links, one line each.
 *
 * The link text IS the description. "The deadlines on your side of the process"
 * rather than "Timeline calculator" plus a blurb underneath: one line instead
 * of two, and a link that still means something when a screen reader reads it
 * out of context.
 *
 * Sized for two or three items. Past about five this is the wrong component and
 * the list wants grouping or a page of its own.
 *
 * ## Two constraints this bakes in
 *
 * Rows get 13px of vertical padding against a 20px line box, so each link is a
 * 46px tap target, clear of the 44px floor. Phones are most of where these are
 * opened.
 *
 * There is one hairline, above the whole group, separating it from the prose.
 * Not one under every row: a rule per row is the laziest possible list and
 * reads as a spec table.
 *
 * @module
 */

import { Link, Section, Text } from "@react-email/components";
import { SANS_STACK } from "./QueueStamp";

export interface EmailLinkListItem {
  /** Absolute https://permtracker.app URL. Never a shortener or a redirect. */
  href: string;
  /** Self-describing link text. Not "click here", not a bare page name. */
  text: string;
}

export interface EmailLinkListProps {
  /** Tracked-caps label for the group. */
  label: string;
  items: readonly EmailLinkListItem[];
}

export function EmailLinkList({ label, items }: EmailLinkListProps) {
  return (
    <Section className="em-divider" style={styles.wrap}>
      <Text className="em-text-secondary" style={styles.label}>
        {label}
      </Text>
      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          {items.map((item) => (
            <tr key={item.href}>
              <td style={styles.row}>
                <Link
                  href={item.href}
                  className="em-link-strong"
                  style={styles.link}
                >
                  {item.text}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

const styles = {
  wrap: {
    borderTop: "1px solid #D9D9D9",
    paddingTop: "24px",
    marginTop: "32px",
  },
  label: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    lineHeight: "16px",
    margin: "0 0 6px 0",
  },
  row: {
    paddingTop: "13px",
    paddingBottom: "13px",
  },
  link: {
    fontFamily: SANS_STACK,
    color: "#000001",
    fontSize: "15px",
    fontWeight: 600 as const,
    lineHeight: "20px",
    textDecoration: "underline",
  },
} as const;

export default EmailLinkList;
