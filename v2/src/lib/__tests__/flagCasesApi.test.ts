import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The wage-request, LCA and seasonal case routes run every employer slug they answer with through the page
 * check, so the tables link an employer's page and never a 404.
 */

vi.mock("server-only", () => ({}));
const keepLinkableSlugs = vi.fn(async <T extends { employerSlug?: string | null }>(items: T[]) =>
  items.map((t) => (t.employerSlug === "has-a-page" ? t : { ...t, employerSlug: null })),
);
vi.mock("@/lib/db/entityLinks", () => ({ keepLinkableSlugs }));

const { makeFlagCasesHandler } = await import("../flagCasesApi");

const row = (caseNumber: string, employerSlug: string) => ({ caseNumber, employerName: "Acme", employerSlug });

const program = {
  search: vi.fn(async () => [row("P-100-26001-000001", "has-a-page"), row("P-100-26001-000002", "no-page")]),
  searchDisclosed: vi.fn(async () => [row("P-100-25001-000003", "no-page")]),
  list: vi.fn(async () => ({
    rows: [row("P-100-26001-000004", "has-a-page")],
    isDone: true,
    continueCursor: "",
    kind: "all",
    month: null,
  })),
};

const get = makeFlagCasesHandler(program as unknown as Parameters<typeof makeFlagCasesHandler>[0]);

beforeEach(() => {
  keepLinkableSlugs.mockClear();
});

describe("FLAG case routes link only employers with a page", () => {
  it("checks the search's live and published halves", async () => {
    const res = await get(new Request("https://permtracker.app/api/pwd-cases?action=search&text=acme"));
    const body = (await res.json()) as { cases: { employerSlug: string | null }[]; disclosed: { employerSlug: string | null }[] };
    expect(body.cases.map((c) => c.employerSlug)).toEqual(["has-a-page", null]);
    expect(body.disclosed.map((c) => c.employerSlug)).toEqual([null]);
    expect(keepLinkableSlugs).toHaveBeenCalledTimes(2);
  });

  it("checks a browse page's rows", async () => {
    const res = await get(new Request("https://permtracker.app/api/pwd-cases?action=list"));
    const body = (await res.json()) as { rows: { employerSlug: string | null }[]; isDone: boolean };
    expect(body.rows.map((r) => r.employerSlug)).toEqual(["has-a-page"]);
    expect(body.isDone).toBe(true);
    expect(keepLinkableSlugs).toHaveBeenCalledTimes(1);
  });
});
