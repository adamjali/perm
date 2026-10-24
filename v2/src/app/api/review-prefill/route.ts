import { NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";

export const dynamic = "force-dynamic";

/**
 * The review form's prefill for a signed-in reader: their first name and address, from their own Convex session,
 * never from the request, so nobody can read another account's. Signed out, or any failure, answers empty and the
 * form simply starts blank; a failure is logged with its cause. Never stored anywhere: `private, no-store`.
 */
export async function GET(): Promise<NextResponse> {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const token = await convexAuthNextjsToken();
    if (!token) return NextResponse.json({}, { headers });
    const me = await fetchQuery(api.siteReviews.prefillForMe, {}, { token });
    return NextResponse.json(me ?? {}, { headers });
  } catch (error) {
    console.warn("[review-prefill] couldn't read the signed-in reader:", String(error));
    return NextResponse.json({}, { headers });
  }
}
