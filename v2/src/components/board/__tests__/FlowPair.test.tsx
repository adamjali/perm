import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowPair, flowSentence } from "../BoardParts";

const flow = (filed: number, decided: number, trend: "growing" | "shrinking" | "level") => ({
  filed,
  decided,
  change: filed - decided,
  trend,
  from: "2026-09-28",
  to: "2026-10-27",
});

describe("flowSentence", () => {
  it("says which side the line gained on, in the step's own words", () => {
    // Act / Assert
    expect(flowSentence(flow(97_501, 45_236, "growing"), ["Received", "Completed"])).toBe("52,265 more received than completed");
    expect(flowSentence(flow(9_884, 16_413, "shrinking"))).toBe("6,529 more decided than filed");
    expect(flowSentence(flow(1_000, 990, "level"))).toBe("About as many decided as filed");
  });
});

describe("FlowPair", () => {
  it("draws both counts on one scale with the window under them", () => {
    // Act
    const { container } = render(<FlowPair flow={flow(13_842, 15_659, "shrinking")} />);
    // Assert
    expect(screen.getByText("13,842")).toBeInTheDocument();
    expect(screen.getByText("15,659")).toBeInTheDocument();
    const widths = [...container.querySelectorAll<HTMLElement>("dd > div")].map((d) => d.style.width);
    expect(widths[1]).toBe("100%");
    expect(screen.getByText(/to Oct 27/)).toBeInTheDocument();
    expect(screen.queryByText(/more/)).toBeNull();
  });

  it("adds what the pair comes to when nothing beside it says so", () => {
    // Act
    render(<FlowPair flow={flow(62_932, 45_044, "growing")} labels={["Received", "Completed"]} period="April to June 2026" say />);
    // Assert
    expect(screen.getByText("April to June 2026: 17,888 more received than completed")).toBeInTheDocument();
  });
});
