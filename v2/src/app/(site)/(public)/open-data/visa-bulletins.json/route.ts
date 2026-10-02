/**
 * The visa bulletin archive as JSON, one object per bulletin, cells as printed.
 *
 * Free to reuse under CC BY 4.0 (see /open-data and the Terms, §4). Expired by `/api/revalidate-bulletin` the day a bulletin is stored.
 */
import { bulletinJson, downloadHeaders } from "@/lib/openData";
import { getVisaBulletinsArchive } from "@/lib/turso/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(bulletinJson(await getVisaBulletinsArchive()), {
    headers: downloadHeaders("json", "visa-bulletins.json"),
  });
}
