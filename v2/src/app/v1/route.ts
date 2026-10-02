import { NextResponse } from "next/server";

import { API_BASE, ENDPOINTS } from "@/lib/api/openapi";
import { DOCS_URL } from "@/lib/api/route";

export const dynamic = "force-static";

/** What's here. No key needed. */
export function GET(): NextResponse {
  return NextResponse.json(
    {
      name: "PERM Tracker API",
      docs: DOCS_URL,
      openapi: `${API_BASE}/openapi.json`,
      auth: "Authorization: Bearer <key>. Make a free key in Settings, under API keys.",
      endpoints: ENDPOINTS.map((e) => ({ path: e.path, summary: e.summary, example: `${API_BASE}${e.example}` })),
    },
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
