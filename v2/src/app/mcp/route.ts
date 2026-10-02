import { createMcpHandler } from "@modelcontextprotocol/server";

import { authenticate } from "@/lib/api/auth";
import { buildMcpServer, callerFromAuthInfo } from "@/lib/api/mcp";

export const dynamic = "force-dynamic";

/**
 * permtracker.app/mcp: the Model Context Protocol endpoint, stateless (each
 * request is answered by a fresh server from one factory, so either copy of
 * the site can answer any request). See src/lib/api/mcp.ts for the tools.
 */
const handler = createMcpHandler(({ authInfo }) => buildMcpServer(callerFromAuthInfo(authInfo)), {
  responseMode: "json",
  maxRequestBodySize: 256 * 1024,
  // A notification stream holds a connection open; nothing here ever changes
  // mid-session, so a few per copy is plenty (nginx caps /mcp at 48 at once).
  maxSubscriptions: 8,
  onerror: (err) => console.error("[mcp]", err.message),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, X-API-Key, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
};

function withHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  out.headers.set("Cache-Control", "no-store");
  out.headers.set("X-Robots-Tag", "noindex");
  return out;
}

async function serve(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth.ok) {
    // A key that's wrong is refused outright rather than quietly treated as
    // no key, so its owner finds out.
    return withHeaders(
      new Response(JSON.stringify({ error: { code: auth.code, message: auth.message } }), {
        status: auth.code === "key_check_failed" ? 503 : 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="invalid_token", error_description="${auth.message.replace(/"/g, "'")}"`,
        },
      }),
    );
  }
  const authInfo =
    auth.caller.kind === "key"
      ? { token: auth.caller.keyId, clientId: auth.caller.keyId, scopes: [], extra: { caller: auth.caller } }
      : undefined;
  return withHeaders(await handler.fetch(request, { authInfo }));
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } });
}
