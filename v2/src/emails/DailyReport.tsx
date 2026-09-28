/**
 * The daily operator report, to the admin only (convex/dailyReport.ts).
 *
 * Sections needing a person come first, each with its status as a word
 * (colour alone does not survive every mail client), then everything that is
 * fine, collapsed to one line each.
 */
import { Section, Text } from "@react-email/components";
import * as React from "react";

import {
  type DailyReport as Report,
  type ReportSection,
  STATUS_RANK,
  attention,
  dayLabel,
  worstStatus,
} from "../../convex/lib/dailyReportCompose";
import { EmailHeader, EmailLayout } from "./components";

const STATUS_WORD: Record<ReportSection["status"], string> = {
  fail: "FAILING",
  warn: "WATCH",
  unknown: "UNREAD",
  off: "OFF",
  ok: "OK",
};

const STATUS_COLOR: Record<ReportSection["status"], string> = {
  fail: "#B42318",
  warn: "#9A5B00",
  unknown: "#5A5A5A",
  off: "#5A5A5A",
  ok: "#1E7B34",
};

export interface DailyReportProps {
  report: Report;
}

function SectionBlock({ s, full }: { s: ReportSection; full: boolean }) {
  return (
    <Section style={styles.section}>
      <Text style={styles.title}>
        <span style={{ ...styles.badge, color: STATUS_COLOR[s.status] }}>{STATUS_WORD[s.status]}</span>{" "}
        {s.title}
        {": "}
        <span style={styles.summary}>{s.summary}</span>
      </Text>
      {full && s.lines.length > 0 ? (
        <Text style={styles.lines}>
          {s.lines.map((l, i) => (
            <React.Fragment key={i}>
              {l}
              {i < s.lines.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ) : null}
    </Section>
  );
}

export function DailyReport({ report }: DailyReportProps) {
  const need = attention(report);
  const rest = [...report.sections]
    .filter((s) => s.status !== "fail" && s.status !== "warn")
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
  const overall = worstStatus(report.sections.map((s) => s.status));
  const headline =
    need.length === 0
      ? "Everything checked came back clean."
      : `${need.length} thing${need.length === 1 ? " needs" : "s need"} a look.`;

  return (
    <EmailLayout
      previewText={headline}
      settingsUrl="https://permtracker.app/admin#monitor"
      settingsLabel="Open the admin page"
      footerText="The daily operator report. Sent to the admin address only."
    >
      <EmailHeader
        title={`Daily report, ${dayLabel(report.day)}`}
        subtitle={headline}
        urgency={overall === "fail" ? "high" : "normal"}
      />
      {need.map((s) => (
        <SectionBlock key={s.key} s={s} full />
      ))}
      {rest.map((s) => (
        <SectionBlock key={s.key} s={s} full={s.status === "ok"} />
      ))}
    </EmailLayout>
  );
}

const styles = {
  section: { padding: "0 24px", marginBottom: "14px" },
  title: { fontSize: "15px", lineHeight: "22px", margin: "0 0 4px", fontWeight: 700 },
  badge: { fontSize: "12px", letterSpacing: "0.06em", fontWeight: 800 },
  summary: { fontWeight: 400 },
  lines: {
    fontSize: "14px",
    lineHeight: "21px",
    margin: 0,
    paddingLeft: "12px",
    borderLeft: "3px solid #D9D9D9",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
} as const;

export default DailyReport;
