import { NextResponse } from "next/server";

import { socProfile } from "@/lib/db/socProfile";
import { isSocCode } from "@/lib/socCode";

/**
 * GET /api/soc/<code>
 *
 * One SOC code's profile (`socProfile`): O*NET's description and tasks, how employers titled the job in
 * DOL's files, and its PERM figures. The case form's code card and suggested job description read it, and so
 * can anyone: every figure is public.
 *
 * A code that isn't one is a 400 and a code nothing holds a 404, each with a sentence; a failed read is a 503
 * that says so, never "no such job". The answer moves only with the quarterly loads, so the edge may keep it
 * an hour, as it keeps /api/soc.
 */
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const raw = decodeURIComponent(code ?? "");
  if (!isSocCode(raw)) {
    return NextResponse.json({ error: "Send a SOC code such as 15-1252." }, { status: 400 });
  }
  try {
    const profile = await socProfile(raw);
    if (!profile) {
      return NextResponse.json(
        { error: `DOL's files and O*NET hold no job under ${raw}.` },
        { status: 404, headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } },
      );
    }
    return NextResponse.json(profile, { headers: { "Cache-Control": "public, max-age=0, s-maxage=3600" } });
  } catch (e) {
    console.error("[soc-profile] failed", e);
    return NextResponse.json(
      { error: "This job code couldn't be read just now. Try again in a minute." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
