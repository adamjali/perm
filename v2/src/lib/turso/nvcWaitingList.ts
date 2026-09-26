import "server-only";

import { doc } from "@/lib/turso/publicData";
import type { NvcWaitingListDoc } from "@/lib/nvcWaitingList";

/** State's NVC waiting list, written by scripts/ingest_nvc_waiting_list.py. Null until it's loaded. */
export async function getNvcWaitingList(): Promise<NvcWaitingListDoc | null> {
  return doc<NvcWaitingListDoc>("nvc_waiting_list");
}
