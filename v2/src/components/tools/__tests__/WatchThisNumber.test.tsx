import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DolUnanswered } from "../DolUnanswered";
import { WatchThisNumber } from "../WatchThisNumber";

/**
 * Every program's result offers the same two ways to hear when a number moves
 * (Oct 7 2026): wage requests, LCAs and H-2A, H-2B and CW-1 had the email
 * alone on a pending case and nothing on a number not found yet, while PERM had
 * both everywhere. The sweeps behind both read all four programs' tables.
 */

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("WatchThisNumber", () => {
  it("offers the email alert in the program's own words", () => {
    render(<WatchThisNumber caseNumber="H-400-26270-000001" program="seasonal" />);
    expect(screen.getByRole("textbox", { name: /email/i })).toBeTruthy();
  });

  it("is offered under a lookup DOL didn't answer, only when asked for", () => {
    const { rerender } = render(<DolUnanswered caseNumber="P-100-26270-000001" label="Prevailing wage request" miss="unavailable" />);
    expect(screen.queryByRole("textbox", { name: /email/i })).toBeNull();
    rerender(<DolUnanswered caseNumber="P-100-26270-000001" label="Prevailing wage request" miss="unavailable" watch="pwd" />);
    expect(screen.getByRole("textbox", { name: /email/i })).toBeTruthy();
  });
});
