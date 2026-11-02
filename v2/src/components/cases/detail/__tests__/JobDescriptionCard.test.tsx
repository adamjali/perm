import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import type { CaseDetailData } from "../case-detail-types";

vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const handleOperationError = vi.fn();
vi.mock("@/lib/errors", () => ({ handleOperationError: (...a: unknown[]) => handleOperationError(...a) }));
vi.mock("@/hooks/useJobDescriptionTemplates", () => ({
  useJobDescriptionTemplates: () => ({
    templates: [],
    isLoading: false,
    loadTemplate: vi.fn(),
    saveAsNewTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    hardDeleteTemplate: vi.fn(),
  }),
}));

const { JobDescriptionCard } = await import("../JobDescriptionCard");

const PROFILE = {
  soc: "15-1252", title: "Software Developers", description: "Develop software.", tasks: ["Analyze needs."], jobZone: 4,
  zoneLabel: "4", zoneName: "Considerable preparation needed", onetVersion: "31.0", href: "/perm-wages/software-developers",
  figures: { filings: 1005, decided: 1000, certified: 940, approvalRate: 0.94, medianWage: 150000 },
  codeFilings: 2000, titles: [{ title: "Software Engineer", filings: 1000, share: 0.5, href: null }],
};

const caseData = (extra: Partial<CaseDetailData> = {}) =>
  ({ _id: "c1", positionTitle: "Software Engineer", employerName: "Acme", ...extra }) as unknown as CaseDetailData;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(PROFILE))));
});
afterEach(() => vi.unstubAllGlobals());

describe("JobDescriptionCard", () => {
  it("shows the code with its title, its card, and a link to the code's page in a new tab", async () => {
    render(<JobDescriptionCard caseData={caseData({ socCode: "15-1252", socTitle: "Software Developers" })} />);
    expect(screen.getByText("15-1252")).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /15-1252 in the SOC code database/ });
    expect(link).toHaveAttribute("href", "/perm-wages/software-developers");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("draws the description as written: paragraphs, and lines starting with a dash as a list", () => {
    render(<JobDescriptionCard caseData={caseData({ jobDescription: "Develop software.\n\n- Analyze needs.\n- Write code." })} />);
    expect(screen.getByText("Develop software.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent?.replace("·", "").trim())).toEqual(["Analyze needs.", "Write code."]);
  });

  it("keeps the editor open, words and all, when the save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Server Error"));
    render(<JobDescriptionCard caseData={caseData({ jobDescription: "Old." })} jobDescProps={{ onSave, onClear: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit the job description" }));
    const box = screen.getByLabelText("Job description");
    await userEvent.clear(box);
    await userEvent.type(box, "New words.");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(handleOperationError).toHaveBeenCalled());
    expect(screen.getByLabelText("Job description")).toHaveValue("New words.");
  });

  it("closes the editor once the save lands", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<JobDescriptionCard caseData={caseData({ jobDescription: "Old." })} jobDescProps={{ onSave, onClear: vi.fn() }} />);
    await userEvent.click(screen.getByRole("button", { name: "Edit the job description" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    // The description's title follows the case's position title, so none of its own is stored.
    expect(onSave).toHaveBeenCalledWith("", "Old.", undefined);
    await waitFor(() => expect(screen.queryByLabelText("Job description")).toBeNull());
  });
});
