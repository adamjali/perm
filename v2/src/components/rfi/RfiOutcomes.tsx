import { Fragment } from "react";

import type { RfiFunnel } from "@/lib/turso/rfi";

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

export function RfiOutcomes({ funnel }: { funnel: RfiFunnel }) {
  const { everIssued, resolved, certified, denied, withdrawn, stillOpen } =
    funnel;

  const outcomes: Segment[] = [
    {
      key: "certified",
      label: "Certified",
      n: certified,
      fill: "var(--data-good)",
      ink: "var(--data-good-ink)",
    },
    {
      key: "denied",
      label: "Denied",
      n: denied,
      fill: "var(--data-bad)",
      ink: "var(--data-bad-ink)",
    },
    {
      key: "withdrawn",
      label: "Withdrawn",
      n: withdrawn,
      fill: "var(--data-none)",
      ink: "var(--data-none-ink)",
    },
    {
      key: "open",
      label: "No decision yet",
      n: stillOpen,
      fill: "var(--data-warn)",
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
          />
          <div className="h-full flex-1 bg-foreground/25" />
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
            <div
              className="h-full border-r-2 border-border last:border-r-0"
              style={{ width: `${share(s.n)}%`, backgroundColor: s.fill }}
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
