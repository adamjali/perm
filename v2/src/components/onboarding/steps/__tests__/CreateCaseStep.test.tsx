import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { calculatePWDExpiration } from "@/lib/perm";

/**
 * The setup wizard's first case. Its stage is never asked for: cases.create
 * works it out from the dates (a picked stage was ignored, Oct 19 2026). A new
 * account that came from the deadline calculator saves the case with its dates.
 */

const calls = vi.hoisted(() => ({ create: vi.fn(), complete: vi.fn() }));

vi.mock("convex/react", () => ({ useMutation: () => calls.create }));
vi.mock("../../OnboardingProvider", () => ({
  useOnboarding: () => ({
    setOnboardingCaseId: vi.fn(),
    setOnboardingCaseInfo: vi.fn(),
    completeChecklistItem: calls.complete,
  }),
}));

const { CreateCaseStep } = await import("../CreateCaseStep");

function fill() {
  fireEvent.change(screen.getByLabelText(/Employer name/), { target: { value: "Acme" } });
  fireEvent.change(screen.getByLabelText(/Position title/), { target: { value: "Engineer" } });
  fireEvent.click(screen.getByRole("button", { name: "Create case" }));
}

describe("CreateCaseStep", () => {
  beforeEach(() => {
    calls.create.mockReset().mockResolvedValue("case-1");
    calls.complete.mockReset().mockResolvedValue(null);
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("saves the first case with the calculator's dates and forgets them after", async () => {
    window.history.replaceState(null, "", "/dashboard?calc=2026-01-15_2026-02-01_2026-03-10");
    const onNext = vi.fn();
    render(<CreateCaseStep onNext={onNext} />);
    expect(screen.getByText(/From the deadline calculator: wage determination January 15, 2026/)).toBeInTheDocument();
    fill();
    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employerName: "Acme",
        pwdDeterminationDate: "2026-01-15",
        pwdExpirationDate: calculatePWDExpiration("2026-01-15"),
        recruitmentNotes: expect.stringMatching(/first recruitment step February 1, 2026, last March 10, 2026/),
      }),
    );
    expect(window.location.search).toBe("");
  });

  it("asks for no stage and adds no dates without them", async () => {
    const onNext = vi.fn();
    render(<CreateCaseStep onNext={onNext} />);
    expect(screen.queryByText("Current PERM stage")).toBeNull();
    expect(screen.getByText(/stage follows its dates/)).toBeInTheDocument();
    fill();
    await waitFor(() => expect(onNext).toHaveBeenCalled());
    const args = calls.create.mock.calls[0]![0];
    expect(args).not.toHaveProperty("pwdDeterminationDate");
    // No stage set by hand: the server works it out from the dates.
    expect(args).not.toHaveProperty("progressStatusOverride");
  });
});
