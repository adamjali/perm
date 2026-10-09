# Signing in assistants: how to add OAuth to /mcp

Written Fri Oct 9 2026, 12:37 AM EDT. A design note, not a build: nothing here exists yet.

## What's needed and why

`/mcp` works today without a key (a shared pool) or with an API key in a header. Claude's custom
connectors can't send a header, so an assistant can't act for a signed-in person: no "my cases",
no per-account limits, no webhooks set up from a chat. MCP's answer is OAuth: the assistant sends
the person to a sign-in page, gets a token for `https://permtracker.app/mcp`, and sends it on each
call. The `cases_read` scope (and the reserved `cases_write`) is waiting for this.

## The rules it has to meet

Read from the spec itself, `modelcontextprotocol.io/specification/2026-07-28/basic/authorization`
and its three sub-pages, on Oct 9 2026. The server-side MUSTs, in short:

| # | requirement | source |
|---|---|---|
| 1 | The authorization server implements OAuth 2.1 | authorization, item 1 |
| 2 | The MCP server publishes Protected Resource Metadata (RFC 9728), at `/.well-known/oauth-protected-resource/mcp` or the root, and answers 401 with `WWW-Authenticate` pointing at it | discovery page |
| 3 | The authorization server publishes RFC 8414 metadata or OpenID discovery, including `code_challenge_methods_supported` | authorization item 5; security page |
| 4 | PKCE with S256 (clients refuse a server whose metadata doesn't list it) | security page |
| 5 | Exact redirect URI matching; redirect URIs are localhost or https; the consent screen shows the redirect host | security page |
| 6 | Refresh tokens for public clients are rotated | security page |
| 7 | Tokens are bound to the resource (RFC 8707): the server accepts only tokens issued for `https://permtracker.app/mcp`, and never passes a received token upstream | authorization, token validation; security page |
| 8 | Client ID Metadata Documents: SHOULD. If supported, the server fetches the client's https document, checks `client_id` matches the URL exactly, validates redirect URIs against it, and guards the fetch against server-side request forgery | client registration page |
| 9 | Dynamic Client Registration (RFC 7591): MAY, and the spec now calls it deprecated, kept for older clients | authorization item 3 |
| 10 | The `iss` response parameter (RFC 9207): SHOULD now, flagged to become MUST; if sent, metadata says so | authorization, issuer section |
| 11 | Tokens never in a query string; invalid or expired tokens get 401, missing scope 403 with the scope named | access token usage |

Two facts about this site shape every option: it runs on Node on the Oracle server behind
Cloudflare (not on Workers), and people sign in through Convex Auth, whose session the Next app
can already read.

## The four options

**A. Self-hosted in Next, stored in Convex.** Our own `/oauth/authorize`, `/oauth/token`,
`/oauth/revoke` and both metadata documents as route handlers; clients, codes and tokens in Convex
tables, stored as hashes exactly like `apiKeys`; the consent page is an ordinary signed-in page.
- Meets 1 to 11 by construction for one resource. Audience binding (7) is a stored field checked
  on lookup. CIMD (8) reuses the address rules webhooks already enforce (`checkWebhookUrl`: https,
  public host name, no IP, standard port) plus a size and time cap on the fetch.
- Token checks can ride the API key path: hash, Convex lookup, the same 60-second cache and push
  revocation, so `/mcp` gets plan limits and scopes with no second system.
- No new vendor, no new data processor, nothing to sign up for.
- Cost: about one to two weeks, most of it tests (each MUST above as a failing test first) and a
  security review before it ships. We own every future spec change, starting with `iss` becoming
  required.

**B. Cloudflare's `@cloudflare/workers-oauth-provider`.** The most complete on paper: its README
cites the 2026-07-28 spec and supports CIMD, DCR, PKCE, RFC 8707, 9207 and 9728, storing tokens
as hashes.
- It runs on Cloudflare Workers and needs a KV namespace. Our MCP endpoint isn't a Worker, so
  every `/mcp` call would ask the Worker to check its token (the library's resource servers check
  over a Service Binding; ours would need an HTTP call or a cache).
- Free-plan ceilings (Cloudflare's own limits pages, read Oct 9 2026): 100,000 Worker requests a
  day and 1,000 KV writes a day to different keys. Codes, tokens and refreshes are writes, so busy
  days would hit the write ceiling first; the paid plan is $5 a month.
- Sign-in still lives in Convex Auth, so `/authorize` needs a bridge back to the app to learn who
  the person is. Two runtimes and two stores for one feature.

**C. The codefox Convex component, `@codefox-inc/oauth-provider` 0.4.2.** Built for Convex Auth,
which fits our stack. Its README: PKCE S256 only, RFC 8707 audience-bound JWTs, refresh rotation,
hashed tokens, DCR off by default.
- It says "Beta Software - Production use at your own risk", has one maintainer, and was last
  published May 17 2026 (npm, read Oct 9 2026).
- Its README never mentions Client ID Metadata Documents, which the spec now prefers over DCR.
- It issues refresh tokens only when `offline_access` is asked for, while the spec says MCP servers
  SHOULD NOT include `offline_access` in their scopes. Assistants that follow the spec may never
  get a refresh token, so people would sign in again every time an access token lapses.

**D. WorkOS AuthKit, as Standalone Connect.** Supports CIMD (and DCR as a fallback) and resource
indicators. Standalone Connect sends people to our own sign-in page, our app signs them in with
Convex Auth, then calls WorkOS's completion API; WorkOS issues JWTs we verify by its keys.
- The fastest route to a working sign-in, and the spec upkeep is theirs.
- A new company holds who signed in and when: the privacy page and the compliance docs gain a
  processor, and an account must be opened under the business. Both are the owner's call.
- Pricing page (read Oct 9 2026): the first 1 million active users free. Whether Standalone Connect
  is billed the same wasn't confirmed.

## Measured against the rules

| | A self-hosted | B Cloudflare | C codefox | D WorkOS |
|---|---|---|---|---|
| OAuth 2.1, PKCE S256, exact redirects (1, 4, 5) | ours to build | yes | yes | yes |
| RFC 9728 on `/mcp` (2) | ours | ours (our server isn't a Worker) | ours | ours |
| RFC 8414 metadata (3) | ours | yes | yes | yes |
| Refresh rotation (6) | ours | yes | yes, with the `offline_access` catch | yes |
| Resource binding, no passthrough (7) | ours, one resource | yes | yes | yes |
| CIMD (8, SHOULD) | ours, reusing the webhook address rules | yes | not mentioned | yes |
| `iss` (10, becoming MUST) | ours | yes | not mentioned | not checked |
| Runs where we run | yes | no, a Worker beside us | yes | their servers |
| New vendor or processor | no | Cloudflare already in the path | no, a beta dependency | yes |
| Token checks share API keys' limits and revocation | yes | no | partly | no |

The resource-server half (row 2, the 401 challenge, reading the token on each `/mcp` call) is ours
in every option. `@modelcontextprotocol/server` 2.1.0, already installed, passes an `authInfo` to
the tools, but serving the metadata and checking the token is ours to write.

## Recommendation

**A, self-hosted in Next with Convex storage**, for one resource and one sign-in system. It meets
every MUST, keeps one place where keys and tokens are checked, revoked and counted, and adds no
vendor. Read C's source as a reference for the token-endpoint edge cases, without depending on it.
If the owner would rather buy than build, D is the honest second choice; it needs his yes for a new
account and a privacy-page change. B is the best library and the wrong runtime for this site.

## Before building

- The owner decides A or D.
- Scopes for assistants: start with `read` and `cases_read`; keep `cases_write` off until there's a
  consent screen that names exactly what an assistant could change.
- Every MUST in the first table becomes a failing test first, including a CIMD document whose
  `client_id` doesn't match its URL, a redirect URI it doesn't list, a token minted for another
  resource, and a reused refresh token.
