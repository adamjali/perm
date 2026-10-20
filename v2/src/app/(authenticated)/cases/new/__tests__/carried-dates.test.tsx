import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMutation, useConvex } from "convex/react";

import { calculatePWDExpiration } from "@/lib/perm";
import { AddCasePageClient } from "../AddCasePageClient";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("convex/react", () => ({ useMutation: vi.fn(), useConvex: vi.fn() }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, updateToastAuthState: vi.fn() }));

// The real form is heavy; this one shows what it was seeded with and submits
// it with the three fields a person types, the way the real one does.
vi.mock("@/components/forms/CaseForm", () => ({
  CaseForm: ({ initialData, onSuccess }: { initialData?: Record<string, unknown>; onSuccess: (d: unknown) => void }) => (
    <div>
      <pre data-testid="seed">{JSON.stringify(initialData ?? null)}</pre>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            ...initialData,
            employerName: "Acme",
            beneficiaryIdentifier: "AB",
            positionTitle: "Engineer",
            caseStatus: "recruitment",
            progressStatus: "working",
          })
        }
      >
        Save case
      </button>
    </div>
  ),
}));

const create = vi.fn();

describe("the new-case form opened from the deadline calculator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    create.mockResolvedValue("case-1");
    (useMutation as ReturnType<typeof vi.fn>).mockReturnValue(create);
    (useConvex as ReturnType<typeof vi.fn>).mockReturnValue({ query: vi.fn().mockResolvedValue({ duplicates: [] }) });
  });
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("arrives with the wage dates filled in and the recruitment steps as a note", async () => {
    window.history.replaceState(null, "", "/cases/new?calc=2026-01-15_2026-02-01_2026-03-10");
    render(<AddCasePageClient />);
    const seed = JSON.parse(screen.getByTestId("seed").textContent || "null");
    expect(seed.pwdDeterminationDate).toBe("2026-01-15");
    expect(seed.pwdExpirationDate).toBe(calculatePWDExpiration("2026-01-15"));
    expect(seed.recruitmentNotes).toMatch(/first recruitment step February 1, 2026, last March 10, 2026/);
    expect(screen.getByText(/From the deadline calculator: wage determination January 15, 2026/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save case" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]![0]).toMatchObject({ pwdDeterminationDate: "2026-01-15", employerName: "Acme" });
    // Saved once: the dates don't follow the person to the next new case.
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(window.localStorage.getItem("pt:calculator-case")).toBeNull();
  });

  it("opens empty without dates, and empties when the person starts without them", async () => {
    const { unmount } = render(<AddCasePageClient />);
    expect(screen.getByTestId("seed").textContent).toBe("null");
    expect(screen.queryByText(/From the deadline calculator/)).toBeNull();
    unmount();

    window.history.replaceState(null, "", "/cases/new?calc=2026-01-15");
    render(<AddCasePageClient />);
    expect(screen.getByTestId("seed").textContent).toContain("2026-01-15");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Start without them" }));
    });
    await waitFor(() => expect(screen.getByTestId("seed").textContent).toBe("null"));
  });
});
