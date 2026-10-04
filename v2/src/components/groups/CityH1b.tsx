import { Fragment } from "react";
import Link from "next/link";

import { formatInt, formatShare } from "@/lib/format";
import type { LcaCity } from "@/lib/turso/lcaCities";

/**
 * A city's H-1B record beside its PERM one: how many LCAs name a worksite
 * there, how many DOL certified, and the employers and jobs behind the newest
 * three fiscal years. Plain server markup; absent with no record.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function CityH1b({ city, className = "mt-10" }: { city: LcaCity | null; className?: string }) {
  if (!city) return null;
  const span = city.fyFrom && city.fyTo ? `FY${city.fyFrom} to FY${city.fyTo}` : null;
  return (
    <section className={`${className} border-2 border-border bg-card p-6 shadow-hard sm:p-8`} aria-labelledby="city-h1b">
      <h2 id="city-h1b" className="font-heading text-xl font-black sm:text-2xl">
        H-1B in {city.label}
      </h2>{" "}
      <p className="mt-2 text-base leading-relaxed text-foreground/70">
        <span className="font-heading text-2xl font-black tabular-nums text-foreground">{formatInt(city.total)}</span>{" "}
        labor condition applications name a worksite here{span ? `, ${span}` : ""}, and DOL certified{" "}
        {formatInt(city.certified)}
        {city.total > 0 ? ` (${formatShare(city.certified / city.total)})` : ""}. An LCA is the employer&apos;s wage
        attestation before an H-1B petition, so it counts positions offered, not people hired.
      </p>{" "}
      <div className="mt-5 grid grid-cols-1 gap-8 sm:grid-cols-2 [&>*]:min-w-0">
        {[
          { label: "Employers", items: city.employers.map((e) => ({ key: e.slug ?? e.name, text: e.name, href: e.slug ? `/perm-employers/${e.slug}` : null, n: e.n })) },
          { label: "Jobs", items: city.occupations.map((o) => ({ key: o.code, text: o.title, href: o.slug ? `/perm-wages/${o.slug}` : null, n: o.n })) },
        ].map((col) =>
          col.items.length ? (
            <div key={col.label}>
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">
                {`${col.label}, certified LCAs${city.since ? ` since FY${city.since}` : ""}`}
              </h3>
              <ol className="mt-2 divide-y divide-border/60">
                {col.items.map((it, i) => (
                  <Fragment key={`${it.key}-${i}`}>
                    {" "}
                    <li className="flex items-baseline gap-3 py-1.5 text-base">
                      {it.href ? (
                        <Link href={it.href} className={`min-w-0 truncate ${LINK}`}>
                          {it.text}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate">{it.text}</span>
                      )}{" "}
                      <span className="ml-auto font-mono text-sm tabular-nums text-foreground/70">{formatInt(it.n)}</span>
                    </li>
                  </Fragment>
                ))}
              </ol>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}
