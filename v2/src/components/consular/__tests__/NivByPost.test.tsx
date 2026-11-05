import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/nivIssuances", () => ({ nivSummary: vi.fn(), classesByPost: vi.fn() }));

import { classesByPost, nivSummary } from "@/lib/db/nivIssuances";
import { NivByPost } from "../NivByPost";

/** The consulates index's switch: H-1B, L-1 and K-1 fiancé(e) visas by consulate, State's newest month. */

const summary = {
  months: ["2026-01", "2026-02"],
  newest: "2026-02",
  totalByMonth: {},
  classByMonth: { H1B: { "2026-02": 4593 }, L1: { "2026-02": 5292 }, K1: { "2026-02": 1588 } },
};
const rows = [
  { post_key: "manila", post: "Manila", visa_class: "K1", n: 376 },
  { post_key: "ciudad juarez", post: "Ciudad Juarez", visa_class: "K1", n: 146 },
  { post_key: "mumbai", post: "Mumbai", visa_class: "H1B", n: 900 },
  { post_key: "toronto", post: "Toronto", visa_class: "L1", n: 300 },
];

async function html(pages = new Map([["manila", "manila"], ["mumbai", "mumbai"]])) {
  return renderToStaticMarkup(await NivByPost({ pages }));
}

beforeEach(() => {
  vi.mocked(nivSummary).mockResolvedValue(summary);
  vi.mocked(classesByPost).mockResolvedValue(rows);
});

describe("visas issued by consulate", () => {
  it("switches between H-1B, L-1 and K-1 fiancé(e), for State's newest month", async () => {
    const out = await html();
    for (const tab of ["H-1B", "L-1", "K-1 fiancé(e)"]) expect(out).toContain(`>${tab}<`);
    expect(vi.mocked(classesByPost)).toHaveBeenCalledWith("2026-02", ["H1B", "L1", "K1"]);
    expect(out).toContain("1,588 K-1 fiancé(e) visas worldwide in February 2026");
  });

  it("links a consulate that has a page here, and names one that doesn't", async () => {
    const out = await html();
    expect(out).toContain('href="/consular-posts/manila"');
    expect(out).not.toContain('href="/consular-posts/ciudad-juarez"');
    expect(out).toContain("Ciudad Juarez");
  });

  it("shows nothing before the first load", async () => {
    vi.mocked(nivSummary).mockResolvedValue(null);
    expect(await NivByPost({ pages: new Map() })).toBeNull();
  });
});
