// @vitest-environment jsdom
/**
 * The master case search's worker, job and industry filters, its order
 * control and its CSV link, as a reader meets them.
 *
 * What is pinned is what the route is SENT and what the reader is TOLD: a
 * filter that never reaches the wire, an order the table does not show, a
 * download that asks for a different search than the page, and a row whose
 * worker fields vanish are each invisible in a result count.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { UnifiedCase } from "@/lib/turso/unifiedSearch";

const usePublicQuery = vi.fn();
vi.mock("@/hooks/usePublicQuery", () => ({ usePublicQuery }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

const { UnifiedCaseSearch } = await import("../UnifiedCaseSearch");

const row = (caseNumber: string, over: Partial<UnifiedCase> = {}): UnifiedCase =>
  ({
    caseNumber, program: "perm", half: "published", status: "certified", isFinal: true,
    filedOn: "2019-01-02", decidedOn: "2019-06-01", employerName: "ACME CORP", employerSlug: "acme-corp",
    jobTitle: "Engineer", wage: 120000, wageUnit: null, state: "WA", firmName: null, firmSlug: null,
    socCode: "15-1252.00", socTitle: "Software Developers", days: 150, ...over,
  }) as UnifiedCase;

function answer(over: Record<string, unknown> = {}) {
  return {
    rows: [
      row("A-19001-00001", {
        era: "history", city: "SEATTLE", industryTitle: "Custom Computer Programming Services",
        citizenship: "INDIA", birthCountry: "INDIA", visaClass: "H-1B", education: "Master's",
        major: "COMPUTER SCIENCE", jobEducation: "Bachelor's", wage: 90000,
      }),
      row("G-100-24001-000002", { wage: 150000, decidedOn: "2024-03-01" }),
    ],
    counts: { perm: 2, pwd: 0, lca: 0, seasonal: 0 },
    truncated: false, capped: false, windowed: false,
    skipped: { live: true, published: false, because: ["citizenship"] },
    lead: { kind: "employer", value: "acme" },
    resolved: { firm: null, occupation: null },
    dropped: [], needsLead: false,
    permOnly: ["citizenship"], order: "wage-desc", orderScope: "complete",
    ...over,
  };
}

const OPTIONS = {
  citizenship: [{ value: "INDIA", n: 1200 }, { value: "KOREA, SOUTH", n: 90 }],
  birthCountry: [], visaClass: [{ value: "H-1B", n: 800 }], education: [], jobEducation: [],
};

/** The query string the component last asked the route for. */
const lastAsked = () => {
  const urls = usePublicQuery.mock.calls.map((c) => String(c[0])).filter((u) => u !== "skip");
  return new URLSearchParams((urls.at(-1) ?? "").split("?")[1] ?? "");
};

beforeEach(() => {
  usePublicQuery.mockReset();
  usePublicQuery.mockImplementation((url: string) =>
    url === "skip" ? { data: undefined, failed: false } : { data: answer(), failed: false },
  );
});

function renderIt() {
  return render(
    <UnifiedCaseSearch
      industries={[{ code: "31-33", title: "Manufacturing" }, { code: "54", title: "Professional, Scientific, and Technical Services" }]}
      fieldOptions={OPTIONS}
      publishedFrom="2016"
    />,
  );
}

