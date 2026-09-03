// @vitest-environment jsdom
/**
 * Pager: "wait" and "that's everything" must not look the same.
 *
 * Why this file exists. Three case browsers each disabled Next with
 * `disabled={!page || page.isDone}` or `disabled={page?.isDone !== false}`.
 * Both are true while the next page is STILL LOADING as well as when there is
 * no next page, so a reader on a slow connection saw a greyed button that
 * meant "hold on" and read as "there is nothing more". Nothing on screen
 * distinguished them, which is the reported defect in miniature: "can or cant
 * i just click and nothing happens".
 *
 * The reason a control is off is VISIBLE TEXT wired with `aria-describedby`,
 * not a `title`. A tooltip on a disabled button is invisible to a keyboard and
 * to a phone, and most engines suppress pointer events on a disabled control
 * so the tooltip never fires at all.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Pager } from "../pager";

const base = {
  id: "t-pager",
  page: 1,
  hasPrevious: false,
  hasNext: true,
  onPrevious: () => {},
  onNext: () => {},
  buttonClassName: "btn",
};

describe("Pager", () => {
  it("says a page is loading rather than looking like the end of the list", () => {
    render(<Pager {...base} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    // Both controls are off while a page is in flight, and neither of them
    // claims the list has ended.
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.queryByText(/last page/i)).not.toBeInTheDocument();
  });

  it("says which end you are at when there is genuinely no more", () => {
    render(<Pager {...base} page={4} hasPrevious hasNext={false} />);
    expect(screen.getByText("Next is off: this is the last page.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("points the disabled control at the sentence that explains it", () => {
    render(<Pager {...base} />);
    const previous = screen.getByRole("button", { name: "Previous" });
    const describedBy = previous.getAttribute("aria-describedby");
    expect(describedBy).toBe("t-pager");
    // The id has to resolve to real, readable text - an aria-describedby
    // pointing at nothing is worse than none, because it reads as handled.
    const reason = document.getElementById(describedBy!);
    expect(reason).not.toBeNull();
    expect(reason).toHaveTextContent("Previous is off: this is the first page.");
  });

  it("carries the caller's own caption instead of replacing it", () => {
    render(
      <Pager {...base}>
        <p>Newest filing first.</p>
      </Pager>,
    );
    expect(screen.getByText("Newest filing first.")).toBeInTheDocument();
  });

  it("still works when both ends are reachable, and says nothing then", async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<Pager {...base} page={2} hasPrevious hasNext onNext={onNext} />);
    // No reason line: neither control is off, so there is nothing to explain.
    expect(screen.queryByText(/is off/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("renames both controls for the lists that read chronologically", () => {
    render(<Pager {...base} previousLabel="Newer" nextLabel="Older" hasNext={false} hasPrevious />);
    expect(screen.getByRole("button", { name: "Newer" })).toBeInTheDocument();
    expect(screen.getByText("Older is off: this is the last page.")).toBeInTheDocument();
  });
});
