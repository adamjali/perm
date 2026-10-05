/**
 * The one request the extension makes, and the check its answer must pass.
 *
 * The request carries the employer's name and nothing else (the extension's
 * version rides in a header). The answer is checked field by field before
 * anything renders it, and every link in it must point at permtracker.app,
 * so a bad answer can't put a stranger's link in the panel.
 */

export const API_ORIGIN = "https://permtracker.app";
const LOOKUP_PATH = "/v1/lookup/employer";

export function lookupUrl(name: string): string {
  return `${API_ORIGIN}${LOOKUP_PATH}?${new URLSearchParams({ name }).toString()}`;
}

export interface LookupEmployer {
  name: string;
  slug: string;
  url: string;
  page: "perm" | "live" | "other";
  perm: {
    published: number;
    certified: number;
    denied: number;
    certifiedShare: number | null;
    pending: number | null;
    newestFiling: string | null;
    filingsLast12Months: number | null;
  };
  h1bLcas: number | null;
  wageRequests: number | null;
}

export interface LookupAnswer {
  data: { query: string; match: "exact" | "possible" | "none"; employer: LookupEmployer | null; shareFloor: number };
  meta: { source: string; asOf: string | null; url: string };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNumOrNull = (v: unknown) => v === null || isNum(v);
const isStrOrNull = (v: unknown) => v === null || typeof v === "string";
const ours = (v: unknown) => typeof v === "string" && v.startsWith(`${API_ORIGIN}/`);

function isEmployer(e: unknown): e is LookupEmployer {
  if (!isObj(e) || !isObj(e.perm)) return false;
  const p = e.perm;
  return (
    typeof e.name === "string" &&
    typeof e.slug === "string" &&
    ours(e.url) &&
    (e.page === "perm" || e.page === "live" || e.page === "other") &&
    isNum(p.published) &&
    isNum(p.certified) &&
    isNum(p.denied) &&
    isNumOrNull(p.certifiedShare) &&
    isNumOrNull(p.pending) &&
    isStrOrNull(p.newestFiling) &&
    isNumOrNull(p.filingsLast12Months) &&
    isNumOrNull(e.h1bLcas) &&
    isNumOrNull(e.wageRequests)
  );
}

/** The answer, if it has exactly the shape the panel renders; null otherwise. */
export function parseLookup(json: unknown): LookupAnswer | null {
  if (!isObj(json) || !isObj(json.data) || !isObj(json.meta)) return null;
  const d = json.data;
  const m = json.meta;
  if (d.match !== "exact" && d.match !== "possible" && d.match !== "none") return null;
  if (typeof d.query !== "string" || !isNum(d.shareFloor)) return null;
  if (d.match === "none" ? d.employer !== null : !isEmployer(d.employer)) return null;
  if (typeof m.source !== "string" || !isStrOrNull(m.asOf) || !ours(m.url)) return null;
  return json as unknown as LookupAnswer;
}
