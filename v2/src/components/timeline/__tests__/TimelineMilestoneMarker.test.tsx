// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { TimelineMilestoneMarker } from "../TimelineMilestoneMarker";
import type { TimelineMilestoneMarkerProps } from "../TimelineMilestoneMarker";
import type { Milestone } from "@/lib/timeline/types";

function createMockMilestone(overrides?: Partial<Milestone>): Milestone {
  return {
    field: "pwdFilingDate",
    label: "PWD Filed",
    date: "2024-06-15",
    stage: "pwd",
    color: "#0066FF",
    isCalculated: false,
    ...overrides,
  };
}

function getDefaultProps(): TimelineMilestoneMarkerProps {
  return {
    milestone: createMockMilestone(),
    position: 50,
    caseId: "test-case-123",
  };
}

describe("TimelineMilestoneMarker - Rendering", () => {
  it("renders milestone marker with accessible label", () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);
    expect(screen.getByRole("img", { name: /pwd filed.*jun 15, 2024/i })).toBeInTheDocument();
  });

  it("renders as button when onNavigate is provided", () => {
    renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /pwd filed.*click to view case/i })).toBeInTheDocument();
  });

  it("renders as img when onNavigate is not provided", () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TimelineMilestoneMarker - Position", () => {
  it.each([
    [0, "0%"],
    [50, "50%"],
    [100, "100%"],
    [-10, "0%"],
    [150, "100%"],
  ])("positions correctly for input=%s → %s", (input, expected) => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={input} />
    );
    expect(container.querySelector(".absolute")).toHaveStyle({ left: expected });
  });

  it("applies transform translate for centering", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={50} />
    );
    expect(container.querySelector(".absolute")).toHaveStyle({ transform: "translate(-50%, -50%)" });
  });
});

describe("TimelineMilestoneMarker - Stage Colors", () => {
  it.each([
    ["pwd", "#0066FF"],
    ["recruitment", "#9333ea"],
    ["eta9089", "#ea580c"],
    ["i140", "#16a34a"],
    ["rfi", "#dc2626"],
  ] as const)("applies %s stage color (%s)", (stage, color) => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ stage, color })}
      />
    );
    expect(container.querySelector(".rounded-full")).toHaveStyle({ backgroundColor: color });
  });
});

describe("TimelineMilestoneMarker - Tooltip", () => {
  it("shows tooltip with milestone label on hover", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "ETA 9089 Certified" })}
      />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(screen.getByText("ETA 9089 Certified")).toBeInTheDocument();
    });
  });

  it("shows tooltip with formatted date on hover", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ date: "2024-01-15" })}
      />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
    });
  });

  it("hides tooltip on mouse leave", async () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);
    const marker = screen.getByRole("img");

    fireEvent.mouseEnter(marker);
    await waitFor(() => {
      expect(screen.getByText("PWD Filed")).toBeInTheDocument();
    });

    fireEvent.mouseLeave(marker);
    await waitFor(() => {
      expect(screen.queryByText("PWD Filed")).not.toBeInTheDocument();
    });
  });

  it("tooltip has pointer-events-none to not interfere with clicks", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(container.querySelector(".pointer-events-none")).toBeInTheDocument();
    });
  });
});

describe("TimelineMilestoneMarker - Click Navigation", () => {
  it("calls onNavigate on click", async () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={onNavigate} />
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["{Enter}", "Enter"],
    [" ", "Space"],
  ])("triggers onNavigate on %s key press", async (key) => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={onNavigate} />
    );
    screen.getByRole("button").focus();
    await userEvent.keyboard(key);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not call onNavigate when not provided", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );
    fireEvent.click(container.querySelector(".absolute")!);
    // No error = pass
  });

  it("shows cursor-pointer when interactive", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={vi.fn()} />
    );
    expect(container.querySelector(".cursor-pointer")).toBeInTheDocument();
  });

  it("shows tooltip on hover with interactive marker", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(container.querySelector(".z-50")).toBeInTheDocument();
    });
  });
});

describe("TimelineMilestoneMarker - Neobrutalist Styling", () => {
  it.each([
    [".w-4.h-4", "16px dot size"],
    [".border-\\[3px\\]", "3px border"],
    [".border-foreground", "foreground border color"],
    [".shadow-hard-sm", "shadow-hard-sm"],
    [".rounded-full", "circle shape"],
  ])("dot has %s (%s)", (selector) => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

describe("TimelineMilestoneMarker - Calculated Milestones", () => {
  it("has dashed border for calculated milestones", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ isCalculated: true })}
      />
    );
    expect(container.querySelector(".border-dashed")).toBeInTheDocument();
  });

  it("has solid border for regular milestones", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ isCalculated: false })}
      />
    );
    expect(container.querySelector(".rounded-full")).not.toHaveClass("border-dashed");
  });
});

describe("TimelineMilestoneMarker - Accessibility", () => {
  it("has accessible aria-label with milestone info", () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "I-140 Approved", date: "2024-03-20" })}
      />
    );
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "I-140 Approved: Mar 20, 2024");
  });

  it("includes navigation hint in aria-label when interactive", () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "PWD Determined", date: "2024-02-10" })}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "PWD Determined: Feb 10, 2024 - Click to view case"
    );
  });
});

describe("TimelineMilestoneMarker - Edge Cases", () => {
  it("handles very long milestone labels", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "Very Long Milestone Label That Could Overflow" })}
      />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(screen.getByText("Very Long Milestone Label That Could Overflow")).toBeInTheDocument();
    });
  });

  it("handles milestone with order number (RFI/RFE)", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "RFI Received #1", stage: "rfi", order: 1 })}
      />
    );
    fireEvent.mouseEnter(screen.getByRole("img"));
    await waitFor(() => {
      expect(screen.getByText("RFI Received #1")).toBeInTheDocument();
    });
  });

  it.each([[0], [100]])("handles position at exact boundary (%s)", (position) => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={position} />
    );
    expect(container.querySelector(".absolute")).toBeInTheDocument();
  });

  it("accepts custom className", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} className="custom-test-class" />
    );
    expect(container.querySelector(".custom-test-class")).toBeInTheDocument();
  });
});
