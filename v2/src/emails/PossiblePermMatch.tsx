/**
 * "A PERM application that may be yours": after DOL issued the wage on a PERM
 * job's prevailing wage request someone watches, DOL's record shows a PERM
 * application from the same employer for the same job title, filed since.
 *
 * DOL's record names neither the worker nor which wage request a PERM uses, so
 * this is worded as a possibility from the subject line down, and it says
 * what was compared. Never "your PERM was filed". The match rules are in
 * convex/lib/pipelineMatch.ts; the sender is convex/pipelineMatches.ts.
 *
 * @module
 */

import { Link, Section, Text } from "@react-email/components";
import { EmailButton, EmailLayout } from "./components";
import { MONO_STACK, SANS_STACK } from "./components/QueueStamp";

export interface PossiblePermMatchProps {
  /** The wage request being watched, "P-100-...". */
  pwdCaseNumber: string;
  employerName: string;
  jobTitle: string;
  /** "October 2, 2026": the day DOL's record showed the wage issued. */
  issuedOn: string;
  candidates: readonly {
    caseNumber: string;
    employerName: string;
    jobTitle: string;
    /** "October 14, 2026". */
    filedOn: string;
    /** The case's page on permtracker.app. */
    caseUrl: string;
    /** The same page, at its alert form. */
    watchUrl: string;
  }[];
  unsubscribeUrl: string;
  prefsUrl?: string;
}

export function PossiblePermMatch({
  pwdCaseNumber,
  employerName,
  jobTitle,
  issuedOn,
  candidates,
  unsubscribeUrl,
  prefsUrl,
}: PossiblePermMatchProps) {
  const one = candidates.length === 1;
  return (
    <EmailLayout
      previewText={`${employerName} filed ${one ? "a PERM application" : `${candidates.length} PERM applications`} for ${jobTitle} after your wage was issued.`}
      hideSettingsLink={!prefsUrl}
      settingsUrl={prefsUrl}
      settingsLabel="Email preferences"
      footerText={`You're watching ${pwdCaseNumber}. After DOL issues a PERM job's wage, we look for the PERM application that follows it, tell you about three at most, and stop if the employer files more than three for this job title.`}
      footerExtra={
        <Text className="em-text-secondary" style={styles.footerExtra}>
          <Link href={unsubscribeUrl} className="em-link" style={styles.footerLink}>
            Stop these alerts
          </Link>
        </Text>
      }
    >
      <Section style={styles.identity}>
        <Text className="em-text-secondary" style={styles.eyebrow}>
          {one ? "A PERM application that may be yours" : "PERM applications that may be yours"}
        </Text>
        <Text className="em-text-body" style={styles.lead}>
          {`DOL issued the prevailing wage for ${pwdCaseNumber} on ${issuedOn}. Since then, ${employerName} has filed ${
            one ? "a PERM application" : `${candidates.length} PERM applications`
          } for the same job title.`}
        </Text>
      </Section>

      {candidates.map((c) => (
        <Section key={c.caseNumber} style={styles.card}>
          <Text className="em-text" style={styles.caseNumber}>
            {c.caseNumber}
          </Text>
          <Text className="em-text-secondary" style={styles.detail}>
            {`${c.employerName}, ${c.jobTitle}`}
          </Text>
          <Text className="em-text-secondary" style={styles.detail}>
            {`Filed ${c.filedOn}`}
          </Text>
          <Section style={styles.buttons}>
            <EmailButton href={c.caseUrl} variant="primary">
              Open this case
            </EmailButton>
            <Text style={styles.watchRow}>
              <Link href={c.watchUrl} className="em-link-strong" style={styles.watchLink}>
                Watch this case
              </Link>
            </Text>
          </Section>
        </Section>
      ))}

      <Text className="em-text-body" style={styles.body}>
        {`DOL's record doesn't name the worker or say which wage request a PERM uses, so we can't tell whether ${
          one ? "this one is" : "one of these is"
        } yours. What matches is the employer, the job title (${jobTitle}) and a filing date after your wage. Your employer or attorney can confirm the case number.`}
      </Text>
      <Text className="em-text-secondary" style={styles.caveat}>
        Watching a case starts its own alerts, and asks you to confirm by email first.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  identity: { marginBottom: "20px" },
  eyebrow: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    fontWeight: 700 as const,
    margin: "0 0 8px 0",
  },
  lead: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "17px",
    lineHeight: "26px",
    margin: "0",
  },
  card: {
    border: "2px solid #000001",
    padding: "16px 18px",
    marginBottom: "14px",
  },
  caseNumber: {
    fontFamily: MONO_STACK,
    color: "#000001",
    fontSize: "16px",
    fontWeight: 700 as const,
    letterSpacing: "0.02em",
    lineHeight: "22px",
    margin: "0",
  },
  detail: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "20px",
    margin: "4px 0 0 0",
  },
  buttons: { marginTop: "14px" },
  watchRow: { margin: "4px 0 0 0" },
  watchLink: {
    fontFamily: SANS_STACK,
    color: "#1A1A1A",
    fontSize: "15px",
    fontWeight: 600 as const,
    textDecorationLine: "underline" as const,
    display: "inline-block",
    padding: "12px 0",
    lineHeight: "20px",
  },
  body: {
    fontFamily: SANS_STACK,
    color: "#2A2A2A",
    fontSize: "15px",
    lineHeight: "24px",
    margin: "12px 0 8px 0",
  },
  caveat: {
    fontFamily: SANS_STACK,
    color: "#5A5A5A",
    fontSize: "14px",
    lineHeight: "21px",
    margin: "0 0 4px 0",
  },
  footerExtra: {
    color: "#5F5F67",
    fontSize: "14px",
    lineHeight: "18px",
    margin: "0 0 12px 0",
  },
  footerLink: {
    color: "#5F5F67",
    textDecoration: "underline",
    display: "inline-block",
    padding: "13px 4px",
  },
} as const;

PossiblePermMatch.PreviewProps = {
  pwdCaseNumber: "P-100-26118-846661",
  employerName: "Example Systems, Inc.",
  jobTitle: "IT Project Manager Lead",
  issuedOn: "September 2, 2026",
  candidates: [
    {
      caseNumber: "G-100-26286-296040",
      employerName: "Example Systems, Inc.",
      jobTitle: "IT Project Manager Lead",
      filedOn: "October 13, 2026",
      caseUrl: "https://permtracker.app/perm-case-status?case=G-100-26286-296040",
      watchUrl: "https://permtracker.app/perm-case-status?case=G-100-26286-296040#watch",
    },
  ],
  unsubscribeUrl: "https://permtracker.app/case-alert/unsubscribe?token=abc",
} satisfies PossiblePermMatchProps;

export default PossiblePermMatch;
