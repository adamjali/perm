import { NextResponse } from "next/server";

import {
  DEFAULT_PAGE_ITEMS,
  MAX_SEARCH_RESULTS,
  isCaseStatus,
  listCases,
  lookupByCaseNumber,
  searchCases,
  type CaseFilter,
  type CaseSlice,
} from "@/lib/turso/cases";

/**
 * The case browser's data, for a page with no ConvexProvider.
 *
 * /perm-cases is public and static, so it cannot hold a reactive client. It
 * used to reach Convex over plain HTTP from the browser; the corpus now lives
 * in Turso, whose credential must never reach a client bundle, so the browser
 * talks to this route instead and the credential stays on the server.
 *
 * PUBLIC AND UNAUTHENTICATED, so the guards below are ordered by cost. Every
 * length cap runs BEFORE anything that parses or queries: a validator reachable
 * from an unauthenticated endpoint that accepts a large string is a
 * compute-exhaustion primitive until the cheap guard runs first.
 *
 * GET only, and it reads. Nothing here mutates, which also means a mail
 * gateway prefetching a link cannot cause anything.
 */
export const revalidate = 0;

// Nothing DOL prints is anywhere near these. They exist so a caller cannot
// hand us a megabyte and make us do work proportional to it.
const MAX_TEXT = 120;
const MAX_SLUG = 80;
const MAX_CODE = 16;
const MAX_CURSOR = 200;

function bad(message: string) {
  // 400, distinctly. Folding every rejection into one status makes a typo and
  // a hostile input indistinguishable in monitoring.
  return NextResponse.json({ error: message }, { status: 400 });
}

const SLICE_KINDS = ["all", "state", "occupation", "employer", "attorney"] as const;

/**
 * Which dimension, and its value.
 *
 * `kind` is READ rather than inferred from which parameter carries a value,
 * because AN EMPTY VALUE IS A REAL ONE. The browser sends `kind=state` with
 * `state=` for as long as the dimension is chosen and the state is not, and
 * 12,017 cases carry a blank state of their own. Inferring the slice from
 * presence turns both of those into `{ kind: "all" }`, which answers with the
 * whole 373,939-row corpus and looks exactly like a working table - the same
 * shape of wrong answer as a silent catch. Presence stays the fallback, so a
 * link written before `kind` existed still resolves.
 */
function readSlice(p: URLSearchParams): CaseSlice | null {
  const state = p.get("state");
  const soc = p.get("soc");
  const employer = p.get("employer");
  const attorney = p.get("firm");
  const kind = p.get("kind");
  if (kind !== null && !(SLICE_KINDS as readonly string[]).includes(kind)) return null;
  const pick =
    kind ??
    (state
      ? "state"
      : soc
        ? "occupation"
        : employer
          ? "employer"
          : attorney
            ? "attorney"
            : "all");

  switch (pick) {
    case "state":
      return (state ?? "").length > 2 ? null : { kind: "state", state: state ?? "" };
    case "occupation":
      return (soc ?? "").length > MAX_CODE
        ? null
        : { kind: "occupation", socCode: soc ?? "" };
    case "employer":
      return (employer ?? "").length > MAX_SLUG
        ? null
        : { kind: "employer", employerSlug: employer ?? "" };
    case "attorney":
      return (attorney ?? "").length > MAX_SLUG
        ? null
        : { kind: "attorney", attorneySlug: attorney ?? "" };
    default:
      return { kind: "all" };
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  // `action`, matching the client that calls it. I overwrote an earlier
  // version of this file that already had that contract; renaming the
  // server param is one edit, renaming three call sites is three.
  const action = p.get("action") ?? "list";

  if (action === "lookup") {
    const raw = p.get("caseNumber") ?? "";
    if (!raw || raw.length > MAX_TEXT) return bad("caseNumber missing or too long");
    const row = await lookupByCaseNumber(raw);
    return NextResponse.json(row, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
    });
  }

  if (action === "search") {
    const field = p.get("field");
    if (field !== "employer" && field !== "attorney") return bad("field must be employer or attorney");
    const text = p.get("text") ?? "";
    // Length BEFORE anything else touches it.
    if (text.length < 2 || text.length > MAX_TEXT) return bad("text must be 2..120 chars");
    const status = p.get("status");
    if (status && !isCaseStatus(status)) return bad("unknown status");
    const state = p.get("state");
    if (state && state.length > 2) return bad("bad state");
    const rawLimit = Number(p.get("limit") ?? MAX_SEARCH_RESULTS);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_SEARCH_RESULTS)
      : MAX_SEARCH_RESULTS;
    const rows = await searchCases({
      field,
      text,
      ...(status && isCaseStatus(status) ? { status } : {}),
      ...(state ? { state } : {}),
      limit,
    });
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  }

  if (action !== "list") return bad("unknown action");

  const slice = readSlice(p);
  if (!slice) return bad("unknown or over-long slice");
  const status = p.get("status");
  if (status && !isCaseStatus(status)) return bad("unknown status");
  const from = p.get("from");
  const to = p.get("to");
  // Shape-check the dates rather than handing arbitrary text to the query.
  if ((from && !ISO.test(from)) || (to && !ISO.test(to))) return bad("dates must be YYYY-MM-DD");
  const cursor = p.get("cursor");
  if (cursor && cursor.length > MAX_CURSOR) return bad("cursor too long");
  const order = p.get("order") === "oldest" ? "oldest" : "newest";
  const rawItems = Number(p.get("numItems") ?? DEFAULT_PAGE_ITEMS);

  const filter: CaseFilter = {
    slice,
    ...(status && isCaseStatus(status) ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };

  // numItems is clamped inside listCases (clampPageItems); passing it through
  // rather than re-clamping here keeps one definition of the ceiling.
  const page = await listCases({
    filter,
    order,
    cursor: cursor ?? null,
    ...(Number.isFinite(rawItems) ? { numItems: Math.floor(rawItems) } : {}),
  });

  return NextResponse.json(page, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
