import { Fragment } from "react";
import Link from "next/link";

import type { NameVariant } from "@/lib/turso/entityDetail";
import { cn } from "@/lib/utils";

/**
 * What the merge caught, and what it deliberately did not.
 *
 * DOL prints the name that went on the form. One practice therefore arrives
 * under dozens of spellings, and the entity table used to give every one of
 * them its own page and its own rank: Fragomen was six separate firms, each
 * claiming to be "#N by volume", and none of the six numbers was right.
 *
 * Identity is now decided before ranking (`scripts/entity_identity.py`), and
 * that fixes most of it. It does not fix all of it, and the residue is
 * visible on the page rather than hidden behind a footnote:
 *
 *  - The merge folds exact-token matches and a tightly scoped class of typo:
 *    a single insertion, deletion or transposition inside one long token,
 *    with the rest of the name matching exactly.
 *  - It REFUSES same-length substitutions, because that is where two real
 *    names differ. Petersen and Peterson. Markan and Martin. Curtis and
 *    Currie. Merging those would attribute one firm's approval rate to
 *    another firm, which is worse than printing two rows.
 *  - It refuses the whole rule for employers, where a company name is often
 *    one coined word and distance 1 separates NVIDIA from Vidian.
 *
 * So this module lists the entities whose printed name begins the same way
 * and lets the reader judge. Some are the same practice under a spelling the
 * rule would not touch; some are a branch office; at least one is an email
 * address somebody typed into the attorney field. Presenting them as merged
 * would be a claim. Presenting them as candidates is the truth.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function NameSpellings({
  variants,
  absorbed,
  subject,
  hrefBase,
  rank,
  className,
}: {
  variants: NameVariant[];
  /** How many spellings this entity already absorbed. */
  absorbed: number;
  /** What one of these is: "firm", "sponsor". */
  subject: string;
  hrefBase: string;
  rank: number;
  className?: string;
}) {
  if (variants.length === 0 && absorbed === 0) return null;
  const residue = variants.reduce((a, v) => a + v.total, 0);

  return (
    <section
      className={cn("border-2 border-border bg-tint-primary p-6 shadow-hard-sm sm:p-8", className)}
    >
      <h2 className="font-heading text-xl font-black">
        What this rank counts, and what it doesn&apos;t
      </h2>{" "}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
        DOL prints the name that went on the form, so one {subject} can appear
        under several.{" "}
        {absorbed > 0 ? (
          <>
            {fmt(absorbed)} other spelling{absorbed === 1 ? "" : "s"} of this
            name {absorbed === 1 ? "was" : "were"} folded into this page and{" "}
            {absorbed === 1 ? "its" : "their"} cases are counted here.{" "}
          </>
        ) : null}
        {variants.length > 0 ? (
          <>
            The {variants.length === 1 ? "entry" : `${variants.length} entries`}{" "}
            below start the same way and were <strong>not</strong> merged,
            because the difference between them is more than a mistyped letter.
            Some may be the same {subject}; some are a different one. Rank
            #{fmt(rank)} counts this page&apos;s cases only.
          </>
        ) : (
          <>Nothing else in the file starts the same way.</>
        )}
      </p>

      {variants.length > 0 ? (
        <>
          <ul className="mt-5 divide-y-2 divide-border border-t-2 border-border">
            {variants.map((v) => (
              <Fragment key={v.slug}>{" "}
                <li >
                  <Link
                    href={`${hrefBase}/${v.slug}`}
                    className={cn(
                      "flex min-h-[44px] flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5",
                      "hover:text-primary",
                    )}
                  >
                    <span className="min-w-0 flex-1 text-sm font-bold leading-snug underline decoration-primary/50 decoration-2 underline-offset-2">
                      {v.name}
                    </span>{" "}
                    <span className="font-mono text-xs tabular-nums text-foreground/70">
                      {fmt(v.total)} filing{v.total === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              </Fragment>
            ))}
          </ul>{" "}
          <p className="mt-4 text-sm leading-relaxed text-foreground/70">
            {fmt(residue)} filing{residue === 1 ? "" : "s"} sit on those pages
            rather than this one. The{" "}
            <Link
              href="/methodology"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              methodology
            </Link>{" "}
            has the rule that decides which spellings merge.
          </p>
        </>
      ) : null}
    </section>
  );
}
