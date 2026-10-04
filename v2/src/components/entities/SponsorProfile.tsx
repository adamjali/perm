import { Fragment } from "react";

import { factSentence, partBasis, partRank, partValue, type SponsorFact, type SponsorPart } from "@/lib/sponsorProfile";

/**
 * How a sponsor compares, part by part: each figure with what it counts, and
 * a bar placing it among the sponsors with enough cases for the figure to
 * mean something. Then the facts on its record, each a sentence with a date.
 *
 * NO SINGLE SCORE. The parts measure different things (an approval rate, a
 * volume, a mix of hires), and a blend of them would read as a precision the
 * data can't support; the same reason /perm-denial-risk refuses one. Plain
 * server markup; absent when the sponsor has no part and no fact.
 */

export function SponsorProfile({
  parts,
  facts,
  className = "mt-10",
}: {
  parts: readonly SponsorPart[];
  facts: readonly SponsorFact[];
  className?: string;
}) {
  if (parts.length === 0 && facts.length === 0) return null;
  return (
    <section className={className} aria-labelledby="sponsor-profile">
      <h2 id="sponsor-profile" className="font-heading text-xl font-black sm:text-2xl">
        How it compares with other sponsors
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base text-foreground/75">
        Each figure ranked only among sponsors with enough cases for it to mean something. No single score: they
        measure different things.
      </p>
      {parts.length ? (
        <ul className="mt-4 grid max-w-4xl grid-cols-1 gap-x-8 gap-y-4 border-t-2 border-border pt-4 sm:grid-cols-2 [&>*]:min-w-0">
          {parts.map((p) => {
            const at = Math.min(100, Math.max(0, p.pct * 100));
            return (
              <Fragment key={p.id}>
                {" "}
                <li>
                  <p className="text-sm font-bold">{p.label}</p>{" "}
                  <p className="mt-0.5">
                    <span className="font-heading text-2xl font-black tabular-nums">{partValue(p)}</span>{" "}
                    <span className="text-sm text-foreground/70">{partBasis(p)}</span>
                  </p>{" "}
                  <div
                    className="relative mt-2 h-3 border-2 border-border bg-background"
                    role="img"
                    aria-label={partRank(p)}
                  >
                    <span className="absolute inset-y-0 left-0 bg-primary/40" style={{ width: `${at}%` }} aria-hidden="true" />
                    <span
                      className="absolute -top-1 h-4 w-1 -translate-x-1/2 bg-foreground"
                      style={{ left: `${at}%` }}
                      aria-hidden="true"
                    />
                  </div>{" "}
                  <p className="mt-1 text-sm text-foreground/70">{partRank(p)}</p>
                </li>
              </Fragment>
            );
          })}
        </ul>
      ) : null}{" "}
      {facts.length ? (
        <div className="mt-6 max-w-3xl border-2 border-border bg-card p-4">
          <h3 className="text-sm font-bold">Also on its record</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
            {facts.map((f, i) => (
              <Fragment key={`${f.id}-${i}`}>
                {" "}
                <li>{factSentence(f)}</li>
              </Fragment>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
