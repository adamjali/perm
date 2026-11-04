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

  it("says it's looking while the codes load, never a silent box", async () => {
    // An answer that hasn't come back yet.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "nurse" } });
    expect(await screen.findByText("Looking up job codes…", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
  });

  it("says when nothing matches, instead of showing no list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ code: null, titles: [], codes: [] }))));
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzqx" } });
    expect(await screen.findByText(/No job code matches that/, {}, { timeout: 2000 })).toBeInTheDocument();
    expect(screen.queryByText("Looking up job codes…")).toBeNull();
  });

  it("asks nothing for one letter", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(DS)));
    vi.stubGlobal("fetch", fetchSpy);
    render(<Harness />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "d" } });
    await act(() => new Promise((r) => setTimeout(r, 400)));
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });

  it("offers the codes for the position title on focus, and hands back what was picked", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(DS)));
    vi.stubGlobal("fetch", fetchSpy);
    const picked = vi.fn();
    function WithTitle() {
      const [v, setV] = useState("");
      return (
        <>
          <label htmlFor="soc">SOC code</label>
          <SocPicker id="soc" value={v} onChange={setV} onPick={picked} suggestFrom="Data Scientist" showPicked={false} />
          <output data-testid="value">{v}</output>
        </>
      );
    }
    render(<WithTitle />);
    const box = screen.getByRole("combobox", { name: "SOC code" });
    fireEvent.focus(box);
    const list = await screen.findByRole("listbox", {}, { timeout: 2000 });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("/api/soc?q=Data%20Scientist");
    expect(list.querySelectorAll("[role=option]")).toHaveLength(2);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("value").textContent).toBe("15-2051");
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ soc: "15-2051", title: "Data Scientists" }));
    // The page shows the picked code its own way, so the picker's own line stays off.
    expect(screen.queryByText("Data Scientists", { selector: "p" })).toBeNull();
  });

  it("keeps a list open that a quick answer brings in after leaving the box and coming straight back", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(DS))));
    function WithTitle() {
      const [v, setV] = useState("");
      return <SocPicker id="soc" value={v} onChange={setV} suggestFrom="Data Scientist" />;
    }
    render(<WithTitle />);
    const box = screen.getByRole("combobox");
    fireEvent.blur(box);
    fireEvent.focus(box);
    await screen.findByRole("listbox", {}, { timeout: 2000 });
    // Past the close-on-leave delay, the list is still there.
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("doesn't suggest over a code already in the box", async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(DS)));
    vi.stubGlobal("fetch", fetchSpy);
    function Filled() {
      const [v, setV] = useState("15-2041");
      return <SocPicker id="soc" value={v} onChange={setV} suggestFrom="Data Scientist" />;
    }
    render(<Filled />);
    fireEvent.focus(screen.getByRole("combobox"));
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("draws its list in a layer of its own, so a short frame can't clip it, and keeps the cursor in the box", async () => {
    // Arrange
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(DS))));
    const { container } = render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Job title or SOC code" });
    box.focus();
    // Act
    fireEvent.change(box, { target: { value: "data scientist" } });
    const list = await screen.findByRole("listbox", {}, { timeout: 2000 });
    // Assert
    expect(container.contains(list)).toBe(false);
    expect(box).toHaveFocus();
    expect(box).toHaveAttribute("aria-controls", list.id);
  });
});
