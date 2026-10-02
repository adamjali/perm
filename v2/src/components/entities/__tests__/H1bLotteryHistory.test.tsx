import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { H1bLotteryHistory } from "../H1bLotteryHistory";

/** The FOIA lottery panel: nothing without rows, newest year first, the credit Bloomberg asks for. */
describe("H1bLotteryHistory", () => {
  it("draws nothing without rows", () => {
    expect(render(<H1bLotteryHistory years={null} />).container.textContent).toBe("");
  });

  it("states selected of registered with the share, and credits the source", () => {
    const { container } = render(
      <H1bLotteryHistory
        years={[
          { fy: 2021, registrations: 200, selected: 50, petitioned: 40, approved: 38, denied: 2 },
          { fy: 2024, registrations: 400, selected: 100, petitioned: 90, approved: 85, denied: 5 },
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("FY2021 to FY2024");
    expect(text).toContain("100 of 400 selected (25%), 90 petitions filed, 85 approved, 5 denied");
    expect(text.indexOf("FY2024 100 of")).toBeGreaterThan(-1);
    expect(text.indexOf("FY2024 100 of")).toBeLessThan(text.indexOf("FY2021 50 of"));
    expect(text).toContain("obtained by Bloomberg News under FOIA");
  });
});
