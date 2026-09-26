import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * The explorer's city and industry narrowings: offered only where the route
 * accepts them, disabled until the slice they narrow is chosen, sent with the
 * request, and dropped with the state or occupation they depend on.
 */

let search = new URLSearchParams();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/tools/salary-explorer",
  useSearchParams: () => search,
}));

const { SalaryExplorer } = await import("../SalaryExplorer");

const EMPTY = {
  stats: { n: 0, avg: null, p5: null, p25: null, p50: null, p75: null, p95: null },
  bins: [], binWidth: 0, below: 0, above: 0, byState: [],
};

function renderIt(placeFilters: boolean) {
  render(
    <SalaryExplorer
      occupations={[{ value: "15-1252", label: "Software Developers", n: 9 }]}
      states={[{ value: "WA", label: "WA", n: 9 }]}
      fiscalYears={["2026"]}
      initial={EMPTY}
      placeFilters={placeFilters}
    />,
  );
}

const fetchMock = vi.fn();
beforeEach(() => {
  replace.mockReset();
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => EMPTY });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("SalaryExplorer place filters", () => {
  it("disables both until a state (or, for industry, an occupation) is chosen", () => {
    search = new URLSearchParams();
    renderIt(true);
    expect(screen.getByLabelText("Worksite city")).toBeDisabled();
    expect(screen.getByLabelText("Industry")).toBeDisabled();
  });

  it("sends the city and the sector with the request", () => {
    search = new URLSearchParams("state=WA&city=Seattle&sector=51");
    renderIt(true);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("city=Seattle");
    expect(url).toContain("sector=51");
  });

  it("ignores them on a page that doesn't offer them", () => {
    search = new URLSearchParams("state=WA&city=Seattle&sector=51");
    renderIt(false);
    expect(screen.queryByLabelText("Worksite city")).not.toBeInTheDocument();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).not.toContain("city=");
    expect(url).not.toContain("sector=");
  });

  it("drops the city with its state, and the sector with the last of state and occupation", () => {
    search = new URLSearchParams("state=WA&city=Seattle&sector=51");
    renderIt(true);
    fireEvent.change(screen.getByLabelText("Worksite state"), { target: { value: "" } });
    const to = String(replace.mock.calls[0]?.[0]);
    expect(to).not.toContain("city=");
    expect(to).not.toContain("sector=");
  });

  it("commits a typed city on Enter", () => {
    search = new URLSearchParams("state=WA");
    renderIt(true);
    const box = screen.getByLabelText("Worksite city");
    fireEvent.change(box, { target: { value: "  Redmond " } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(String(replace.mock.calls[0]?.[0])).toContain("city=Redmond");
  });
});
