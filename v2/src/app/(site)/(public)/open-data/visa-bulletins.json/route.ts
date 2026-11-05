/**
 * The visa bulletin archive as JSON, one object per bulletin, cells as printed.
 *
 * Free for non-commercial reuse under CC BY-NC 4.0, news, research and teaching in any
 * publication (see /open-data and the Terms, §6). Expired by `/api/revalidate-bulletin` the day a bulletin is stored.
 */
import { bulletinJson, downloadHeaders } from "@/lib/openData";
import { getVisaBulletinsArchive } from "@/lib/db/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(bulletinJson(await getVisaBulletinsArchive()), {
    headers: downloadHeaders("json", "visa-bulletins.json"),
  });
}
