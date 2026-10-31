import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AreaLoadFailure, areaPlaceholder, useWageAreas } from "../WageAreas";

/**
 * DOL's area list answered 503 on Oct 29 2026 (7:34 to 7:49 PM EDT, while FLAG was down), and the wage-level tool
 * and the lottery calculator both said "DOL lists no areas". A list that didn't load says why and offers to ask again.
 */

function Picker({ state, onLoaded }: { state: string; onLoaded?: (n: number) => void }) {
  const { areas, failure, retry } = useWageAreas(state, 2026, (list) => onLoaded?.(list.length));
  return (
    <div>
      <p data-testid="placeholder">{areaPlaceholder(state, areas, failure) ?? `${areas?.length} areas`}</p>
      <AreaLoadFailure failure={failure} retry={retry} />
    </div>
  );
}

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

describe("the wage-area list", () => {
  it("says why it didn't load, never that DOL lists none, and asks again", async () => {
    // Arrange: DOL down, then back.
    const answers = [
      new Response(JSON.stringify({ ok: false, message: "DOL answered 503." }), { status: 502 }),
      new Response(JSON.stringify({ ok: true, areas: [{ value: 41884, label: "San Francisco-Oakland-Hayward, CA" }] })),
    ];
    global.fetch = vi.fn(async () => answers.shift()!) as unknown as typeof fetch;
    const loaded: number[] = [];
    // Act
    render(<Picker state="California" onLoaded={(n) => loaded.push(n)} />);
    // Assert
    await screen.findByText(/DOL answered 503\./);
    expect(screen.getByTestId("placeholder").textContent).toBe("DOL's areas didn't load");
    expect(screen.queryByText("DOL lists no areas")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    await waitFor(() => expect(screen.getByTestId("placeholder").textContent).toBe("1 areas"));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(loaded).toEqual([0, 1]);
  });

  it("says a dropped connection, too", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    render(<Picker state="Texas" />);
    await screen.findByText(/the connection dropped/);
  });

  it("still says DOL lists no areas when DOL answered with none", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, areas: [] }))) as unknown as typeof fetch;
    render(<Picker state="Guam" />);
    await waitFor(() => expect(screen.getByTestId("placeholder").textContent).toBe("DOL lists no areas"));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
