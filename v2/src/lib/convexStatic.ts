import "server-only";

import { ConvexHttpClient } from "convex/browser";
import { getFunctionName, type FunctionArgs, type FunctionReference, type FunctionReturnType } from "convex/server";
import { unstable_cache } from "next/cache";

/**
 * A Convex query for a page that is prerendered and revalidated on a window.
 *
 * WHY NOT `fetchQuery` FROM `convex/nextjs`. It always sets `cache: "no-store"` on its client (convex 1.46,
 * `setupClient`), and one no-store fetch makes the whole route dynamic, whatever `revalidate` the page exports:
 * one Convex read is enough to turn a prerendered page into one rendered on every visit.
 * `public-convex-reads.test.ts` keeps public pages off `convex/nextjs`.
 *
 * WHY `unstable_cache`, NOT A WINDOWED FETCH. Convex answers a failed query with HTTP 200 and the error in the
 * body, and Next's data cache keeps any 200, so a read that failed (a function not deployed yet, a transient
 * error) was served for the page's whole window (open since Oct 22 2026). `unstable_cache` stores only a result
 * that came back: the client throws on Convex's error reply, so a failed read is never stored, and a stale entry
 * whose refresh fails keeps serving the last good value (Next's unstable-cache.ts). Inside it a no-store fetch
 * doesn't make the page dynamic (Next's patch-fetch.ts, read Nov 4 2026), so the page stays static and refreshes
 * on the same window as before. Each caller passes its page's own window, so this cache never holds a page longer
 * or shorter than the page asks; a revalidatePath of the page still clears it (it checks the page's own tags).
 * It stores JSON, which suits every query read this way: none returns an int64 or bytes field.
 */
export async function queryStatic<Q extends FunctionReference<"query">>(
  query: Q,
  args: FunctionArgs<Q>,
  revalidateSeconds: number,
): Promise<FunctionReturnType<Q>> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  const name = getFunctionName(query);
  const read = unstable_cache(
    async () => {
      const client = new ConvexHttpClient(url, {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      });
      return client.query(query, args);
    },
    ["convex-static", name, JSON.stringify(args ?? {})],
    { revalidate: revalidateSeconds, tags: [`convex:${name}`] },
  );
  return read() as Promise<FunctionReturnType<Q>>;
}
