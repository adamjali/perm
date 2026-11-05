/**
 * The visa bulletin archive as CSV, one row per printed cell.
 *
 * Free for non-commercial reuse under CC BY-NC 4.0, news, research and teaching in any
 * publication (see /open-data and the Terms, §6). Expired by `/api/revalidate-bulletin` the day a bulletin is stored.
 */
import { bulletinCsv, downloadHeaders } from "@/lib/openData";
import { getVisaBulletinsArchive } from "@/lib/db/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(bulletinCsv(await getVisaBulletinsArchive()), {
    headers: downloadHeaders("csv", "visa-bulletins.csv"),
  });
}
