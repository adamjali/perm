/**
 * Every DOL processing-times reading kept, as CSV, one row per published value.
 *
 * Free to reuse under CC BY 4.0 (see /open-data and the Terms, §4). Expired by `/api/revalidate-dol` the day DOL republishes.
 */
import { dolCsv, downloadHeaders } from "@/lib/openData";
import { getProcessingTimesArchive } from "@/lib/turso/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(dolCsv(await getProcessingTimesArchive()), {
    headers: downloadHeaders("csv", "dol-processing-times.csv"),
  });
}
