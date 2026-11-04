import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const onboarding = vi.hoisted(() => ({ step: "create_case" as string | null }));
vi.mock("../OnboardingProvider", () => ({
  useOnboarding: () => ({
    step: onboarding.step,
    showWizard: true,
    advanceWizardStep: vi.fn(),
    skipWizard: vi.fn(),
    startTour: vi.fn(),
    skipTour: vi.fn(),
  }),
}));
// The steps have their own tests; here only the progress rail is under test.
vi.mock("../steps/WelcomeStep", () => ({ WelcomeStep: () => <p>welcome body</p> }));
vi.mock("../steps/RoleStep", () => ({ RoleStep: () => <p>role body</p> }));
vi.mock("../steps/CreateCaseStep", () => ({ CreateCaseStep: () => <p>case body</p> }));
vi.mock("../steps/ValuePreviewStep", () => ({ ValuePreviewStep: () => <p>preview body</p> }));
vi.mock("../steps/CompletionStep", () => ({ CompletionStep: () => <p>done body</p> }));

import { OnboardingWizard } from "../OnboardingWizard";

describe("OnboardingWizard's progress", () => {
  it("says which step this is in words, and marks it on one joined rail", () => {
    // Arrange
    onboarding.step = "create_case";
    // Act
    render(<OnboardingWizard />);
    // Assert
    expect(screen.getByText("Step 3 of 5: Your first case")).toBeInTheDocument();
    const rail = screen.getByRole("list", { name: "Setup steps" });
    const steps = within(rail).getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
    expect(steps.filter((s) => s.hasAttribute("aria-current"))).toHaveLength(1);
    expect(steps[0]).toHaveTextContent("Welcome, done");
    expect(steps[4]).toHaveTextContent("Done");
  });

  it("starts at step 1 when no step is stored", () => {
    // Arrange
    onboarding.step = null;
    // Act
    render(<OnboardingWizard />);
    // Assert
    expect(screen.getByText("Step 1 of 5: Welcome")).toBeInTheDocument();
  });
});
