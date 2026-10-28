import "server-only";

import { doc } from "./publicData";

/**
 * How many PERM jobs meet the EB-2 bar, from what their wage requests require
 * (scripts/build_eb_split.py, perm_docs['eb_split']). Null before the builder's first run.
 */
export interface EbSplit {
  from: string;
  to: string;
  requests: number;
  /** Jobs whose minimum (and any alternative) is a master's or higher, or a bachelor's and five years. */
  eb2: number;
  eb3: number;
  unknown: number;
}

export async function getEbSplit(): Promise<EbSplit | null> {
  const d = await doc<Partial<EbSplit>>("eb_split");
  if (!d || typeof d.eb2 !== "number" || typeof d.eb3 !== "number" || !d.from || !d.to) return null;
  return { from: d.from, to: d.to, requests: d.requests ?? d.eb2 + d.eb3, eb2: d.eb2, eb3: d.eb3, unknown: d.unknown ?? 0 };
}
