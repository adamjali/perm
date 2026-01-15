// @vitest-environment jsdom
/**
 * TimelineMilestoneMarker Component Tests
 * Tests for individual milestone markers on the timeline.
 *
 * Requirements:
 * 1. Renders at correct position percentage
 * 2. Uses correct color for stage
 * 3. Shows tooltip on hover
 * 4. Calls onNavigate on click
 * 5. Scales on hover
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import { TimelineMilestoneMarker } from "../TimelineMilestoneMarker";
import type { TimelineMilestoneMarkerProps } from "../TimelineMilestoneMarker";
import type { Milestone } from "@/lib/timeline/types";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Factory for creating test Milestone data.
 */
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

/**
 * Default props for the component.
 */
function getDefaultProps(): TimelineMilestoneMarkerProps {
  return {
    milestone: createMockMilestone(),
    position: 50,
    caseId: "test-case-123",
  };
}

// ============================================================================
// RENDERING TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Rendering", () => {
  it("renders milestone marker", () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);

    // Should have accessible label
    expect(
      screen.getByRole("img", { name: /pwd filed.*jun 15, 2024/i })
    ).toBeInTheDocument();
  });

  it("renders as button when onNavigate is provided", () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={onNavigate} />
    );

    expect(
      screen.getByRole("button", { name: /pwd filed.*click to view case/i })
    ).toBeInTheDocument();
  });

  it("renders as img when onNavigate is not provided", () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

// ============================================================================
// POSITION TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Position", () => {
  it("positions at 0% for position=0", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={0} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ left: "0%" });
  });

  it("positions at 50% for position=50", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={50} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ left: "50%" });
  });

  it("positions at 100% for position=100", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={100} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ left: "100%" });
  });

  it("clamps negative position to 0%", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={-10} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ left: "0%" });
  });

  it("clamps position over 100 to 100%", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={150} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ left: "100%" });
  });

  it("applies transform translate for centering", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={50} />
    );

    const marker = container.querySelector(".absolute");
    expect(marker).toHaveStyle({ transform: "translate(-50%, -50%)" });
  });
});

// ============================================================================
// COLOR TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Stage Colors", () => {
  it("applies PWD stage color (#0066FF)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          stage: "pwd",
          color: "#0066FF",
        })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#0066FF" });
  });

  it("applies recruitment stage color (#9333ea)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          stage: "recruitment",
          color: "#9333ea",
        })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#9333ea" });
  });

  it("applies ETA 9089 stage color (#ea580c)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          stage: "eta9089",
          color: "#ea580c",
        })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#ea580c" });
  });

  it("applies I-140 stage color (#16a34a)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          stage: "i140",
          color: "#16a34a",
        })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#16a34a" });
  });

  it("applies RFI stage color (#dc2626)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          stage: "rfi",
          color: "#dc2626",
        })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toHaveStyle({ backgroundColor: "#dc2626" });
  });
});

// ============================================================================
// TOOLTIP TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Tooltip", () => {
  it("shows tooltip with milestone label on hover", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ label: "ETA 9089 Certified" })}
      />
    );

    // Tooltip should not be visible initially
    expect(screen.queryByText("ETA 9089 Certified")).not.toBeInTheDocument();

    // Trigger hover
    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    // Tooltip should now be visible
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

    // Trigger hover
    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    // Tooltip should show formatted date
    await waitFor(() => {
      expect(screen.getByText("Jan 15, 2024")).toBeInTheDocument();
    });
  });

  it("hides tooltip by default (not in DOM)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    // Tooltip should not be present until hovered
    const tooltip = container.querySelector(".bottom-full");
    expect(tooltip).not.toBeInTheDocument();
  });

  it("shows tooltip on hover and hides on mouse leave", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const marker = screen.getByRole("img");

    // Hover to show tooltip
    fireEvent.mouseEnter(marker);

    await waitFor(() => {
      const tooltip = container.querySelector(".bottom-full");
      expect(tooltip).toBeInTheDocument();
    });

    // Mouse leave to hide tooltip
    fireEvent.mouseLeave(marker);

    await waitFor(() => {
      const tooltip = container.querySelector(".bottom-full");
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  it("positions tooltip above the marker when visible", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    // Tooltip should be positioned at bottom-full (above the marker)
    await waitFor(() => {
      const tooltip = container.querySelector(".bottom-full");
      expect(tooltip).toBeInTheDocument();
    });
  });
});

// ============================================================================
// CLICK NAVIGATION TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Click Navigation", () => {
  it("calls onNavigate with caseId when clicked", async () => {
    const onNavigate = vi.fn();
    const { user } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        caseId="test-case-456"
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole("button");
    await user.click(button);

    expect(onNavigate).toHaveBeenCalledWith("test-case-456");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("does not call onNavigate when not provided", async () => {
    const { user } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const marker = screen.getByRole("img");
    await user.click(marker);

    // No error should occur, component should be non-interactive
    expect(marker).toBeInTheDocument();
  });

  it("triggers onNavigate on Enter key press", async () => {
    const onNavigate = vi.fn();
    const { user } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        caseId="test-case-789"
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard("{Enter}");

    expect(onNavigate).toHaveBeenCalledWith("test-case-789");
  });

  it("triggers onNavigate on Space key press", async () => {
    const onNavigate = vi.fn();
    const { user } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        caseId="test-case-abc"
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole("button");
    button.focus();
    await user.keyboard(" ");

    expect(onNavigate).toHaveBeenCalledWith("test-case-abc");
  });

  it("has tabIndex=0 when onNavigate is provided", () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} onNavigate={onNavigate} />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("tabindex", "0");
  });

  it("has no tabIndex when onNavigate is not provided", () => {
    renderWithProviders(<TimelineMilestoneMarker {...getDefaultProps()} />);

    const marker = screen.getByRole("img");
    expect(marker).not.toHaveAttribute("tabindex");
  });
});

