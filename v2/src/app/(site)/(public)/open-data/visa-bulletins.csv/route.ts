/**
 * The visa bulletin archive as CSV, one row per printed cell.
 *
 * Free to reuse under CC BY 4.0 (see /open-data and the Terms, §4). Expired by `/api/revalidate-bulletin` the day a bulletin is stored.
 */
import { bulletinCsv, downloadHeaders } from "@/lib/openData";
import { getVisaBulletinsArchive } from "@/lib/turso/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(bulletinCsv(await getVisaBulletinsArchive()), {
    headers: downloadHeaders("csv", "visa-bulletins.csv"),
  });
}
