import { NextResponse } from "next/server";

import { one } from "@/lib/db/client";
import { liveFlagNotice } from "@/lib/flagNotice";

/**
 * DOL's current notice on FLAG, or null. Cached five minutes at the edge, so
 * a banner on every public page costs the server one read per five minutes.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const row = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = ?", ["flag_notice"]).catch(() => null);
  let doc: unknown = null;
  try {
    doc = row ? JSON.parse(row.json) : null;
  } catch {
    doc = null;
  }
  return NextResponse.json(
    { notice: liveFlagNotice(doc, Date.now()) },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
