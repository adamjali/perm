import { NextResponse } from "next/server";

import { planCaseSearch } from "@/lib/caseSearchRequest";
import { unifiedSearch } from "@/lib/turso/unifiedSearch";
import { casesToCsv } from "@/lib/caseSearchCsv";

/**
 * One search across PERM, prevailing wage requests, H-1B LCAs and H-2A and H-2B.
 *
 * A ROUTE, NOT A PAGE PARAM. Reading `searchParams` in the page would make it
 * dynamic, and every visit would then be a server render against Turso. That
 * is the cost that read 11.6 billion rows in two days in August. The page
 * stays static and the search is one JSON request.
 *
 * ## The route enforces the plan; the UI only explains it
 *
 * `filterAvailability` decides which narrowing a lead can carry, and the page
 * uses the same function to grey the controls out. But a greyed-out control is
 * a courtesy, not a control: this endpoint is public and anyone can hand-craft
 * a URL. So every filter the lead cannot serve is DROPPED here before any SQL
 * is built, and the response says which ones were dropped. Leaving that to the
 * browser is how a state-plus-wage search - measured at 44.7 seconds and a
 * 67,742-row walk - would reach production through a URL nobody typed in a
 * form.
 *
 * ## Two fields arrive as words and leave as keys
 *
 * A law firm and an occupation are searched as an EQUALITY on a slug or a SOC
 * code, because an equality is what lets the index supply the ordering: the
 * biggest firm in the corpus answers in 0.67 s that way and forces a sort over
 * 48,317 rows as a prefix range. So the typed words are resolved against
 * `perm_entities` first and the answer names which one it used, with the other
 * matches offered - DOL prints one firm under several spellings and the reader
 * has to be able to see that rather than wonder.
 *
 * ## `format=csv` is the same answer, not a bigger one
 *
 * The download runs through every guard above and the same `unifiedSearch`
 * call, so it holds at most `UNIFIED_MAX` rows (1,000, the ceiling a download
 * is held to) and costs what the JSON answer costs. A refusal is still a JSON
 * 400: a CSV of an error would open in a spreadsheet as one odd cell.
 */

export const revalidate = 0;

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;
  try {
    // Every guard, the lead and the filters it can carry: src/lib/caseSearchRequest.ts.
    const plan = await planCaseSearch(p);
    if (plan.kind === "bad") return bad(plan.message);

    if (plan.kind === "needsLead") {
      // A download of nothing is a refusal, not an empty file: a spreadsheet
      // with a header row and no cases reads as "nothing matched".
      if (plan.csv) return bad("a download needs an employer, case number, law firm, state, occupation or stage");
      // Not a 400: nothing was malformed, there is simply no column an index
      // can lead with. The page renders this as guidance, not as an error.
      return NextResponse.json({
        rows: [],
        counts: { perm: 0, pwd: 0, lca: 0, seasonal: 0 },
        truncated: false,
        capped: false,
        skipped: { live: false, published: false, because: [] },
        lead: null,
        resolved: plan.resolved,
        dropped: [],
        needsLead: true,
      });
    }

    const result = await unifiedSearch(plan.args);
    if (plan.csv) {
      return new NextResponse(casesToCsv(result.rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="permtracker-case-search.csv"`,
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
        },
      });
    }
    return NextResponse.json(
      {
        ...result,
        resolved: plan.resolved,
        dropped: plan.dropped,
        needsLead: false,
      },
      {
        // The corpus changes twice a day. A short shared cache absorbs the
        // repeat of an identical search without letting a day-old answer stand.
        headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
      },
    );
  } catch (err) {
    // Named, so a failure here is distinguishable in the logs from a miss.
    console.error("[caseSearch] failed", err);
    return NextResponse.json({ error: "search unavailable" }, { status: 503 });
  }
}
