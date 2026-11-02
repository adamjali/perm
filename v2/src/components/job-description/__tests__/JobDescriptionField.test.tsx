import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { ConvexError } from "convex/values";

import type { Id } from "@convex/_generated/dataModel";
import type { JobDescriptionTemplate } from "@/hooks/useJobDescriptionTemplates";
import type { SocProfile } from "@/lib/socProfile";

// The case form's job description section, the one editor inside it, and the suggestion from the SOC code.

const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("@/lib/toast", () => ({ toast }));

const templates = {
  templates: [] as JobDescriptionTemplate[],
  isLoading: false,
  loadTemplate: vi.fn().mockResolvedValue(undefined),
  saveAsNewTemplate: vi.fn(),
  updateTemplate: vi.fn().mockResolvedValue(undefined),
  hardDeleteTemplate: vi.fn(),
};
vi.mock("@/hooks/useJobDescriptionTemplates", () => ({ useJobDescriptionTemplates: () => templates }));

const writeText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

const { JobDescriptionField } = await import("../JobDescriptionField");
const { JobDescriptionEditor } = await import("../JobDescriptionEditor");

const TEMPLATE: JobDescriptionTemplate = {
  _id: "template_a" as Id<"jobDescriptionTemplates">,
  name: "Data Engineer",
  description: "Build pipelines.",
  usageCount: 2,
  createdAt: 1,
  updatedAt: 1,
};

const PROFILE: SocProfile = {
  soc: "15-1252",
  title: "Software Developers",
  description: "Research, design, and develop software.",
  tasks: ["Analyze user needs.", "Modify existing software.", "Confer with staff."],
  jobZone: 4,
  zoneLabel: "4",
  zoneName: "Considerable preparation needed",
  onetVersion: "31.0",
  href: "/perm-wages/software-developers",
  figures: { filings: 1005, decided: 1000, certified: 940, approvalRate: 0.94, medianWage: 150000 },
  codeFilings: 2000,
  titles: [],
};

/** The editor with its values held the way a form holds them. */
function Editor({ start = "", startTitle = "Software Engineer", socCode, clearable = true }: { start?: string; startTitle?: string; socCode?: string; clearable?: boolean }) {
  const [title, setTitle] = useState(startTitle);
  const [text, setText] = useState(start);
  const [templateId, setTemplateId] = useState<Id<"jobDescriptionTemplates"> | undefined>();
  return (
    <>
      <JobDescriptionEditor
        idPrefix="t"
        inheritedPositionTitle="Software Engineer"
        positionTitle={title}
        description={text}
        socCode={socCode}
        templateId={templateId}
        onPositionTitleChange={setTitle}
        onDescriptionChange={setText}
        onTemplateChange={setTemplateId}
        clearable={clearable}
      />
      <output data-testid="text">{text}</output>
      <output data-testid="template">{templateId ?? ""}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  templates.templates = [];
  templates.isLoading = false;
  templates.saveAsNewTemplate.mockResolvedValue("template_new");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(PROFILE))));
});
afterEach(() => vi.unstubAllGlobals());

