import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { rememberCarried } from "@/lib/carriedCase";

const onboarding = vi.hoisted(() => ({ showWizard: false }));
vi.mock("@/components/onboarding/OnboardingProvider", () => ({
  useOnboardingOptional: () => ({ showWizard: onboarding.showWizard }),
}));

const { CarriedCaseCard } = await import("../CarriedCaseCard");

describe("the dashboard's card for dates from the deadline calculator", () => {
  beforeEach(() => {
    onboarding.showWizard = false;
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("offers the stored dates as a case, and goes when dismissed", () => {
    rememberCarried({ pwd: "2026-01-15", first: "2026-02-01" });
    render(<CarriedCaseCard />);
    expect(screen.getByText(/^Wage determination January 15, 2026, first recruitment step February 1, 2026\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add as a case" })).toHaveAttribute(
      "href",
      "/cases/new?calc=2026-01-15_2026-02-01",
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    });
    expect(screen.queryByText(/Your dates from the deadline calculator/)).toBeNull();
    expect(window.localStorage.getItem("pt:calculator-case")).toBeNull();
  });

  it("stays out of the way while the setup wizard takes the dates, and when there are none", () => {
    onboarding.showWizard = true;
    rememberCarried({ pwd: "2026-01-15" });
    const { unmount } = render(<CarriedCaseCard />);
    expect(screen.queryByText(/Your dates from the deadline calculator/)).toBeNull();
    unmount();
    onboarding.showWizard = false;
    window.localStorage.clear();
    render(<CarriedCaseCard />);
    expect(screen.queryByText(/Your dates from the deadline calculator/)).toBeNull();
  });
});
