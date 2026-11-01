import { Fragment } from "react";
import Link from "next/link";
import { ProhibitIcon, ScalesIcon } from "@phosphor-icons/react/ssr";

import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { shortDate } from "@convex/lib/months";
import { actionsFor, type EnforcementAction } from "@/lib/enforcement/actions";

/**
 * What the Justice or Labor Department did to this employer, on its own page: each settlement, lawsuit or
 * suspension with its day, what it was about, the money and any bar on filing, linked to the settlements
 * page and to the agreement itself. DOL's debarment lists can't show these (a settlement's bar is a promise,
 * not a 656.31(f) notice), so without this a page would print "100% approved" beside a company barred from
 * PERM. Nothing here is a finding: a settlement is an agreement, and the words are the agreement's and
 * DOJ's. The list behind it is checked by hand (src/lib/enforcement/actions.ts).
 */

const KIND: Record<EnforcementAction["kind"], string> = {
  settlement: "Settled with the Justice Department",
  lawsuit: "Sued by the Justice Department",
  suspension: "PERM processing suspended by the Labor Department",
};
const money = (n: number) => `$${formatInt(n)}`;

export function EnforcementNotice({ slug, className = "mt-8" }: { slug: string; className?: string }) {
  const actions = actionsFor(slug);
  if (!actions.length) return null;
  const bar = actions.find((a) => a.bar?.months)?.bar;
  const barred = Boolean(bar);
  return (
    <section
      aria-label="Justice and Labor Department actions"
      className={cn("border-2 p-5", barred ? "border-data-bad-ink border-l-8 bg-card" : "border-border bg-tint", className)}
    >
      <div className="flex items-center gap-2">
        {barred ? (
          <ProhibitIcon className="size-5 shrink-0 text-data-bad-ink" aria-hidden="true" />
        ) : (
          <ScalesIcon className="size-5 shrink-0" aria-hidden="true" />
        )}
        <p className="font-heading text-lg font-bold">
          {bar?.months ? `Agreed to file no PERM for ${bar.months} months` : actions.some((a) => a.kind === "settlement") ? "Settled with the Justice Department" : KIND[actions[0]!.kind]}
        </p>
      </div>{" "}
      <ol className="mt-3 space-y-3">
        {actions.map((a) => (
          <Fragment key={a.id}>
            {" "}
            <li className="text-base leading-relaxed">
              <span className="font-semibold">{`${shortDate(a.date)}: ${KIND[a.kind]}.`}</span>{" "}
              {a.conduct}{" "}
              {a.civilPenalty ? `Civil penalty ${money(a.civilPenalty)}` : null}
              {a.civilPenalty && a.backPay ? ", " : null}
              {a.backPay ? `${a.backPayIsFund ? "a fund for workers of" : "back pay"} ${money(a.backPay)}` : null}
              {a.civilPenalty || a.backPay ? ". " : null}
              {a.sources[0] ? (
                <a href={a.sources[0].url} target="_blank" rel="noopener" className="link">
                  {a.sources[0].label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : null}
            </li>
          </Fragment>
        ))}
      </ol>{" "}
      <p className="mt-3 text-sm">
        <Link href={`/debarments/settlements#${actions[0]!.id}`} className="link inline-flex min-h-11 items-center sm:min-h-0">
          Every settlement and suspension, with DOL&apos;s record beside each
        </Link>
      </p>
    </section>
  );
}
