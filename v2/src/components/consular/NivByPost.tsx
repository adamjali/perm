import Link from "next/link";

import { BarRows, type BarRow } from "@/components/data/BarRows";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { PanelTabs } from "@/components/ui/panel-tabs";
import { nivClass, RANKED_CLASSES, rankPosts, type RankedClass } from "@/lib/consular/niv";
import { classesByPost, nivSummary } from "@/lib/db/nivIssuances";
import { monthName } from "@/lib/db/visaIssuances";
import { formatInt } from "@/lib/format";

/**
 * The consulates that issued the most H-1B, L-1 and K-1 fiancé(e) visas in State's newest month,
 * one switch (State's monthly nonimmigrant issuances by post). A K-1 is a nonimmigrant visa, so it's
 * here and not in State's IV Scheduling Status Tool. A post with a page on this site links to it.
 *
 * Its own file, so the consulates index carries it as one line.
 */

/** How many posts each tab lists. */
const SHOWN = 15;

const TAB_LABEL: Record<RankedClass, string> = { H1B: "H-1B", L1: "L-1", K1: "K-1 fiancé(e)" };

export async function NivByPost({ pages, className }: { pages: ReadonlyMap<string, string>; className?: string }) {
  const summary = await nivSummary();
  const month = summary?.newest;
  if (!month) return null;
  const got = await classesByPost(month, RANKED_CLASSES);
  if (!got.length) return null;
  const tabs = RANKED_CLASSES.map((cls) => {
    const ranked = rankPosts(got, cls);
    const total = summary.classByMonth?.[cls]?.[month] ?? ranked.reduce((a, r) => a + r.n, 0);
    const shown = ranked.slice(0, SHOWN);
    const rest = ranked.slice(SHOWN).reduce((a, r) => a + r.n, 0);
    const rows: BarRow[] = shown.map((r) => {
      const slug = pages.get(r.postKey);
      return {
        key: r.postKey,
        label: slug ? (
          <Link href={`/consular-posts/${slug}`} className="link">
            {r.post}
          </Link>
        ) : (
          r.post
        ),
        value: r.n,
        text: formatInt(r.n),
        tone: cls === "K1" ? ("blue" as const) : ("primary" as const),
        tip: `${r.post}\n${formatInt(r.n)} ${TAB_LABEL[cls]} visas, ${monthName(month)}`,
      };
    });
    if (rest > 0) {
      rows.push({
        key: "rest",
        label: `Every other post (${formatInt(ranked.length - shown.length)} more)`,
        value: rest,
        text: formatInt(rest),
        tone: "yellow",
      });
    }
    return {
      id: `niv-${cls.toLowerCase()}`,
      label: TAB_LABEL[cls],
      panel: rows.length ? (
        <>
          <p className="mb-4 text-base text-muted-foreground">
            {formatInt(total)} {TAB_LABEL[cls]} visas worldwide in {monthName(month)}: {nivClass(cls).what}
            {cls === "K1" ? " of a U.S. citizen" : ""}.
          </p>{" "}
          <BarRows inline rows={rows} label={`${TAB_LABEL[cls]} visas issued by consulate, ${monthName(month)}`} />
        </>
      ) : (
        <p className="text-base text-muted-foreground">State&apos;s table shows no {TAB_LABEL[cls]} visas issued in {monthName(month)}.</p>
      ),
    };
  });
  return (
    <FigurePlate
      title="H-1B, L-1 and K-1 visas issued, by consulate"
      subject={monthName(month)}
      caption="Pick a visa. Each bar is one consulate's count in State's newest monthly table; the H-4 and L-2 visas of the families who come along are counted apart. A K-1 fiancé(e) visa is a nonimmigrant visa, so State's scheduling tool above doesn't list it, and this table does."
      source="U.S. Department of State, monthly nonimmigrant visa issuances by post"
      className={className}
    >
      <PanelTabs label="Visa" tabs={tabs} />
    </FigurePlate>
  );
}
