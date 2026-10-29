import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { optionsFrom, SocPicker } from "../SocPicker";

const DS = {
  code: null,
  titles: [
    {
      key: "data scientist",
      title: "Data Scientist",
      total: 1000,
      slug: "data-scientist",
      codes: [
        { soc: "15-2051", codeTitle: "Data Scientists", filings: 860, share: 0.86, perm: 0, pwd: 0, lca: 0, onet: false, slug: null, zone: 4, spellings: [], becameCodes: [] },
        { soc: "15-2041", codeTitle: "Statisticians", filings: 64, share: 0.064, perm: 0, pwd: 0, lca: 0, onet: false, slug: null, zone: 5, spellings: [], becameCodes: [] },
        { soc: "15-1132", codeTitle: "Software Developers, Applications", filings: 30, share: 0.03, perm: 0, pwd: 0, lca: 0, onet: false, slug: null, zone: null, spellings: [], becameCodes: ["15-1252"] },
      ],
    },
  ],
  codes: [{ soc: "15-2051", title: "Data Scientists", known: true, zone: 4, slug: null, filings: 1, became: [] }],
};

describe("optionsFrom", () => {
  it("offers a title's top codes with their shares, each code once, never a retired one", () => {
    const o = optionsFrom(DS);
    expect(o.map((x) => x.soc)).toEqual(["15-2051", "15-2041"]);
    expect(o[0]!.why).toBe("Data Scientist: 86% of its filings");
  });

  it("reads a 2010 code as the codes it became", () => {
    const o = optionsFrom({
      code: { soc: "15-1132", title: "Software Developers, Applications", known: true, zone: null, slug: null, filings: 9, became: [
        { soc: "15-1252", title: "Software Developers", slug: null },
        { soc: "15-1253", title: "Software QA", slug: null },
      ] },
      titles: [],
      codes: [],
    });
    expect(o.map((x) => x.soc)).toEqual(["15-1252", "15-1253"]);
    expect(o[0]!.why).toBe("15-1132 became this in 2018");
  });

  it("tolerates an answer missing its lists", () => {
    expect(optionsFrom({} as never)).toEqual([]);
  });
});

function Harness() {
  const [v, setV] = useState("");
  return (
    <>
      <label htmlFor="soc">Job title or SOC code</label>
      <SocPicker id="soc" value={v} onChange={setV} />
      <output data-testid="value">{v}</output>
    </>
  );
}

describe("SocPicker", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("turns a typed title into a picked code, by keyboard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(DS))));
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Job title or SOC code" });
    fireEvent.change(box, { target: { value: "data scientist" } });
    const list = await screen.findByRole("listbox", {}, { timeout: 2000 });
    expect(list.querySelectorAll("[role=option]")).toHaveLength(2);
    expect(box).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("15-2041");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("says so when the codes can't be read, instead of an empty list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "nurse" } });
    expect(await screen.findByText(/couldn't be read just now/, {}, { timeout: 2000 })).toBeInTheDocument();
  });

  it("asks nothing for one letter", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(DS)));
    vi.stubGlobal("fetch", fetchSpy);
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d" } });
    await act(() => new Promise((r) => setTimeout(r, 400)));
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });
});
