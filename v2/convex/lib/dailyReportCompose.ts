/**
 * The daily operator report's shape and the few rules that turn sections into
 * a verdict. Pure, so the email, the admin page and the tests read one answer.
 *
 * `scripts/daily_monitor.py` builds the sections that live outside Convex
 * (ingest health, GitHub Actions, the site, Turso and Vercel bills, traffic,
 * Sentry); `convex/dailyReport.ts` adds the ones only Convex can see. Both
 * speak this shape, and STATUS_RANK must match RANK in the Python script.
 */

export type SectionStatus = "fail" | "warn" | "unknown" | "off" | "ok";

export interface ReportSection {
  key: string;
  title: string;
  status: SectionStatus;
  /** One line, shown beside the title. */
  summary: string;
  /** Detail, one fact per line. */
  lines: string[];
}

export interface DailyReport {
  /** YYYY-MM-DD, America/New_York: the morning the report describes. */
  day: string;
  generatedAt: number;
  sections: ReportSection[];
}

/** Worst first. "off" is a section with no credential yet; it never alarms. */
export const STATUS_RANK: Record<SectionStatus, number> = {
  fail: 4,
  warn: 3,
  unknown: 2,
  off: 1,
  ok: 0,
};

const STATUSES = Object.keys(STATUS_RANK) as SectionStatus[];

export function worstStatus(statuses: SectionStatus[]): SectionStatus {
  return statuses.reduce<SectionStatus>(
    (w, s) => (STATUS_RANK[s] > STATUS_RANK[w] ? s : w),
    "ok",
  );
}

/**
 * Read an untrusted report (it arrives as JSON from a workflow) into the
 * typed shape, dropping anything malformed rather than failing the email.
 */
export function readReport(raw: unknown): DailyReport | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return null;
  const sections = Array.isArray(r.sections) ? r.sections : [];
  return {
    day: r.day,
    generatedAt: typeof r.generatedAt === "number" ? r.generatedAt : Date.now(),
    sections: sections.flatMap((s): ReportSection[] => {
      if (!s || typeof s !== "object") return [];
      const x = s as Record<string, unknown>;
      const status = STATUSES.includes(x.status as SectionStatus)
        ? (x.status as SectionStatus)
        : "unknown";
      return [
        {
          key: String(x.key ?? "?").slice(0, 40),
          title: String(x.title ?? x.key ?? "?").slice(0, 80),
          status,
          summary: String(x.summary ?? "").slice(0, 300),
          lines: (Array.isArray(x.lines) ? x.lines : [])
            .slice(0, 30)
            .map((l) => String(l).slice(0, 400)),
        },
      ];
    }),
  };
}

/** The sections needing a person: failures and warnings, worst first. */
export function attention(report: DailyReport): ReportSection[] {
  return report.sections
    .filter((s) => s.status === "fail" || s.status === "warn")
    .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);
}

/** "Sun Sep 28" for 2026-09-28, read as a calendar date (no clock involved). */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return `${wd} ${mo} ${d}`;
}

/** The subject line: the verdict first, so the inbox preview is the answer. */
export function reportSubject(report: DailyReport): string {
  const need = attention(report);
  const failing = need.filter((s) => s.status === "fail").length;
  const verdict =
    need.length === 0
      ? "all clear"
      : failing > 0
        ? `${failing} failing${need.length > failing ? `, ${need.length - failing} to watch` : ""}`
        : `${need.length} to watch`;
  return `PERM Tracker daily, ${dayLabel(report.day)}: ${verdict}`;
}

/** The same report as plain text, for the email's text part and the routine. */
export function reportText(report: DailyReport): string {
  const out: string[] = [reportSubject(report), ""];
  const order = [...report.sections].sort(
    (a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status],
  );
  for (const s of order) {
    out.push(`[${s.status.toUpperCase()}] ${s.title}: ${s.summary}`);
    for (const l of s.lines) out.push(`    ${l}`);
  }
  return out.join("\n");
}

const DAY_MS = 86_400_000;
/** Resend's account cap, shared with every other sending path. */
export const RESEND_DAILY_CAP = 100;
/** Resend answers 401 or 403 to a send-only key asking for its log. */
export const RESEND_SEND_ONLY = "the Resend key can only send, so it cannot read the send log";

/** What `dailyReport.facts` returns: counts only, never an address. */
export interface Facts {
  users: number;
  signups24h: number;
  logins24h: number;
  subs: Array<{ kind: string; live: number; confirmed24h: number; left24h: number }>;
  errors: { count: number; top: [string, number][] };
  outbox: { sent24h: number; failed24h: number; queued: number; oldestQueuedAt: number | null };
  /** `count`: got no email at all. `queued`: a full pool held them for the queue. */
  refusals: Array<{ day: string; pool: string; count: number; queued?: number }>;
  /** Confirmations waiting in convex/confirmationQueue.ts (absent in older callers). */
  confirmationQueue?: { waiting: number; oldestQueuedAt: number | null };
  /** Failed sends waiting to retry (convex/emailLedger.ts), and yesterday's UTC-day counts. */
  retries?: { waiting: number; oldestQueuedAt: number | null; retriedYesterday: number; lostYesterday: number };
}