// ============================================================================
// HOVER EFFECTS TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Hover Effects", () => {
  it("renders dot with rounded-full class for animations", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    // The dot should have rounded-full class (animation is handled by motion/react)
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
  });

  it("uses motion component for animations (mocked in tests)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    // The dot element should exist (motion component renders as regular div in tests)
    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("w-4", "h-4");
  });

  it("marker has cursor-pointer styling", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const markerContainer = container.querySelector(".cursor-pointer");
    expect(markerContainer).toBeInTheDocument();
  });

  it("shows tooltip on hover which provides visual context", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const marker = screen.getByRole("img");

    // Hover to show tooltip
    fireEvent.mouseEnter(marker);

    await waitFor(() => {
      const tooltip = container.querySelector(".z-50");
      expect(tooltip).toBeInTheDocument();
    });
  });
});

// ============================================================================
// STYLING TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Neobrutalist Styling", () => {
  it("has 16px (w-4 h-4) dot size", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const dot = container.querySelector(".w-4.h-4");
    expect(dot).toBeInTheDocument();
  });

  it("has 3px border on dot", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const dot = container.querySelector(".border-\\[3px\\]");
    expect(dot).toBeInTheDocument();
  });

  it("has foreground border color", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const dot = container.querySelector(".border-foreground");
    expect(dot).toBeInTheDocument();
  });

  it("has shadow-hard-sm on dot", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const dot = container.querySelector(".shadow-hard-sm");
    expect(dot).toBeInTheDocument();
  });

  it("has rounded-full (circle) shape", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).toBeInTheDocument();
  });
});

// ============================================================================
// CALCULATED MILESTONE TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Calculated Milestones", () => {
  it("has dashed border for calculated milestones", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ isCalculated: true })}
      />
    );

    const dot = container.querySelector(".border-dashed");
    expect(dot).toBeInTheDocument();
  });

  it("has solid border for regular milestones", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({ isCalculated: false })}
      />
    );

    const dot = container.querySelector(".rounded-full");
    expect(dot).not.toHaveClass("border-dashed");
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

describe("TimelineMilestoneMarker - Accessibility", () => {
  it("has accessible aria-label with milestone info", () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          label: "I-140 Approved",
          date: "2024-03-20",
        })}
      />
    );

    const marker = screen.getByRole("img");
    expect(marker).toHaveAttribute(
      "aria-label",
      "I-140 Approved: Mar 20, 2024"
    );
  });

  it("includes navigation hint in aria-label when interactive", () => {
    const onNavigate = vi.fn();
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          label: "PWD Determined",
          date: "2024-02-10",
        })}
        onNavigate={onNavigate}
      />
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "PWD Determined: Feb 10, 2024 - Click to view case"
    );
  });

  it("tooltip has pointer-events-none to not interfere with clicks", async () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} />
    );

    // Trigger hover to show tooltip
    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    await waitFor(() => {
      const tooltip = container.querySelector(".pointer-events-none");
      expect(tooltip).toBeInTheDocument();
    });
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe("TimelineMilestoneMarker - Edge Cases", () => {
  it("handles very long milestone labels", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          label: "Very Long Milestone Label That Could Overflow",
        })}
      />
    );

    // Trigger hover to show tooltip
    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    // Should render without breaking layout
    await waitFor(() => {
      expect(
        screen.getByText("Very Long Milestone Label That Could Overflow")
      ).toBeInTheDocument();
    });
  });

  it("handles milestone with order number (RFI/RFE)", async () => {
    renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        milestone={createMockMilestone({
          label: "RFI Received #1",
          stage: "rfi",
          order: 1,
        })}
      />
    );

    // Trigger hover to show tooltip
    const marker = screen.getByRole("img");
    fireEvent.mouseEnter(marker);

    await waitFor(() => {
      expect(screen.getByText("RFI Received #1")).toBeInTheDocument();
    });
  });

  it("handles position at exact boundary (0)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={0} />
    );

    expect(container.querySelector(".absolute")).toBeInTheDocument();
  });

  it("handles position at exact boundary (100)", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker {...getDefaultProps()} position={100} />
    );

    expect(container.querySelector(".absolute")).toBeInTheDocument();
  });

  it("accepts custom className", () => {
    const { container } = renderWithProviders(
      <TimelineMilestoneMarker
        {...getDefaultProps()}
        className="custom-test-class"
      />
    );

    const marker = container.querySelector(".custom-test-class");
    expect(marker).toBeInTheDocument();
  });
});
