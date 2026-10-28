import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import {
  ACTIVE_DAYS,
  agendaDateKey,
  agendaNote,
  agendaOwner,
  buildTrack,
  isActiveRule,
  isAgendaOnly,
  lastMoved,
  reginfoUrl,
  ruleTitle,
  standing,
  type RuleRecord,
  type TrackState,
} from "@convex/lib/ruleSteps";
import { daysBetween } from "@convex/lib/time";

import { Badge } from "@/components/ui/badge";
import type { CommentCount } from "@/lib/db/policyComments";

import { dayLabel } from "./format";

/**
 * Rules on their way. A rule with something under way (at OIRA, on public
 * inspection, open for comment, taking effect, or a step in the last
 * ACTIVE_DAYS) gets a card with the seven steps a rule takes drawn as a
 * track: below 1024px a checklist down the card, from 1024px one row of seven
 * segments. The rest fold under two counts, every row still in the page: the
 * quieter rules as one-line rows, newest step first, and the rules only an
 * agency's Unified Agenda names, soonest listed date first.
 *
 * Every date is the agenda's, OIRA's or the Register's. The agenda's
 * timetable is the agency's and is quoted as the agency's ("lists ... for").
 * A step with no date says why in words (next, not yet, or before this record
 * began), so the fill is never the only thing that carries it.
 */

const SEGMENT: Record<TrackState, string> = {
  done: "border-foreground bg-primary",
  // Under way: a comment period open, an effective date ahead.
  upcoming: "border-foreground bg-primary text-foreground bg-hatch",
  next: "border-dashed border-foreground bg-card",
  ahead: "border-input bg-card",
  unrecorded: "border-input bg-card text-input bg-hatch",
};

const NO_DATE: Record<Exclude<TrackState, "done" | "upcoming">, string> = {
  next: "Next",
  ahead: "Not yet",
  unrecorded: "Not on record",
};

// Off-site links open in a new tab; each is a 44px target on its own row.
const LINK = "font-semibold link inline-flex min-h-11 items-center";

