import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { RefusalYearTable } from "../RefusalYearTable";
import type { RefusalRow } from "@/lib/visaRefusals";

/** Every ground of a year: State's order, a sort that keeps N/A last, and another year asked for by its route. */

const row = (line: number, code: string, ivFound: number | null, nivFound: number | null): RefusalRow => ({
  fy: 2024,
  line,
  code,
  ground: `Ground ${code}`,
  ivFound,
  ivOvercome: ivFound === null ? null : 1,
  nivFound,
  nivOvercome: nivFound === null ? null : 1,
});

const initial = {
  fy: 2024,
  grounds: [row(1, "203(c)", 1842, null), row(2, "212(a)(4)", 1008, 74), row(3, "214(b)", null, 3010544)],
  totals: { iv_found: 2850, iv_overcome: 2, niv_found: 3010618, niv_overcome: 2 },
  knownGaps: [],
};

const codes = () => screen.getAllByRole("row").slice(1, -1).map((r) => within(r).getByRole("rowheader").textContent?.match(/^[^G]+/)?.[0].trim());

afterEach(() => vi.unstubAllGlobals());

describe("the year table", () => {
  it("lists the year's grounds in State's order, with State's total line", () => {
    render(<RefusalYearTable years={[2022, 2023, 2024]} initial={initial} />);
    expect(codes()).toEqual(["203(c)", "212(a)(4)", "214(b)"]);
    expect(screen.getByText("State's total line")).toBeTruthy();
    expect(screen.getAllByText("N/A")).toHaveLength(4);
  });

  it("sorts a column most first, and keeps not applicable last", () => {
    render(<RefusalYearTable years={[2024]} initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /Immigrant, found/ }));
    expect(codes()).toEqual(["203(c)", "212(a)(4)", "214(b)"]);
    fireEvent.click(screen.getByRole("button", { name: /Immigrant, found/ }));
    expect(codes()).toEqual(["212(a)(4)", "203(c)", "214(b)"]);
  });

  it("asks for another year by its route and shows it", async () => {
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        asked.push(url);
        return new Response(
          JSON.stringify({ ok: true, fy: 2022, grounds: [{ ...row(1, "212(a)(4)", 678, 93), fy: 2022 }], totals: null, knownGaps: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
    render(<RefusalYearTable years={[2022, 2023, 2024]} initial={initial} />);
    fireEvent.change(screen.getByLabelText("Fiscal year"), { target: { value: "2022" } });
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("FY2022: 1 grounds"));
    expect(asked).toEqual(["/api/visa-refusals?fy=2022"]);
    expect(screen.getByText("678")).toBeTruthy();
  });

  it("says so when another year couldn't be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, message: "State's refusal tables couldn't be read just now." }), { status: 503 })));
    render(<RefusalYearTable years={[2022, 2024]} initial={initial} />);
    fireEvent.change(screen.getByLabelText("Fiscal year"), { target: { value: "2022" } });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("FY2022's table didn't load"));
  });
});
