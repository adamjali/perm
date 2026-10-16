/**
 * The month picker on the wage request wait page.
 *
 * React takes a server-rendered page over without reading a select's value
 * back (React 19.2: hydration runs no initSelect), so a month picked before
 * the page's script loaded stayed in the box while the answer described the
 * first month, and picking that month again changed nothing. The estimator
 * adopts the month the box shows when it mounts.
 */
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { PwdQueueEstimator } from "../PwdQueueEstimator";

const BACKLOG = [
  { receiptMonth: "2026-04", remainingRequests: 1200 },
  { receiptMonth: "2026-05", remainingRequests: 9800 },
  { receiptMonth: "2026-06", remainingRequests: 14100 },
];

function estimator() {
  return (
    <PwdQueueEstimator
      frontier={{ oewsMonth: "2026-04", nonOewsMonth: null }}
      backlog={BACKLOG}
      asOf="2026-09-30"
      clearancePerMonth={null}
    />
  );
}

let root: Root | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

describe("PwdQueueEstimator's month picker", () => {
  it("answers for the month the box already shows when the page's script takes over", async () => {
    // Arrange: the server's page, with a month picked before hydration.
    container = document.createElement("div");
    container.innerHTML = renderToString(estimator());
    document.body.appendChild(container);
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("2026-06");
    expect(container.textContent).toContain("months before June 2026");
    select.value = "2026-04";

    // Act
    await act(async () => {
      root = hydrateRoot(container!, estimator());
    });

    // Assert: the box and the answer agree.
    expect(select.value).toBe("2026-04");
    expect(container.textContent).toContain("months before April 2026");
    expect(container.textContent).not.toContain("months before June 2026");
  });

  it("keeps the first month when nothing was picked before the script loaded", async () => {
    container = document.createElement("div");
    container.innerHTML = renderToString(estimator());
    document.body.appendChild(container);

    await act(async () => {
      root = hydrateRoot(container!, estimator());
    });

    expect(container.textContent).toContain("months before June 2026");
  });
});