describe("JobDescriptionField (the form's section)", () => {
  const props = {
    inheritedPositionTitle: "Software Engineer",
    positionTitle: "Software Engineer",
    onPositionTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onTemplateChange: vi.fn(),
  };

  it("starts folded, says how long the text is, and opens on its heading", async () => {
    render(<JobDescriptionField {...props} description="Build software." />);
    expect(screen.queryByLabelText("Job description")).toBeNull();
    expect(screen.getByText("15 characters")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Job description" }));
    expect(screen.getByLabelText("Job description")).toHaveValue("Build software.");
  });

  it("says a suggestion is waiting when the case has a code and no description", () => {
    render(<JobDescriptionField {...props} description="" socCode="15-1252.00" />);
    expect(screen.getByText("Suggested from 15-1252")).toBeInTheDocument();
  });
});

describe("JobDescriptionEditor", () => {
  it("saves a new template under the title and records it on the case", async () => {
    render(<Editor start="Build pipelines." />);
    await userEvent.click(screen.getByRole("button", { name: "Save template" }));
    expect(templates.saveAsNewTemplate).toHaveBeenCalledWith("Software Engineer", "Build pipelines.");
    await waitFor(() => expect(screen.getByTestId("template").textContent).toBe("template_new"));
  });

  it("updates the template whose name the title matches, whatever its case", async () => {
    templates.templates = [{ ...TEMPLATE, name: "software engineer" }];
    render(<Editor start="New words." />);
    await userEvent.click(screen.getByRole("button", { name: "Update template" }));
    expect(templates.updateTemplate).toHaveBeenCalledWith("template_a", "Software Engineer", "New words.");
  });

  it("asks before updating when the server already holds the name", async () => {
    templates.saveAsNewTemplate.mockRejectedValue(new ConvexError("TEMPLATE_EXISTS:template_a"));
    const { rerender } = render(<Editor start="Words." />);
    await userEvent.click(screen.getByRole("button", { name: "Save template" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Template already exists" })).toBeInTheDocument();
    templates.templates = [{ ...TEMPLATE, name: "Software Engineer" }];
    rerender(<Editor start="Words." />);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Update template" }));
    expect(templates.updateTemplate).toHaveBeenCalledWith("template_a", "Software Engineer", "Words.");
  });

  it("says a refusal in its own words, never a generic failure", async () => {
    templates.saveAsNewTemplate.mockRejectedValue(new ConvexError("Job description is required"));
    render(<Editor start="Words." />);
    await userEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Job description is required"));
  });

  it("can't save a template without a title and words", () => {
    render(<Editor start="" />);
    expect(screen.getByRole("button", { name: "Save template" })).toBeDisabled();
  });

  it("loads a template's title and words, records it on the case and counts the use", async () => {
    templates.templates = [TEMPLATE];
    render(<Editor />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByText("Data Engineer"));
    expect(screen.getByTestId("text").textContent).toBe("Build pipelines.");
    expect(screen.getByTestId("template").textContent).toBe("template_a");
    expect(templates.loadTemplate).toHaveBeenCalledWith(TEMPLATE);
    expect(screen.getByText("From template")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Job description"), " More.");
    expect(screen.getByText("Modified")).toBeInTheDocument();
  });

  it("follows the position title until typed over, and follows it again from the button", async () => {
    render(<Editor startTitle="" />);
    const title = screen.getByLabelText("Position title for the job description");
    await waitFor(() => expect(title).toHaveValue("Software Engineer"));
    await userEvent.clear(title);
    await userEvent.type(title, "Platform Engineer");
    await userEvent.click(screen.getByRole("button", { name: "Use the case's position title again" }));
    expect(title).toHaveValue("Software Engineer");
  });

  it("shows the case's title while it follows, and writes nothing until it's typed over", async () => {
    const onPositionTitleChange = vi.fn();
    render(
      <JobDescriptionEditor
        idPrefix="q"
        inheritedPositionTitle="Software Engineer"
        positionTitle=""
        description=""
        onPositionTitleChange={onPositionTitleChange}
        onDescriptionChange={vi.fn()}
        onTemplateChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Position title for the job description")).toHaveValue("Software Engineer");
    expect(onPositionTitleChange).not.toHaveBeenCalled();
  });

  it("copies the words, and clears everything where the frame allows it", async () => {
    templates.templates = [TEMPLATE];
    render(<Editor start="Words." />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("Words.");
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByTestId("text").textContent).toBe("");
  });

  it("offers no Clear where the frame clears through its own save", () => {
    render(<Editor start="Words." clearable={false} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  });
});

describe("while the saved templates load", () => {
  it("lets the words be written, says the templates are loading, and holds only the picker and Save", async () => {
    templates.isLoading = true;
    render(<Editor />);
    expect(screen.getByText("Loading your saved templates…")).toBeInTheDocument();
    expect(screen.getByLabelText("Job description")).not.toBeDisabled();
    expect(screen.getByLabelText("Position title for the job description")).not.toBeDisabled();
    await userEvent.type(screen.getByLabelText("Job description"), "Builds things.");
    expect(screen.getByTestId("text").textContent).toBe("Builds things.");
  });
});

describe("the suggestion from the SOC code", () => {
  it("says it's loading the code's description, never blank space", async () => {
    // A code no other test asks for, so no earlier answer is reused; an answer that hasn't come back yet.
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<Editor socCode="29-1141" />);
    expect(await screen.findByText(/Loading the suggested description for this job code/)).toBeInTheDocument();
  });

  it("says when the code's description couldn't be read, with Try again", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 503 })));
    render(<Editor socCode="11-1021" />);
    expect(await screen.findByText(/couldn't be read just now/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("fills an empty description with O*NET's text and every ticked task, and Undo empties it again", async () => {
    render(<Editor socCode="15-1252" />);
    expect(await screen.findByRole("heading", { name: "Suggested from SOC 15-1252, Software Developers" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Confer with staff." }));
    await userEvent.click(screen.getByRole("button", { name: "Use this description" }));
    expect(screen.getByTestId("text").textContent).toBe(
      "Research, design, and develop software.\n\n- Analyze user needs.\n- Modify existing software.",
    );
    const [, options] = toast.success.mock.calls.at(-1) as [string, { action: { onClick: () => void } }];
    options.action.onClick();
    await waitFor(() => expect(screen.getByTestId("text").textContent).toBe(""));
  });

  it("starts folded over words already there, adds after them, and asks before replacing them", async () => {
    render(<Editor socCode="15-1252" start="Mine." />);
    await userEvent.click(await screen.findByRole("button", { name: /Show the description from SOC 15-1252/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add to the end" }));
    expect(screen.getByTestId("text").textContent?.startsWith("Mine.\n\nResearch, design")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /Show the description from SOC 15-1252/ }));
    await userEvent.click(screen.getByRole("button", { name: "Replace the description" }));
    await userEvent.click(await screen.findByRole("button", { name: "Replace" }));
    expect(screen.getByTestId("text").textContent?.startsWith("Research, design")).toBe(true);
  });

  it("folds on Not now, and writes nothing about the job's requirements", async () => {
    render(<Editor socCode="15-1252" />);
    await screen.findByRole("heading", { name: /Suggested from SOC 15-1252/ });
    expect(screen.getByText(/The filing states the employer's own duties and minimum requirements/)).toBeInTheDocument();
    expect(screen.getByText(/Job Zone 4: considerable preparation needed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.getByRole("button", { name: /Show the description from SOC 15-1252/ })).toBeInTheDocument();
    expect(screen.getByTestId("text").textContent).toBe("");
  });

  it("shows the first tasks ticked and folds the rest unticked, so nothing goes in unseen", async () => {
    const tasks = Array.from({ length: 9 }, (_, i) => `Task ${i + 1}.`);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...PROFILE, tasks }))));
    render(<Editor socCode="15-1252" />);
    await screen.findByRole("heading", { name: /Suggested from SOC 15-1252/ });
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: /3 more tasks/ }));
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(9);
    expect(boxes.filter((b) => b.getAttribute("aria-checked") === "true")).toHaveLength(6);
    await userEvent.click(screen.getByRole("button", { name: "Use this description" }));
    expect(screen.getByTestId("text").textContent).not.toContain("Task 7.");
    expect(screen.getByTestId("text").textContent).toContain("Task 6.");
  });

  it("offers nothing without a code", () => {
    render(<Editor />);
    expect(screen.queryByText(/Suggested from SOC/)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
