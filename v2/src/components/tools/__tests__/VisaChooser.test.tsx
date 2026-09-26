import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { VisaChooser } from "../VisaChooser";

/** The rules are pinned in `lib/visaChooser.test.ts`; these pin what the reader sees and can reach. */
describe("VisaChooser", () => {
  it("says it isn't legal advice before any answer", () => {
    render(<VisaChooser />);
    expect(screen.getByText(/isn.t legal advice/)).toBeInTheDocument();
  });

  it("starts on a bachelor's job and names EB-3 with its facts", () => {
    render(<VisaChooser />);
    expect(screen.getByRole("heading", { name: "One category could fit" })).toBeInTheDocument();
    expect(screen.getByText("EB-3, professional or skilled worker")).toBeInTheDocument();
    expect(screen.getByText("8 CFR 204.5(l)")).toBeInTheDocument();
  });

  it("hides the job question when nobody is sponsoring, and explains the two routes left", () => {
    render(<VisaChooser />);
    fireEvent.click(screen.getByLabelText("Nobody, I'd file for myself"));
    expect(screen.queryByText("What does the job require at minimum?")).not.toBeInTheDocument();
    expect(screen.getByText(/EB-1A and the national interest waiver/)).toBeInTheDocument();
  });

  it("links each category to its bulletin line and, for EB-2 and EB-3, the people ahead, for the chosen country", () => {
    render(<VisaChooser />);
    fireEvent.change(screen.getByLabelText("Country of chargeability"), { target: { value: "india" } });
    expect(screen.getByRole("link", { name: /This line in the bulletin/ })).toHaveAttribute("href", "/visa-bulletin/categories/eb3-india");
    expect(screen.getByRole("link", { name: /People ahead in it/ })).toHaveAttribute("href", "/tools/green-card-line?category=EB3&country=india");
  });

  it("offers no people-ahead link for EB-1, which the green card line doesn't cover", () => {
    render(<VisaChooser />);
    fireEvent.click(screen.getByLabelText("Nobody, I'd file for myself"));
    fireEvent.click(screen.getByLabelText(/sustained national or international acclaim/));
    expect(screen.getByText("EB-1A, extraordinary ability")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /People ahead in it/ })).not.toBeInTheDocument();
  });
});
