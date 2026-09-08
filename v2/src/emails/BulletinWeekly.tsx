/**
 * The weekly bulletin digest, HTML part.
 *
 * Rendered from the same DigestData the plain-text part is composed from
 * (convex/lib/newsletterCompose.ts), section for section, so the two never
 * disagree. Facts with their dates; a section with nothing to say is left
 * out. The footer link is the preference center, purpose-scoped per
 * recipient, which is OFF-only by design.
 */
import { Link, Section, Text } from "@react-email/components";

import type { DigestData } from "../../convex/lib/newsletterCompose";
import { dateLabel, monthLabel } from "../../convex/lib/newsletterCompose";
import { EmailLayout } from "./components";

const int = (n: number) => n.toLocaleString("en-US");

const styles = {
  h2: { fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase" as const, fontWeight: 700, margin: "24px 0 6px" },
  p: { fontSize: "16px", lineHeight: "24px", margin: "0 0 8px" },
  small: { fontSize: "13px", lineHeight: "20px", margin: "0 0 6px" },
  figure: { fontSize: "28px", lineHeight: "32px", fontWeight: 800, margin: "0 0 4px" },
};

export function BulletinWeekly(d: DigestData) {
  const site = "https://permtracker.app";
  return (
    <EmailLayout
      previewText={`The week of ${dateLabel(d.weekOf)} in PERM and the visa bulletin.`}
      settingsUrl={d.prefsUrl ?? `${site}/email-preferences`}
      footerText="You asked for this digest on an alert form and confirmed it. Every figure is DOL's, the State Department's or the Federal Register's, dated as they published it."
    >
      <Text style={styles.p}>The week of {dateLabel(d.weekOf)}, from the record.</Text>

      {d.frontierMonth || d.averageDays !== null || d.pendingCases !== null ? (
        <Section>
          <Text style={styles.h2}>DOL&apos;s queue</Text>
          {d.frontierMonth ? (
            <>
              <Text style={styles.figure}>{monthLabel(d.frontierMonth)}</Text>
              <Text style={styles.small}>the filing month analyst review is deciding</Text>
            </>
          ) : null}
          {d.averageDays !== null ? <Text style={styles.p}>Average to a determination: {int(d.averageDays)} days.</Text> : null}
          {d.pendingCases !== null ? <Text style={styles.p}>Pending PERM cases in the live record: {int(d.pendingCases)}.</Text> : null}
          {d.dolAsOf ? <Text style={styles.small}>DOL&apos;s own stamp: {dateLabel(d.dolAsOf)}.</Text> : null}
          <Text style={styles.small}>
            <Link href={`${site}/perm-processing-times`}>Processing times</Link>
          </Text>
        </Section>
      ) : null}

      {d.bulletinMonth && d.bulletinMoves ? (
        <Section>
          <Text style={styles.h2}>The {monthLabel(d.bulletinMonth)} visa bulletin</Text>
          <Text style={styles.p}>
            Final action dates: {d.bulletinMoves.advanced} advanced, {d.bulletinMoves.held} unchanged,{" "}
            {d.bulletinMoves.retrogressed} went backwards, of {d.bulletinMoves.total} cells.
          </Text>
          <Text style={styles.small}>
            <Link href={`${site}/visa-bulletin/${d.bulletinMonth}`}>Every cutoff and what moved</Link>
          </Text>
        </Section>
      ) : null}

      {d.notices.length > 0 ? (
        <Section>
          <Text style={styles.h2}>On the record this week</Text>
          {d.notices.map((n) => (
            <Text key={n.url} style={styles.p}>
              {dateLabel(n.publicationDate)}, {n.type}:{" "}
              <Link href={n.url}>{n.title}</Link>
            </Text>
          ))}
          <Text style={styles.small}>
            <Link href={`${site}/policy-changes`}>All notices</Link>
          </Text>
        </Section>
      ) : null}

      <Text style={styles.small}>Nothing above is predicted.</Text>
    </EmailLayout>
  );
}

export default BulletinWeekly;
