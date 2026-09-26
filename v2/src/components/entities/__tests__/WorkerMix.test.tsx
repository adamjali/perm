import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkerMix } from "../WorkerMix";

describe("WorkerMix", () => {
  it("renders nothing without any of the worker's fields", () => {
    const { container } = render(<WorkerMix facets={{}} subject="employer" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names its years and shows only the panels it has data for", () => {
    render(
      <WorkerMix
        subject="employer"
        facets={{
          citizenship: [{ key: "INDIA", label: "India", n: 120 }, { key: "CHINA", label: "China", n: 30 }],
          visa_class: [{ key: "H-1B", label: "H-1B", n: 140 }],
        }}
      />,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Who they sponsored, FY2016 to FY2023");
    expect(screen.getByText("Country of citizenship")).toBeInTheDocument();
    expect(screen.getByText("Visa held when filed")).toBeInTheDocument();
    expect(screen.queryByText("Schools")).not.toBeInTheDocument();
    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText(/the form in use since mid-2023 doesn.t carry them/)).toBeInTheDocument();
  });

  it("titles an occupation's section by the jobs, not a sponsor", () => {
    render(<WorkerMix subject="occupation" facets={{ education: [{ key: "Master's", label: "Master's", n: 9 }] }} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Who filled these jobs, FY2016 to FY2023");
  });
});
