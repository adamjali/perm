import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";

/**
 * Onboarding for the person the case is about: picking that role leads to one
 * case-number box, the alert is set on the account's own address, and the
 * wizard ends at their case page instead of a caseload setup.
 */

const calls = vi.hoisted(() => ({
  push: vi.fn(),
  watch: vi.fn(),
  finish: vi.fn(),
  saveRole: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: calls.push }) }));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() }, updateToastAuthState: vi.fn() }));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (name === "caseAlerts:watchMyCase") return calls.watch;
    if (name === "onboarding:updateOnboardingStep") return calls.finish;
    if (name === "onboarding:saveOnboardingRole") return calls.saveRole;
    throw new Error(`unexpected mutation ${name}`);
  },
}));

const { RoleStep } = await import("../RoleStep");
const { OwnCaseStep } = await import("../OwnCaseStep");

beforeEach(() => {
  for (const f of Object.values(calls)) f.mockReset();
  calls.finish.mockResolvedValue(null);
  calls.saveRole.mockResolvedValue(null);
});

describe("RoleStep", () => {
  it("lists the own-case role first and leads it to the case-number step", async () => {
    const onNext = vi.fn();
    render(<RoleStep onNext={onNext} />);
    const options = screen.getAllByRole("button").filter((b) => b.textContent !== "Continue");
    expect(options[0]!.textContent).toMatch(/Waiting on my own case/);
    fireEvent.click(options[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Watch your case" })).toBeInTheDocument();
    expect(calls.saveRole).toHaveBeenCalledWith({ role: "Waiting on my own case" });
    expect(onNext).not.toHaveBeenCalled();
    expect(calls.push).not.toHaveBeenCalled();
  });

  it("keeps Other, which continues into the wizard like every other role", async () => {
    const onNext = vi.fn();
    render(<RoleStep onNext={onNext} />);
    fireEvent.click(screen.getByRole("button", { name: /Other/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onNext).toHaveBeenCalled());
  });
});

describe("OwnCaseStep", () => {
  it("watches the number typed, ends the wizard and opens the case", async () => {
    calls.watch.mockResolvedValue({ ok: true, message: "Watching it.", caseNumber: "G-100-26010-550166" });
    render(<OwnCaseStep />);
    fireEvent.change(screen.getByLabelText("Your case number"), { target: { value: " g-100-26010-550166 " } });
    fireEvent.click(screen.getByRole("button", { name: /Watch my case/ }));
    await waitFor(() => expect(calls.push).toHaveBeenCalledWith("/perm-case-status?case=G-100-26010-550166"));
    expect(calls.watch).toHaveBeenCalledWith({ caseNumber: "g-100-26010-550166" });
    expect(calls.finish).toHaveBeenCalledWith({ step: "done" });
  });

  it("says why when the number is refused, and stays put", async () => {
    calls.watch.mockResolvedValue({ ok: false, message: "That doesn't look like a DOL case number." });
    render(<OwnCaseStep />);
    fireEvent.change(screen.getByLabelText("Your case number"), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: /Watch my case/ }));
    expect(await screen.findByText(/doesn't look like a DOL case number/)).toBeInTheDocument();
    expect(calls.push).not.toHaveBeenCalled();
  });

  it("answers an empty press instead of doing nothing", async () => {
    render(<OwnCaseStep />);
    fireEvent.click(screen.getByRole("button", { name: /Watch my case/ }));
    expect(await screen.findByText(/Enter your case number, or find the case/)).toBeInTheDocument();
    expect(calls.watch).not.toHaveBeenCalled();
  });

  it("offers the employer search to someone without the number", () => {
    render(<OwnCaseStep />);
    expect(screen.getByRole("link", { name: /Find the case by employer name/ })).toHaveAttribute("href", "/case-search");
  });
});
