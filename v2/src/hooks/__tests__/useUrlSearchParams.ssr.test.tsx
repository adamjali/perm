/**
 * @vitest-environment node
 *
 * The data tools render in full on the server inside their Suspense fallback.
 * That only works if the fallback copy NEVER calls useSearchParams: on a
 * prerendered page that call bails the boundary out to client rendering, and
 * the prerendered HTML goes back to holding a one-line placeholder. Here the
 * mock throws exactly like that bailout, so a fallback that reached it fails.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    throw new Error("BAILOUT_TO_CLIENT_SIDE_RENDERING: useSearchParams()");
  },
}));

import {
  SearchParamsBoundary,
  WithoutSearchParams,
  useUrlSearchParams,
} from "../useUrlSearchParams";

function Tool() {
  const params = useUrlSearchParams();
  return <p>{`state=${params.get("state") ?? "all"}`}</p>;
}

describe("useUrlSearchParams", () => {
  it("returns empty parameters under WithoutSearchParams without calling useSearchParams", () => {
    const html = renderToStaticMarkup(
      <WithoutSearchParams>
        <Tool />
      </WithoutSearchParams>,
    );
    expect(html).toBe("<p>state=all</p>");
  });

  it("reads the real parameters everywhere else", () => {
    expect(() => renderToStaticMarkup(<Tool />)).toThrow(/useSearchParams/);
  });

  it("SearchParamsBoundary's fallback is the whole tool, not a placeholder", async () => {
    // The fallback is what a prerendered page holds; the content bails out.
    const { renderToReadableStream } = await import("react-dom/server");
    const stream = await renderToReadableStream(
      <SearchParamsBoundary>
        <Tool />
      </SearchParamsBoundary>,
      { onError: () => {} },
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain("state=all");
  });
});
