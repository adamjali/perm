/**
 * The weekly bulletin digest, HTML part.
 *
 * Rendered from the same DigestData the plain-text part is composed from
 * (convex/lib/newsletterCompose.ts), section for section, so the two never
 * disagree. Facts with their dates; a section with nothing to say is left
 * out. The footer link is the preference center, purpose-scoped per
 * recipient, which is OFF-only by design.
 *
 * ## Shape (2026-09-16)
 *
 * - **The recipient's case first**, when they watch one. It is the only line
 *   in the email that is theirs, so it goes above everything that is
 *   everyone's. The stored issue never carries it; `sendBatch` adds it per
 *   recipient.
 * - **One figure per fact.** The frontier month is the signature stamp
 *   (`QueueStamp`, lime, one per email), the bulletin's three counts stand as
 *   three numbers with their labels under them, and the queue's two counts sit
 *   in a `FigureTable` with their provenance line. All tables, all inline
 *   styles: no images, no flex, no grid, nothing an email client drops.
 * - **Two doors at the foot**, the same pair as the homepage: check a case,
 *   or start tracking a caseload. A reader who came for the numbers leaves
 *   with the one thing to do next.
 */
import { Link, Section, Text } from "@react-email/components";

import type { DigestData } from "../../convex/lib/newsletterCompose";
import { CHECK_CASE_URL, dateLabel, monthLabel, monthsLabel, SIGNUP_URL, uscisIsNews } from "../../convex/lib/newsletterCompose";
import { EmailButton, EmailLayout, FigureTable, MONO_STACK, QueueStamp, SANS_STACK } from "./components";

const int = (n: number) => n.toLocaleString("en-US");

