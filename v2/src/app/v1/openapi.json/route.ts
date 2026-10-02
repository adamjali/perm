import { NextResponse } from "next/server";

import { openApiDocument } from "@/lib/api/openapi";

export const dynamic = "force-static";

/** The API's description. No key needed. */
export function GET(): NextResponse {
  return NextResponse.json(openApiDocument(), {
    headers: { "Access-Control-Allow-Origin": "*", "X-Robots-Tag": "noindex" },
  });
}
