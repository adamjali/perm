import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const params = { q: "" };
vi.mock("@/hooks/useUrlSearchParams", () => ({
  useUrlSearchParams: () => new URLSearchParams(params.q ? { q: params.q } : {}),
}));

import { SocFinder } from "../SocFinder";

function found(query: string, title: string, slug: string) {
  return {
    query,
    code: null,
    codes: [],
    titles: [
      {
        key: title.toLowerCase(),
        title,
        total: 1000,
        slug,
        codes: [
          { soc: "15-2051", codeTitle: "Data Scientists", filings: 860, share: 0.86, perm: 0, pwd: 0, lca: 0, onet: false, slug: null, zone: 4, spellings: [], becameCodes: [] },
          { soc: "15-2041", codeTitle: "Statisticians", filings: 140, share: 0.14, perm: 0, pwd: 0, lca: 0, onet: false, slug: null, zone: 5, spellings: [], becameCodes: [] },
        ],
      },
    ],
  };
}

const live = () => document.querySelector("[aria-live=polite]") as HTMLElement;

describe("SocFinder", () => {
  beforeEach(() => {
    params.q = "";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("answers a shared address once, at full strength", async () => {
    params.q = "data scientist";
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(found("data scientist", "Data Scientist", "data-scientist"))));
    vi.stubGlobal("fetch", fetchSpy);
    render(<SocFinder examples={[]} />);
    // While the first answer loads there's nothing to dim.
    expect(live().className).toBe("");
    expect(await screen.findByText("86%")).toBeInTheDocument();
    expect(live().className).toBe("");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("dims the earlier answer while the next one loads", async () => {
    params.q = "data scientist";
    let release: () => void = () => {};
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async () => new Response(JSON.stringify(found("data scientist", "Data Scientist", "data-scientist"))))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((r) => {
            release = () => r(new Response(JSON.stringify(found("statistician", "Statistician", "statistician"))));
          }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    render(<SocFinder examples={[]} />);
    await screen.findByText("86%");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "statistician" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(live().className).toContain("opacity-60"));
    expect(screen.getByText("86%")).toBeInTheDocument();
    release();
    await waitFor(() => expect(live().className).toBe(""));
  });

  it("says why when the codes can't be read", async () => {
    params.q = "nurse";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "The job codes couldn't be read just now." }), { status: 503 })));
    render(<SocFinder examples={[]} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't be read just now");
  });
});