export interface ResendDay {
  sent: number;
  bounced: number;
  complained: number;
}

/** The sections only Convex can see. Pure given its inputs, for the test. */
/**
 * `resend` is Resend's 24-hour count, or why it could not be read. A
 * send-only key is a setting, not a fault: the section stays OK (its outbox
 * lines still show) and the line says why Resend's own count is missing.
 */
export function convexSections(f: Facts, resend: ResendDay | string, now: number): ReportSection[] {
  const subsLine = f.subs
    .map((s) => `${s.kind} ${s.live}${s.confirmed24h ? ` (+${s.confirmed24h})` : ""}${s.left24h ? ` (-${s.left24h})` : ""}`)
    .join(", ");
  const app: ReportSection = {
    key: "app",
    title: "Accounts and subscribers",
    status: "ok",
    summary: `${f.signups24h} sign-up${f.signups24h === 1 ? "" : "s"}, ${f.logins24h} signed in (24 h)`,
    lines: [`${f.users} accounts in all`, `Confirmed subscriptions: ${subsLine}`],
  };

  const emailLines: string[] = [];
  const emailStatus: ReportSection["status"][] = [];
  if (typeof resend !== "string") {
    emailLines.push(`Resend sent ${resend.sent} of the ${RESEND_DAILY_CAP} a day the account allows`);
    if (resend.sent >= RESEND_DAILY_CAP * 0.8) emailStatus.push("warn");
    if (resend.bounced || resend.complained) {
      emailLines.push(`${resend.bounced} bounced, ${resend.complained} marked as spam`);
      if (resend.complained) emailStatus.push("warn");
    }
  } else {
    emailLines.push(`Resend's log could not be read: ${resend}`);
    if (resend !== RESEND_SEND_ONLY) emailStatus.push("unknown");
  }
  emailLines.push(`Alert outbox: ${f.outbox.sent24h} sent, ${f.outbox.failed24h} failed, ${f.outbox.queued} waiting`);
  if (f.outbox.failed24h) emailStatus.push("warn");
  if (f.outbox.oldestQueuedAt && now - f.outbox.oldestQueuedAt > DAY_MS) {
    emailLines.push("Something has waited in the outbox for over a day");
    emailStatus.push("warn");
  }
  for (const r of f.refusals) {
    if (r.count > 0) {
      emailLines.push(`Budget ${r.pool} turned away ${r.count} on ${r.day} (they got no email)`);
      emailStatus.push("warn");
    }
    if (r.queued) {
      emailLines.push(`Budget ${r.pool} was full on ${r.day}; ${r.queued} waited in the queue and went out as room freed`);
    }
  }
  const rq = f.retries;
  if (rq) {
    if (rq.retriedYesterday > 0) {
      emailLines.push(`${rq.retriedYesterday} email${rq.retriedYesterday === 1 ? "" : "s"} failed to send yesterday and went to the retry queue`);
    }
    if (rq.lostYesterday > 0) {
      emailLines.push(`${rq.lostYesterday} email${rq.lostYesterday === 1 ? " was" : "s were"} given up on yesterday`);
      emailStatus.push("warn");
    }
    if (rq.waiting > 0) {
      const stale = rq.oldestQueuedAt !== null && now - rq.oldestQueuedAt > DAY_MS;
      emailLines.push(`${rq.waiting} failed email${rq.waiting === 1 ? "" : "s"} waiting to retry${stale ? ", the oldest for over a day" : ""}`);
      if (stale) emailStatus.push("warn");
    }
  }
  const cq = f.confirmationQueue;
  if (cq && cq.waiting > 0) {
    const stale = cq.oldestQueuedAt !== null && now - cq.oldestQueuedAt > DAY_MS / 2;
    emailLines.push(`${cq.waiting} confirmation${cq.waiting === 1 ? "" : "s"} waiting in the queue${stale ? ", the oldest for over 12 hours" : ""}`);
    if (stale) emailStatus.push("warn");
  }
  const email: ReportSection = {
    key: "email",
    title: "Email",
    status: worstStatus(emailStatus),
    summary: typeof resend !== "string" ? `${resend.sent} sent in 24 h` : `${f.outbox.sent24h} alert emails sent in 24 h (Resend's own count unread)`,
    lines: emailLines,
  };

  const errors: ReportSection = {
    key: "errors",
    title: "Recorded server errors",
    status: f.errors.count === 0 ? "ok" : f.errors.count > 20 ? "fail" : "warn",
    summary: f.errors.count === 0 ? "none in 24 h" : `${f.errors.count} in 24 h`,
    lines: f.errors.top.map(([op, n]) => `${op}: ${n}`),
  };
  return [app, email, errors];
}
