import { Fragment } from "react";

import type { BlendedRfiFunnel, RfiFunnel } from "@/lib/turso/rfi";

/**
 * What happened to the cases that already went through an RFI.
 *
 * A REAL FUNNEL, WHICH MEANS THE SECOND ROW NESTS INSIDE THE FIRST. Every
 * segment on both rows is a share of the SAME denominator, the 3,213 RFIs
 * ever issued, so the certified block is genuinely as wide as its share of the
 * whole and the two rows line up. The easy version normalises the outcome row
 * to its own 100%, which draws the denied slice five times too wide and turns
 * a funnel into two unrelated bar charts stacked up.
 *
 * FOUR OUTCOMES, FOUR COLOURS. Certified, denied and withdrawn are three
 * different endings and "no decision yet" is not an ending at all. Shading
 * them one hue at four opacities would put the difference between "you won"
 * and "you lost" in an alpha channel.
 */

interface Segment {
  key: string;
  label: string;
  n: number;
  fill: string;
  /** Text-safe variant of the same meaning. */
  ink: string;
}

export function RfiOutcomes({ funnel }: { funnel: RfiFunnel | BlendedRfiFunnel }) {
  const { everIssued, resolved, certified, denied, withdrawn, stillOpen } =
    funnel;

  const outcomes: Segment[] = [
    {
      key: "certified",
      label: "Certified",
      n: certified,
      fill: "var(--data-good-ink)",
      ink: "var(--data-good-ink)",
    },
    {
      key: "denied",
      label: "Denied",
      n: denied,
      fill: "var(--data-bad-ink)",
      ink: "var(--data-bad-ink)",
    },
    {
      key: "withdrawn",
      label: "Withdrawn",
      n: withdrawn,
      fill: "var(--data-none-ink)",
      ink: "var(--data-none-ink)",
    },
    {
      key: "open",
      label: "No decision yet",
      n: stillOpen,
      fill: "var(--data-warn-ink)",
      ink: "var(--data-warn-ink)",
    },
  ];

  const share = (n: number) => (everIssued > 0 ? (n / everIssued) * 100 : 0);
  const certifiedOfResolved =
    resolved > 0 ? (certified / resolved) * 100 : null;

  return (
    <div>
      <div className="border-2 border-border bg-card p-4 sm:p-6">
        <Row label={`${everIssued.toLocaleString()} RFIs issued`}>
          <div
            className="h-full border-r-2 border-border bg-foreground/85"
            style={{ width: `${share(resolved)}%` }}
            title={`Reached a decision: ${resolved.toLocaleString()} of ${everIssued.toLocaleString()}`}
          />
          <div
            className="h-full flex-1 bg-foreground/25"
            title={`No decision yet: ${stillOpen.toLocaleString()} of ${everIssued.toLocaleString()}`}
          />
        </Row>

        <div className="my-1 grid grid-cols-[7.5rem_1fr] gap-3">
          <div />{" "}
          <div className="relative h-3">
            {/*
              The split point, drawn where it actually falls rather than in
              the middle. Everything left of it has a final decision.
            */}
            <div
              className="absolute inset-y-0 w-[2px] bg-border"
              style={{ left: `${share(resolved)}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <Row label="How they ended">
          {outcomes.map((s) => (
            <Fragment key={s.key}>{" "}
            {/*
              HUE IS NOT THE ONLY CHANNEL, because it cannot be. Certified
              (#1D8229) and no-decision-yet (#B45309) measure 1.02:1 against
              each other: near-identical luminance, so they are separable by
              hue alone and by nothing else. Four categories cannot be spread
              across a luminance ramp without one of them landing on the page
              colour. So the bar carries proportion, the legend below carries
              the name, the count and the share for every segment, and each
              segment carries its own title.
            */}
            <div
              className="h-full border-r-2 border-border last:border-r-0"
              style={{ width: `${share(s.n)}%`, backgroundColor: s.fill }}
              title={`${s.label}: ${s.n.toLocaleString()} of ${everIssued.toLocaleString()} (${share(s.n).toFixed(1)}%)`}
            />
            </Fragment>
          ))}
        </Row>

        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {outcomes.map((s) => (
            <Fragment key={s.key}>{" "}
            <li className="flex items-baseline gap-2.5">
              <span
                className="mt-1 inline-block h-3 w-3 shrink-0 border border-border"
                style={{ backgroundColor: s.fill }}
                aria-hidden="true"
              />{" "}
              <span className="font-mono text-sm font-bold tabular-nums">
                {s.n.toLocaleString()}
              </span>{" "}
              <span className="text-sm">{s.label}</span>{" "}
              <span
                className="ml-auto font-mono text-xs tabular-nums"
                style={{ color: s.ink }}
              >
                {share(s.n).toFixed(1)}%
              </span>
            </li>
            </Fragment>
          ))}
        </ul>
      </div>

      {/*
        THE TWO DENOMINATORS, BOTH STATED, BECAUSE ONE OF THEM IS THE
        REASSURING ONE AND IT IS EASY TO QUOTE ALONE. 84% is the share of
        RESOLVED RFIs that certified. 56% is the share of ALL RFIs ever issued,
        because a third of them have no decision yet. Both are true and the
        first is only true about finished cases.
      */}
      <Provenance funnel={funnel} />

      {certifiedOfResolved !== null ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <b className="font-bold text-foreground">
            {certifiedOfResolved.toFixed(0)}% of the RFIs that reached a
            decision were certified
          </b>{" "}
          ({certified.toLocaleString()} of {resolved.toLocaleString()}). Against
          every RFI ever issued the figure is {share(certified).toFixed(0)}%,
          because {stillOpen.toLocaleString()} of them have no decision yet.
          Which number you want depends on whether you are asking how these
          usually end or how many have ended.
        </p>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
      <div className="font-mono text-[11px] font-bold uppercase leading-tight tracking-wider">
        {label}
      </div>{" "}
      <div className="flex h-9 border-2 border-border bg-secondary">
        {children}
      </div>
    </div>
  );
}

/**
 * Where the blended figure's two halves came from, and how much each weighs.
 *
 * THIS IS THE PRICE OF BLENDING. The counts above pool a frozen third-party
 * aggregate with everything we have observed since, and a pooled number that
 * a reader cannot take apart is a number they have to take on trust. So both
 * denominators are printed, with our share of the total, and the sentence
 * says plainly which half is ours.
 *
 * Renders nothing until our half is non-empty. On day one the blend IS the
 * base, and a "blended from two sources" line over a figure that is entirely
 * one source would be its own small untruth.
 */
function Provenance({ funnel }: { funnel: RfiFunnel | BlendedRfiFunnel }) {
  if (!("observed" in funnel)) return null;
  const { base, observed, observedShare } = funnel;
  if (observed.resolved <= 0) return null;
  return (
    <p className="mt-4 border-t-2 border-border pt-3 text-sm leading-relaxed text-muted-foreground">
      <b className="font-bold text-foreground">Two windows, pooled.</b>{" "}
      {base.resolved.toLocaleString()} resolved RFIs come from a third-party
      aggregate frozen at {fmtDay(base.observedAt)}, and{" "}
      {observed.resolved.toLocaleString()} more are ones we have watched resolve
      ourselves{observed.from ? ` since ${observed.from}` : null}. Our own
      observations are {observedShare.toFixed(1)}% of the combined total, and
      that share grows every day. The two windows do not overlap: the frozen
      half is never re-read, so no case is counted twice.
    </p>
  );
}

function fmtDay(ms: number): string {
  if (!ms) return "an earlier date";
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", timeZone: "UTC",
  });
}
