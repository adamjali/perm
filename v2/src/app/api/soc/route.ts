import { NextResponse } from "next/server";

import { findSoc } from "@/lib/db/socTitles";
import { SEARCH_TEXT_MIN, SUGGEST_MAX_LENGTH } from "@/lib/search/limits";

/**
 * GET /api/soc?q=...
 *
 * The job code finder (/soc-codes and the SocPicker in every box that takes a job): a SOC code
 * read however it's typed, or a job title matched against the titles employers filed in DOL's
 * files and O*NET's, each with the codes it went under and their shares.
 *
 * A query outside 2 to 80 characters is a 400, never an empty 200; a failed read is a 503 that
 * says so, never "no such job". The answer moves only with the quarterly loads, so the edge may
 * keep it an hour.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < SEARCH_TEXT_MIN || q.length > SUGGEST_MAX_LENGTH) {
    return NextResponse.json({ error: `q must be ${SEARCH_TEXT_MIN} to ${SUGGEST_MAX_LENGTH} characters` }, { status: 400 });
  }
  try {
    const found = await findSoc(q);
    return NextResponse.json(found, { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } });
  } catch (e) {
    console.error("[soc] failed", e);
    return NextResponse.json(
      { error: "The job codes couldn't be read just now. Try again in a minute." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
