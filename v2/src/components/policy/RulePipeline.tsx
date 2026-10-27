import {
  buildTrack,
  lastMoved,
  reginfoUrl,
  ruleTitle,
  standing,
  type RuleRecord,
  type TrackState,
} from "@convex/lib/ruleSteps";
import { daysBetween } from "@convex/lib/time";

import { Badge } from "@/components/ui/badge";

import { dayLabel } from "./format";

/**
 * Rules on their way: one card per rule, with the six steps a rule takes
 * drawn as a track. On a phone the track is a checklist down the card; from
 * 768px it's one row of six segments with each step under its own segment.
 *
 * Every date is OIRA's or the Register's. A step with no date says why in
 * words (next, not yet, or before this record began), so the fill is never
 * the only thing that carries it.
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
    <ol className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6 md:gap-2 [&>*]:min-w-0" aria-label="Steps">
      {steps.map((s) => (
        <li key={s.key} className="flex items-start gap-3 md:block">
          <span
            aria-hidden="true"
            className={`mt-0.5 block size-5 shrink-0 border-2 md:mt-0 md:h-4 md:w-full ${SEGMENT[s.state]}`}
          />{" "}
          <span className="block min-w-0 md:mt-2">
            <span className="block text-sm font-semibold leading-snug">{s.label}</span>{" "}
            <span className="block font-mono text-sm text-soft">
              {s.date ? dayLabel(s.date) : NO_DATE[s.state as keyof typeof NO_DATE]}
            </span>{" "}
            {s.note ? <span className="block text-sm leading-snug text-muted-foreground">{s.note}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function RuleCard({ rule, today }: { rule: RuleRecord; today: string }) {
  const moved = lastMoved(rule);
  const thisWeek = moved !== "" && daysBetween(moved, today) <= 7;
  const links: { href: string; label: string }[] = [{ href: reginfoUrl(rule.rin), label: "OIRA's record" }];
  if (rule.piUrl && !rule.proposedPublished && !rule.finalPublished) links.push({ href: rule.piUrl, label: "The public inspection copy" });
  if (rule.proposedUrl) links.push({ href: rule.proposedUrl, label: "The proposed rule" });
  if (rule.finalUrl) links.push({ href: rule.finalUrl, label: "The final rule" });
  return (
    <li className="border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
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
    </li>
  );
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

export function RulePipeline({ rules, today }: { rules: RuleRecord[]; today: string }) {
  const ordered = orderRules(rules);
  return (
    <section className="mt-12" id="pipeline">
      <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Rules in the pipeline</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-soft">
        A rule goes to the White House for review, then on public inspection, then into the Federal Register.
        Each step below is dated from OIRA&apos;s record or the Register&apos;s.
      </p>{" "}
      {ordered.length === 0 ? (
        <p className="mt-6 border-2 border-border bg-tint p-5 text-base">
          No USCIS rule, and no immigration rule from DOL, State or DHS, is at OIRA or on public inspection today.
        </p>
      ) : (
        <ol className="mt-6 grid gap-6">
          {ordered.map((r) => (
            <RuleCard key={r.rin} rule={r} today={today} />
          ))}
        </ol>
      )}
    </section>
  );
}
