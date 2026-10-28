import { BarRows, type BarRow } from "@/components/data/BarRows";
import type { PwdLinks } from "@/lib/db/pwdLinks";
import { formatInt, formatShareOf } from "@/lib/format";
import { monthYear } from "@convex/lib/months";

/**
 * How long after the wage determination this employer's, firm's or job's PERM cases went in,
 * and how many went in within two weeks of the quiet period's end, beside every case. The part
 * of the process the employer and its attorney control, from DOL's two files joined case by case.
 */
export function PwdToPerm({
  links,
  who,
  headingId = "pwd-to-perm-h",
  className,
}: {
  links: PwdLinks | null;
  /** The name on the entity's own bar. */
  who: string;
  headingId?: string;
  className?: string;
}) {
  const mine = links?.mine;
  const all = links?.all;
  if (!mine || !all) return null;
  const gapRow = (key: string, label: BarRow["label"], r: typeof mine, tone?: BarRow["tone"]): BarRow => ({
    key,
    label,
    sub: `half took ${formatInt(r.pwdToPerm.p25)} to ${formatInt(r.pwdToPerm.p75)} days; ${formatInt(r.linked)} cases`,
    value: r.pwdToPerm.p50,
    text: `${formatInt(r.pwdToPerm.p50)} days`,
    tone,
  });
  const quickRow = (key: string, label: BarRow["label"], q: NonNullable<typeof mine.quiet>, tone?: BarRow["tone"]): BarRow => ({
    key,
    label,
    sub: `typically ${formatInt(q.p50)} days after it ended; ${formatInt(q.n)} cases`,
    value: (q.within / q.n) * 100,
    text: formatShareOf(q.within, q.n),
    tone,
  });
  const name = <span translate="no">{who}</span>;
  const from = monthYear(mine.window.from.slice(0, 7));
  const to = monthYear(mine.window.to.slice(0, 7));
  return (
    <section aria-labelledby={headingId} className={className}>
      <h3 id={headingId} className="font-heading text-lg font-bold">
        From the wage determination to the PERM
      </h3>{" "}
      <BarRows
        label="Median days from the wage determination to the PERM's filing"
        className="mt-4 max-w-3xl"
        rows={[gapRow("mine", name, mine), gapRow("all", "Every PERM case", all, "blue")]}
      />{" "}
      {mine.quiet && all.quiet ? (
        <>
          <p className="mt-6 text-base font-semibold">Filed within two weeks of the quiet period&apos;s end</p>{" "}
          <BarRows
            label="Share filed within 14 days of the quiet period's end"
            max={100}
            className="mt-3 max-w-3xl"
            rows={[quickRow("mine", name, mine.quiet), quickRow("all", "Every PERM case", all.quiet, "blue")]}
          />
        </>
      ) : null}{" "}
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-soft">
        Decided PERM cases that name their wage request, for wage requests DOL determined from {from} to {to}, early
        enough that their PERMs have been decided
        {mine.clients !== null ? `; ${formatInt(mine.clients)} employers among them` : ""}. The quiet period ends 30 days
        after the last recruitment step, the first day a PERM may be filed.
      </p>
    </section>
  );
}
