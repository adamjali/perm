/**
 * Every DOL processing-times reading kept, as CSV, one row per published value.
 *
 * Free for non-commercial reuse under CC BY-NC 4.0, news, research and teaching in any
 * publication (see /open-data and the Terms, §6). Expired by `/api/revalidate-dol` the day DOL republishes.
 */
import { dolCsv, downloadHeaders } from "@/lib/openData";
import { getProcessingTimesArchive } from "@/lib/db/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(dolCsv(await getProcessingTimesArchive()), {
    headers: downloadHeaders("csv", "dol-processing-times.csv"),
  });
}