export function BulletinWeekly(d: DigestData) {
  const site = "https://permtracker.app";
  const queueRows = [
    ...(d.averageDays !== null ? [{ label: "Average days to a determination", value: int(d.averageDays) }] : []),
    ...(d.pendingCases !== null ? [{ label: "Pending PERM cases in the live record", value: int(d.pendingCases) }] : []),
  ];
  return (
    <EmailLayout
      previewText={`The week of ${dateLabel(d.weekOf)} in PERM and the visa bulletin.`}
      settingsUrl={d.prefsUrl ?? `${site}/email-preferences`}
      settingsLabel="Email preferences"
      footerText="You asked for this digest on an alert form and confirmed it. Every figure is DOL's, USCIS's, the State Department's or the Federal Register's, dated as they published it."
    >
      {d.watchedCase ? (
        <Section style={styles.yours}>
          <Text className="em-text-secondary" style={styles.eyebrow}>
            Your case
          </Text>
          <Text className="em-text" style={styles.caseNumber}>
            {d.watchedCase.caseNumber}
          </Text>
          <Text className="em-text-body" style={styles.p}>
            {d.watchedCase.status
              ? `Status when we last checked it for you: ${d.watchedCase.status}.`
              : "We haven't recorded a status for it yet."}
          </Text>
          <EmailButton href={d.watchedCase.url} variant="outline">
            Check it live
          </EmailButton>
        </Section>
      ) : null}

      <Text className="em-text-body" style={styles.p}>
        The week of {dateLabel(d.weekOf)}, from the record.
      </Text>

      {d.frontierMonth || queueRows.length > 0 ? (
        <Section>
          <Text className="em-text-secondary" style={styles.eyebrow}>
            DOL&apos;s queue
          </Text>
          {d.frontierMonth ? (
            <QueueStamp eyebrow="Analyst review is deciding cases filed in" month={monthLabel(d.frontierMonth)}>
              {d.dolAsOf ? `DOL's own stamp: ${dateLabel(d.dolAsOf)}.` : null}
            </QueueStamp>
          ) : null}
          {queueRows.length > 0 ? (
            <FigureTable
              heading="The queue in numbers"
              rows={queueRows}
              provenance={
                d.dolAsOf
                  ? `DOL's processing-times page as of ${dateLabel(d.dolAsOf)}; the live record as of the week of ${dateLabel(d.weekOf)}.`
                  : `The live record as of the week of ${dateLabel(d.weekOf)}.`
              }
            />
          ) : null}
          <Text className="em-text-secondary" style={styles.small}>
            <Link href={`${site}/perm-processing-times`} style={styles.link}>
              Processing times
            </Link>
          </Text>
        </Section>
      ) : null}

      {d.bulletinMonth && d.bulletinMoves ? (
        <Section>
          <Text className="em-text-secondary" style={styles.eyebrow}>
            The {monthLabel(d.bulletinMonth)} visa bulletin
          </Text>
          {d.bulletinRepeat ? (
            <Text className="em-text-secondary" style={styles.small}>
              Same bulletin as last week&apos;s issue; nothing has moved since. The next one is normally out mid-month.{" "}
              <Link href={`${site}/visa-bulletin/${d.bulletinMonth}`} style={styles.link}>
                Every cutoff
              </Link>
            </Text>
          ) : (
          <>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={styles.figures}>
            <tbody>
              <tr>
                <td className="em-stat-cell" style={styles.figureCell}>
                  <Text className="em-stat-number" style={styles.figureValue}>
                    {d.bulletinMoves.advanced}
                  </Text>
                  <Text className="em-text-secondary" style={styles.figureLabel}>
                    advanced
                  </Text>
                </td>
                <td className="em-stat-cell" style={styles.figureCell}>
                  <Text className="em-stat-number" style={styles.figureValue}>
                    {d.bulletinMoves.held}
                  </Text>
                  <Text className="em-text-secondary" style={styles.figureLabel}>
                    unchanged
                  </Text>
                </td>
                <td className="em-stat-cell" style={styles.figureCellLast}>
                  <Text className="em-stat-number" style={styles.figureValue}>
                    {d.bulletinMoves.retrogressed}
                  </Text>
                  <Text className="em-text-secondary" style={styles.figureLabel}>
                    went backwards
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
          <Text className="em-text-secondary" style={styles.small}>
            Final action dates, of {d.bulletinMoves.total} category and country cells, against the bulletin before it.{" "}
            <Link href={`${site}/visa-bulletin/${d.bulletinMonth}`} style={styles.link}>
              Every cutoff and what moved
            </Link>
          </Text>
          </>
          )}
        </Section>
      ) : null}

      {uscisIsNews(d) ? (
        <Section>
          <Text className="em-text-secondary" style={styles.eyebrow}>
            USCIS&apos;s quarterly medians, {d.uscisQuarter}
          </Text>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0} style={styles.figures}>
            <tbody>
              <tr>
                {(d.uscisMedians ?? []).map((m, i, arr) => (
                  <td key={m.form} className="em-stat-cell" style={i === arr.length - 1 ? styles.figureCellLast : styles.figureCell}>
                    <Text className="em-stat-number" style={styles.figureValue}>
                      {monthsLabel(m.medianMonths)}
                    </Text>
                    <Text className="em-text-secondary" style={styles.figureLabel}>
                      {`${m.label}, months`}
                    </Text>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <Text className="em-text-secondary" style={styles.small}>
            Median months to a decision in the quarter, from USCIS&apos;s own workbook. The 80% figure on USCIS&apos;s processing-times page is a different measure.{" "}
            <Link href={`${site}/uscis-processing-times`} style={styles.link}>
              Every form
            </Link>
          </Text>
        </Section>
      ) : null}
      {d.notices.length > 0 ? (
        <Section>
          <Text className="em-text-secondary" style={styles.eyebrow}>
            On the record this week
          </Text>
          {d.notices.map((n) => (
            <Text key={n.url} className="em-text-body" style={styles.p}>
              {dateLabel(n.publicationDate)}, {n.type}:{" "}
              <Link href={n.url} style={styles.link}>
                {n.title}
              </Link>
            </Text>
          ))}
          <Text className="em-text-secondary" style={styles.small}>
            <Link href={`${site}/policy-changes`} style={styles.link}>
              All notices
            </Link>
          </Text>
        </Section>
      ) : null}

      <Section style={styles.doors}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
          <tbody>
            <tr>
              <td style={styles.door}>
                <EmailButton href={CHECK_CASE_URL} variant="primary">
                  Check a case
                </EmailButton>
                <Text className="em-text-secondary" style={styles.doorNote}>
                  Any PERM, wage-request or LCA number, live from DOL.
                </Text>
              </td>
              <td style={styles.doorLast}>
                <EmailButton href={SIGNUP_URL} variant="outline">
                  Start tracking cases
                </EmailButton>
                <Text className="em-text-secondary" style={styles.doorNote}>
                  Free case management for attorneys, paralegals and HR teams.
                </Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Text className="em-text-secondary" style={styles.small}>
        Nothing above is predicted.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    fontWeight: 700 as const,
    lineHeight: "20px",
    margin: "28px 0 8px",
  },
  p: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0 0 10px",
  },
  small: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "8px 0 0",
  },
  link: {
    color: "#000001",
    fontWeight: 700 as const,
    textDecoration: "underline",
  },
  // The recipient's own block: a hard-edged card, ink border, no fill.
  yours: {
    border: "2px solid #000001",
    padding: "16px 18px 18px",
    margin: "0 0 24px",
  },
  caseNumber: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "22px",
    fontWeight: 700 as const,
    lineHeight: "28px",
    margin: "0 0 6px",
  },
  figures: {
    borderCollapse: "collapse" as const,
    margin: "0 0 10px",
  },
  figureCell: {
    border: "2px solid #000001",
    borderRight: "none",
    padding: "14px 10px 12px",
    textAlign: "center" as const,
    verticalAlign: "top" as const,
    width: "33%",
  },
  figureCellLast: {
    border: "2px solid #000001",
    padding: "14px 10px 12px",
    textAlign: "center" as const,
    verticalAlign: "top" as const,
    width: "34%",
  },
  figureValue: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "30px",
    fontWeight: 800 as const,
    lineHeight: "34px",
    margin: "0 0 4px",
  },
  figureLabel: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "14px",
    fontWeight: 600 as const,
    lineHeight: "18px",
    margin: 0,
  },
  doors: {
    borderTop: "1px solid #D9D9D9",
    paddingTop: "24px",
    marginTop: "32px",
  },
  door: {
    paddingRight: "10px",
    verticalAlign: "top" as const,
    width: "50%",
  },
  doorLast: {
    paddingLeft: "10px",
    verticalAlign: "top" as const,
    width: "50%",
  },
  doorNote: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "8px 0 0",
  },
} as const;

export default BulletinWeekly;
