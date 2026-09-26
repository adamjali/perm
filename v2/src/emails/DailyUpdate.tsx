/**
 * Several alerts in one email: the day's bundle.
 *
 * Sent by `alertOutbox.sendBundles` when more than one thing an address
 * follows moved since it was last written to. Each item is one row: what kind
 * of thing it is, which one, what happened, and a link to the page with the
 * full picture. The per-kind emails carry the long context; a bundle is the
 * index into it, and says so.
 *
 * The marker on each row follows `StatusRail`'s rule: lime when something
 * landed well or is still moving, an ink outline with no fill when it closed
 * badly, grey when it is neither. Never red.
 *
 * @module
 */
import { Link, Section, Text } from "@react-email/components";
import { EmailLayout } from "./components";
import { SANS_STACK } from "./components/QueueStamp";

export interface DailyUpdateItem {
  kind: "case" | "queue" | "bulletin" | "employer";
  title: string;
  line: string;
  url: string;
  tone?: "good" | "bad" | "neutral";
}

export interface DailyUpdateProps {
  items: DailyUpdateItem[];
  /** The address's preference page (magic link, off only). */
  prefsUrl: string;
  /** One click turns every alert kind off. Pairs with List-Unsubscribe. */
  stopUrl: string;
}

const KIND_LABEL: Record<DailyUpdateItem["kind"], string> = {
  case: "Case status",
  queue: "DOL queue",
  bulletin: "Visa bulletin",
  employer: "Employer you follow",
};

export function DailyUpdate({ items, prefsUrl, stopUrl }: DailyUpdateProps) {
  const n = items.length;
  return (
    <EmailLayout
      previewText={items.map((i) => `${i.title}: ${i.line}`).join(" · ").slice(0, 140)}
      settingsUrl={prefsUrl}
      settingsLabel="Email preferences"
      footerText="One email a day at most, whatever you follow. Each row links to the full picture."
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link href={stopUrl} className="em-link" style={styles.footerLink}>
            Stop all of these alerts
          </Link>
        </Text>
      }
    >
      <Section style={styles.stamp}>
        <Text style={styles.eyebrow}>Since we last wrote</Text>
        <Text style={styles.count}>{`${n} things you follow moved`}</Text>
      </Section>

      {items.map((item, i) => {
        const tone = item.tone ?? "neutral";
        return (
          <Section key={`${item.kind}-${i}`} style={styles.item}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
              <tbody>
                <tr>
                  <td
                    className={tone === "good" ? "cs-block-live" : undefined}
                    style={tone === "good" ? styles.markGood : tone === "bad" ? styles.markBad : styles.markNeutral}
                  >
                    &nbsp;
                  </td>
                  <td style={styles.body}>
                    <Text className="em-text-secondary" style={styles.kind}>
                      {`${KIND_LABEL[item.kind]} `}
                    </Text>
                    <Text style={styles.title}>{`${item.title} `}</Text>
                    <Text className="em-text-body" style={styles.line}>
                      {`${item.line} `}
                    </Text>
                    <Link href={item.url} className="em-link" style={styles.open}>
                      {`Open ${item.title}`}
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        );
      })}

      <Text className="em-text-secondary" style={styles.note}>
        Every figure here is the Department of Labor&rsquo;s or the State
        Department&rsquo;s own published record. None of it is a prediction of
        your case.
      </Text>
    </EmailLayout>
  );
}

const MARK = { width: "8px", padding: 0 } as const;

const styles = {
  stamp: { marginBottom: "20px" },
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    margin: "0 0 4px 0",
  },
  count: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "26px",
    fontWeight: 700 as const,
    lineHeight: "32px",
    margin: 0,
  },
  item: { marginBottom: "14px" },
  markGood: { ...MARK, backgroundColor: "#2ECC40", border: "2px solid #000001" },
  markBad: { ...MARK, backgroundColor: "#FFFFFE", border: "2px solid #000001" },
  markNeutral: { ...MARK, backgroundColor: "#D4D4D8", border: "2px solid #D4D4D8" },
  body: { paddingLeft: "14px", verticalAlign: "top" as const },
  kind: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "12px",
    fontWeight: 700 as const,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    margin: "0 0 2px 0",
  },
  title: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "16px",
    fontWeight: 700 as const,
    lineHeight: "22px",
    margin: 0,
  },
  line: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "15px",
    lineHeight: "22px",
    margin: "2px 0 4px 0",
  },
  open: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "14px",
    fontWeight: 600 as const,
    textDecorationLine: "underline" as const,
  },
  note: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "13px",
    lineHeight: "20px",
    margin: "8px 0 0 0",
  },
  footerExtra: { fontSize: "13px", margin: "8px 0 0 0" },
  footerLink: { color: "#5A5A5A", textDecorationLine: "underline" as const },
} as const;