function Track({ rule, today }: { rule: RuleRecord; today: string }) {
  const steps = buildTrack(rule, today);
  return (
    <ol className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2 [&>*]:min-w-0" aria-label="Steps">
      {steps.map((s) => (
        <li key={s.key} className="flex items-start gap-3 lg:block">
          <span
            aria-hidden="true"
            className={`mt-0.5 block size-5 shrink-0 border-2 lg:mt-0 lg:h-4 lg:w-full ${SEGMENT[s.state]}`}
          />{" "}
          <span className="block min-w-0 lg:mt-2">
            <span className="block text-sm font-semibold leading-snug">{s.label}</span>{" "}
            <span className="block font-mono text-sm text-soft">
              {s.shown ?? (s.date ? dayLabel(s.date) : NO_DATE[s.state as keyof typeof NO_DATE])}
            </span>{" "}
            {s.note ? <span className="block text-sm leading-snug text-muted-foreground">{s.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "26,697 comments posted so far" while the rule is open for comment, else null. */
function postedLine(rule: RuleRecord, today: string, count: CommentCount | undefined): string | null {
  if (!count || !rule.commentsClose || rule.commentsClose < today || rule.finalPublished) return null;
  return `${count.comments.toLocaleString("en-US")} ${count.comments === 1 ? "comment" : "comments"} posted so far`;
}

/** One rule's card: a list item on the policy page, a block of its own in an article (`as="div"`). */
export function RuleCard({
  rule,
  today,
  count,
  as: Tag = "li",
}: {
  rule: RuleRecord;
  today: string;
  count?: CommentCount;
  as?: "li" | "div";
}) {
  const moved = lastMoved(rule);
  const posted = postedLine(rule, today, count);
  const thisWeek = moved !== "" && daysBetween(moved, today) <= 7;
  const links: { href: string; label: string }[] = [{ href: reginfoUrl(rule.rin), label: "OIRA's record" }];
  if (rule.aUrl) links.push({ href: rule.aUrl, label: rule.aEdition ? `The ${rule.aEdition} agenda entry` : "The agenda entry" });
  if (rule.piUrl && !rule.proposedPublished && !rule.finalPublished) links.push({ href: rule.piUrl, label: "The public inspection copy" });
  if (rule.proposedUrl) links.push({ href: rule.proposedUrl, label: "The proposed rule" });
  if (rule.finalUrl) links.push({ href: rule.finalUrl, label: "The final rule" });
  if (posted && count?.docketUrl) links.push({ href: count.docketUrl, label: "The posted comments" });
  return (
    <Tag className="border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-sm text-muted-foreground">{rule.agency ?? "Agency not named"}</span>{" "}
        <span className="font-mono text-sm text-muted-foreground">RIN {rule.rin}</span>{" "}
        {rule.major === "Yes" ? (
          <Badge variant="outline" className="border-foreground bg-chart-yellow text-black">
            Major rule
          </Badge>
        ) : null}{" "}
        {thisWeek ? (
          <Badge variant="outline" className="border-foreground bg-primary text-black">
            Moved this week
          </Badge>
        ) : null}
      </p>{" "}
      {/* Not a heading: once a rule is published its title is also a heading in
          the Register list below, and an outline with one title twice reads as a
          defect. The list of cards carries the structure. */}
      <p className="mt-3 font-heading text-xl font-bold leading-snug sm:text-2xl">{ruleTitle(rule)}</p>{" "}
      <p className="mt-2 text-base leading-relaxed">{standing(rule, today)}</p>{" "}
      {posted ? <p className="mt-1 font-mono text-sm tabular-nums text-soft">{posted}</p> : null}{" "}
      <Track rule={rule} today={today} />{" "}
      <p className="mt-4 flex flex-wrap gap-x-5">
        {links.map((l) => (
          <span key={l.href}>
            <a href={l.href} className={LINK} target="_blank" rel="noopener">
              {l.label}
            </a>{" "}
          </span>
        ))}
      </p>
    </Tag>
  );
}

/** A rule with nothing under way: who, what, and where it stands, one row. */
function QuietRow({ rule, today }: { rule: RuleRecord; today: string }) {
  const doc = rule.finalUrl
    ? { href: rule.finalUrl, label: "The final rule" }
    : rule.proposedUrl
      ? { href: rule.proposedUrl, label: "The proposed rule" }
      : null;
  return (
    <li className="border-b-2 border-border px-5 py-4 last:border-b-0 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-sm text-muted-foreground">{rule.agency ?? agendaOwner(rule.rin)}</span>{" "}
        <span className="font-mono text-sm text-muted-foreground">RIN {rule.rin}</span>
      </p>{" "}
      <p className="mt-1.5 font-heading text-lg font-bold leading-snug">{ruleTitle(rule)}</p>{" "}
      <p className="mt-1 text-base leading-relaxed">{standing(rule, today)}</p>{" "}
      <p className="flex flex-wrap gap-x-5">
        <span>
          <a href={reginfoUrl(rule.rin)} className={LINK} target="_blank" rel="noopener">
            OIRA&apos;s record
          </a>{" "}
        </span>{" "}
        {doc ? (
          <span>
            <a href={doc.href} className={LINK} target="_blank" rel="noopener">
              {doc.label}
            </a>{" "}
          </span>
        ) : null}
      </p>
    </li>
  );
}

/** A folded group: its heading and count are the summary, the rows open on demand and stay in the page. */
function Fold({ id, title, note, children }: { id: string; title: string; note: string; children: ReactNode }) {
  return (
    <details id={id} className="group mt-6 border-2 border-border bg-card shadow-hard-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-sage-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h3 className="font-heading text-xl font-bold tracking-tight sm:text-2xl">{title}</h3>{" "}
          <span className="mt-1 block text-base leading-relaxed text-soft">{note}</span>
        </span>{" "}
        <CaretDownIcon
          className="mt-1.5 h-5 w-5 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>{" "}
      <ul className="border-t-2 border-border">{children}</ul>
    </details>
  );
}

/** One rule only the agenda names: who, what, and the agency's own timetable. */
function AgendaRow({ rule }: { rule: RuleRecord }) {
  return (
    <li className="border-b-2 border-border px-5 py-4 last:border-b-0 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-sm text-muted-foreground">{rule.agency ?? agendaOwner(rule.rin)}</span>{" "}
        <span className="font-mono text-sm text-muted-foreground">RIN {rule.rin}</span>{" "}
        {rule.aPriority === "Economically Significant" ? (
          <Badge variant="outline" className="border-foreground bg-chart-yellow text-black">
            Economically significant
          </Badge>
        ) : null}
      </p>{" "}
      <p className="mt-2 font-heading text-lg font-bold leading-snug">{ruleTitle(rule)}</p>{" "}
      <p className="mt-1 text-base leading-relaxed">{agendaNote(rule)}.</p>{" "}
      {rule.aAbstract ? (
        <details className="mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold">
            The agency&apos;s description
          </summary>{" "}
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-soft">{rule.aAbstract}</p>
        </details>
      ) : null}{" "}
      {rule.aUrl ? (
        <p>
          <a href={rule.aUrl} className={LINK} target="_blank" rel="noopener">
            The agenda entry
          </a>{" "}
        </p>
      ) : null}
    </li>
  );
}

/** Rules only the agenda names, by the date the agency lists for the next step, then RIN. */
export function orderAgendaOnly(rules: RuleRecord[]): RuleRecord[] {
  return [...rules].sort((a, b) => agendaDateKey(a).localeCompare(agendaDateKey(b)) || a.rin.localeCompare(b.rin));
}

/** Rules not yet final first, each group by its newest step. */
export function orderRules(rules: RuleRecord[]): RuleRecord[] {
  return [...rules].sort(
    (a, b) =>
      Number(Boolean(a.finalPublished)) - Number(Boolean(b.finalPublished)) ||
      lastMoved(b).localeCompare(lastMoved(a)) ||
      a.rin.localeCompare(b.rin),
  );
}

export function RulePipeline({
  rules,
  today,
  comments,
}: {
  rules: RuleRecord[];
  today: string;
  /** regulations.gov's counts, by Federal Register document number. */
  comments?: ReadonlyMap<string, CommentCount>;
}) {
  const reviewed = rules.filter((r) => !isAgendaOnly(r));
  const ordered = orderRules(reviewed.filter((r) => isActiveRule(r, today)));
  const quiet = orderRules(reviewed.filter((r) => !isActiveRule(r, today)));
  const listed = orderAgendaOnly(rules.filter(isAgendaOnly));
  const editions = [...new Set(listed.map((r) => r.aEdition).filter((e): e is string => Boolean(e)))];
  return (
    <section className="mt-12" id="pipeline">
      <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Rules in the pipeline</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
        Agencies list the rules they plan in the Unified Agenda. A rule then goes to the White House for review,
        on public inspection, and into the Federal Register. Each step below is dated from those records.
      </p>{" "}
      {ordered.length === 0 ? (
        <p className="mt-6 border-2 border-border bg-tint p-5 text-base">
          No USCIS rule, and no immigration rule from DOL, State or DHS, is at OIRA or on public inspection today,
          and none is open for comment.
        </p>
      ) : (
        <ol className="mt-6 grid gap-6">
          {ordered.map((r) => (
            <RuleCard
              key={r.rin}
              rule={r}
              today={today}
              count={r.proposedDocument ? comments?.get(r.proposedDocument) : undefined}
            />
          ))}
        </ol>
      )}{" "}
      {quiet.length > 0 ? (
        <Fold
          id="quiet"
          title={`No step in the last ${ACTIVE_DAYS} days`}
          note={`${quiet.length} ${quiet.length === 1 ? "rule whose" : "rules whose"} newest recorded step is older than that, newest first.`}
        >
          {quiet.map((r) => (
            <QuietRow key={r.rin} rule={r} today={today} />
          ))}
        </Fold>
      ) : null}{" "}
      {listed.length > 0 ? (
        <Fold
          id="agenda"
          title="Listed in the agenda, not yet at OIRA"
          note={`${listed.length} ${listed.length === 1 ? "rule" : "rules"} the agencies list in their ${
            editions.length === 1 ? `${editions[0]} ` : ""
          }Unified Agenda with nothing reviewed or published yet. The dates are the agencies' own timetable, soonest first.`}
        >
          {listed.map((r) => (
            <AgendaRow key={r.rin} rule={r} />
          ))}
        </Fold>
      ) : null}
    </section>
  );
}
