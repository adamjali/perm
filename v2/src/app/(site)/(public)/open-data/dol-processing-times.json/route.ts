/**
 * Every DOL processing-times reading kept, as JSON, one object per reading.
 *
 * Free to reuse under CC BY 4.0 (see /open-data and the Terms, §4). Expired by `/api/revalidate-dol` the day DOL republishes.
 */
import { dolJson, downloadHeaders } from "@/lib/openData";
import { getProcessingTimesArchive } from "@/lib/turso/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(dolJson(await getProcessingTimesArchive()), {
    headers: downloadHeaders("json", "dol-processing-times.json"),
  });
}
