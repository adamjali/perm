import { buildFeed } from "@/lib/policyFeed";
import { listPolicyNotices } from "@/lib/db/policyNotices";
import { policySearchItems } from "@/lib/policySearch";
import { easternDay } from "@/lib/time";

/**
 * Every document the policy page lists, for its search box, fetched the first time someone uses the box
 * (src/components/policy/PolicySearch.tsx). The page's own window, and expired with it by
 * /api/revalidate-policy, so the search never answers from an older list than the page shows.
 */
export const revalidate = 21600;

export async function GET(): Promise<Response> {
  const today = easternDay();
  const items = policySearchItems(buildFeed(await listPolicyNotices(), today), today);
  return Response.json(items, { headers: { "X-Robots-Tag": "noindex" } });
}
