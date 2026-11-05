/**
 * Every DOL processing-times reading kept, as JSON, one object per reading.
 *
 * Free for non-commercial reuse under CC BY-NC 4.0, news, research and teaching in any
 * publication (see /open-data and the Terms, §6). Expired by `/api/revalidate-dol` the day DOL republishes.
 */
import { dolJson, downloadHeaders } from "@/lib/openData";
import { getProcessingTimesArchive } from "@/lib/db/openData";

export const revalidate = 86400;

export async function GET() {
  return new Response(dolJson(await getProcessingTimesArchive()), {
    headers: downloadHeaders("json", "dol-processing-times.json"),
  });
}
