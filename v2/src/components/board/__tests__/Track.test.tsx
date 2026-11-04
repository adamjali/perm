import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Track } from "../BoardParts";

describe("/today's track of four steps", () => {
  it("stacks the steps in one column below 1024px and joins them with the connector rule", () => {
    // Arrange
    const css = readFileSync(join("src", "app", "globals.css"), "utf8");
    // Act
    render(
      <Track steps={["Wage request", "PERM", "I-140", "Visa bulletin"]}>
        <li>one</li>
        <li>two</li>
      </Track>,
    );
    const list = screen.getByRole("list", { name: "The four steps, in order" });
    // Assert
    expect(list).toHaveClass("track-stack", "grid-cols-1", "lg:grid-cols-4");
    // Two columns between phone and desktop read as a grid, not as steps in order.
    expect(list.className).not.toMatch(/\bsm:grid-cols-2\b/);
    expect(css).toMatch(/@media \(max-width: 1023px\)\s*\{\s*\.track-stack > li \{/);
    expect(css).toMatch(/\.track-stack > li:not\(:last-child\)::after \{[^}]*content: "";/);
  });
});