describe("the worker, job and industry filters", () => {
  it("sends each one with the search, the typed NAICS code over the sector", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Industry" }), { target: { value: "31-33" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Citizenship" }), { target: { value: "KOREA, SOUTH" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Visa at filing" }), { target: { value: "H-1B" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Worker's education" }), { target: { value: "Master's" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Worksite city" }), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    let q = lastAsked();
    expect(q.get("naics")).toBe("31-33");
    expect(q.get("cit")).toBe("KOREA, SOUTH");
    expect(q.get("visa")).toBe("H-1B");
    expect(q.get("edu")).toBe("Master's");
    expect(q.get("city")).toBe("Seattle");

    fireEvent.change(screen.getByRole("textbox", { name: /NAICS code/ }), { target: { value: "5415" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    q = lastAsked();
    expect(q.get("naics")).toBe("5415");
  });

  it("shows countries in title case with their counts, and keeps DOL's spelling as the value", () => {
    renderIt();
    const opt = screen.getByRole("option", { name: "Korea, South (90)" }) as HTMLOptionElement;
    expect(opt.value).toBe("KOREA, SOUTH");
  });

  it("names a value the route would refuse instead of sending it", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Worksite city" }), { target: { value: "Seattle; DROP" } });
    fireEvent.change(screen.getByRole("textbox", { name: /NAICS code/ }), { target: { value: "54a" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(lastAsked().has("city")).toBe(false);
    expect(lastAsked().has("naics")).toBe(false);
    expect(screen.getByText(/NAICS code and Worksite city were not used\./)).toBeInTheDocument();
  });

  it("says the old-form fields exist only for cases filed on DOL's old form", () => {
    renderIt();
    expect(screen.getByText(/doesn't carry them\./)).toBeInTheDocument();
  });
});

describe("the answer", () => {
  it("says a PERM-only filter left the other programs out", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText("Only published PERM cases are in this answer.")).toBeInTheDocument();
  });

  it("shows the worker and job under the title, and marks a row from the FY2008 to FY2023 file", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByText("Seattle · Custom Computer Programming Services")).toBeInTheDocument();
    expect(screen.getByText(/Worker: India citizen, H-1B at filing, Master's in Computer Science/)).toBeInTheDocument();
    expect(screen.getByText(/Job requires: Bachelor's/)).toBeInTheDocument();
    expect(screen.getAllByText("FY2008 to FY2023 file")).toHaveLength(1);
  });

  it("orders the table as asked and says whether the order covers every match", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Order the answer by"), { target: { value: "wage-desc" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(lastAsked().get("order")).toBe("wage-desc");
    const first = document.querySelector("tbody tr");
    expect(first?.textContent).toContain("G-100-24001-000002");
    expect(screen.getByText(/Highest wage first covers every match/)).toBeInTheDocument();
  });

  it("offers the same search as a CSV download", () => {
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const link = screen.getByRole("link", { name: /Download CSV \(2 rows\)/ });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/api/case-search?")).toBe(true);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("format")).toBe("csv");
    expect(q.get("q")).toBe("acme");
    // Nothing but the format differs from the search the page ran.
    q.delete("format");
    const ran = lastAsked();
    ran.delete("s");
    expect(q.toString()).toBe(ran.toString());
  });
});

describe("the reason a control is off", () => {
  it("prints the no-lead sentence once, and each off control still carries a reason", () => {
    const { container } = renderIt();
    const said = (container.textContent ?? "").split("Start with an employer or a case number").length - 1;
    expect(said).toBe(1);
    const city = screen.getByRole("textbox", { name: "Worksite city" });
    expect(city).toBeDisabled();
    const id = city.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toMatch(/law firm/);
  });
});

describe("a long answer is shown a page at a time, and says so", () => {
  it("draws 100 rows, counts the rest, and shows more on request", () => {
    const many = Array.from({ length: 230 }, (_, i) => row(`G-100-24001-${String(100000 + i).padStart(6, "0")}`));
    usePublicQuery.mockImplementation((url: string) =>
      url === "skip" ? { data: undefined, failed: false } : { data: answer({ rows: many, counts: { perm: 230, pwd: 0, lca: 0, seasonal: 0 } }), failed: false },
    );
    renderIt();
    fireEvent.change(screen.getByLabelText("Employer or case number"), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const bodyRows = () => document.querySelectorAll("tbody tr").length;
    expect(bodyRows()).toBe(100);
    expect(screen.getByText(/Showing 100 of 230\. The CSV download carries all/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 100 more" }));
    expect(bodyRows()).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "Show 30 more" }));
    expect(bodyRows()).toBe(230);
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/ })).toBeNull();
  });
});
