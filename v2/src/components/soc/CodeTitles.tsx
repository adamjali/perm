import Link from "next/link";
import { Fragment } from "react";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { getSocCodes, titlesForCode } from "@/lib/db/socTitles";
import { formatInt, formatShare } from "@/lib/format";
import { socGroup } from "@/lib/socCode";
import { predecessorsOf } from "@/lib/socCrosswalk";
import { titleSlug } from "@/lib/socTitleKey";

/**
 * On an occupation page: the job titles employers filed under its code in DOL's files, the titles
 * O*NET gives it, and the 2010 codes it replaced, so a reader can tell whether this is their job's
 * code. Renders nothing for a code the finder's table doesn't hold.
 */
export async function CodeTitles({ code, className }: { code: string | null | undefined; className?: string }) {
  const soc = socGroup(code);
  if (!soc) return null;
  // A failed read throws, so an occupation page keeps its last good render rather than caching one without this.
  const [titles, codes] = await Promise.all([titlesForCode(soc, 12), getSocCodes()]);
  const preds = predecessorsOf(soc);
  if (!titles || (!titles.filed.length && !titles.onet.length && !preds.length)) return null;
  const pageMin = codes?.pageMin ?? Infinity;
  const rows: BarRow[] = titles.filed.map((t) => ({
    key: t.key,
    label:
      t.keyFilings >= pageMin ? (
        <Link href={`/soc-codes/${titleSlug(t.key)}`} className="link">
          {t.title}
        </Link>
      ) : (
        t.title
      ),
    sub: `${formatShare(t.share)} of this title's filings use ${soc}`,
    value: t.filings,
    text: formatInt(t.filings),
    tone: "primary",
  }));
  return (
    <section id="titles" className={className}>
      <h3 className="font-heading text-xl font-bold">The titles employers file under {soc}</h3>{" "}
      <p className="mt-1 max-w-3xl text-base text-soft">
        From DOL&apos;s PERM, wage request and H-1B files. The share says how much of each title goes to this code.
      </p>{" "}
      {rows.length ? <BarRows rows={rows} inline label={`Job titles filed under ${soc}`} className="mt-4" /> : null}{" "}
      {titles.onet.length ? (
        <p className="mt-5 max-w-3xl text-base">
          <span className="font-semibold">O*NET also calls it</span>{" "}
          {titles.onet.map((t, i) => (
            <Fragment key={t}>
              {t}
              {i < titles.onet.length - 1 ? ", " : "."}{" "}
            </Fragment>
          ))}
        </p>
      ) : null}{" "}
      {preds.length ? (
        <p className="mt-4 max-w-3xl text-base">
          <span className="font-semibold">Before 2018</span> this job was filed under{" "}
          {preds.map((p, i) => (
            <Fragment key={p.code}>
              <Link href={`/soc-codes?q=${p.code}`} className="link">
                {p.code} {p.title}
              </Link>
              {i < preds.length - 2 ? ", " : i === preds.length - 2 ? " and " : "."}{" "}
            </Fragment>
          ))}
        </p>
      ) : null}{" "}
      <p className="mt-4 text-base">
        <Link href="/soc-codes" className="link inline-flex min-h-11 items-center">
          Not sure it&apos;s your job&apos;s code? Look a title up
        </Link>
      </p>
    </section>
  );
}
