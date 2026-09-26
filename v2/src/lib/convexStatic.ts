import "server-only";

import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

/**
 * A Convex query for a page that is prerendered and revalidated on a window.
 *
 * WHY NOT `fetchQuery` FROM `convex/nextjs`. It always sets
 * `cache: "no-store"` on its client (convex 1.46, `setupClient`), and one
 * no-store fetch makes the whole route dynamic, whatever `revalidate` the
 * page exports. Measured 2026-09-26: adding one community-timeline read to
 * `/perm-processing-times` turned it from prerendered to rendered on every
 * visit, and `/tools/i140-calculator` and `/tools/green-card-timeline` had
 * been dynamic in production the same way since they first read Convex.
 * This client sends the page's own window instead, so the page stays static
 * and refreshes on schedule. `public-convex-reads.test.ts` keeps public pages
 * off `convex/nextjs`.
 */
export async function queryStatic<Q extends FunctionReference<"query">>(
  query: Q,
  args: FunctionArgs<Q>,
  revalidateSeconds: number,
): Promise<FunctionReturnType<Q>> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  // The client's own `fetch` option is the typed way in; it adds the window to
  // every request the client makes and changes nothing else.
  const windowed: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: revalidateSeconds } } as RequestInit);
  const client = new ConvexHttpClient(url, { fetch: windowed });
  return client.query(query, args);
}
