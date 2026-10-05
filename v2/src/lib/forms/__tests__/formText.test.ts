import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("@/lib/analytics", () => ({ analytics: { capture } }));

const { formText } = await import("../formText");

function form(html: string): HTMLFormElement {
  const f = document.createElement("form");
  f.innerHTML = html;
  return f;
}

beforeEach(() => capture.mockReset());

describe("formText", () => {
  it("reads what the box holds, not the caller's copy, and says the two disagreed", () => {
    const f = form('<input name="q">');
    // An autofill sets the value with no input event, so state never saw it.
    (f.elements.namedItem("q") as HTMLInputElement).value = "google";
    expect(formText(f, "q", "")).toBe("google");
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0]).toBe("form_field_desync");
    // Which field, never what was typed in it.
    expect(capture.mock.calls[0][1]).toMatchObject({ field: "q" });
    expect(JSON.stringify(capture.mock.calls[0][1])).not.toContain("google");
  });

  it("says nothing when the box and the state agree", () => {
    expect(formText(form('<input name="q" value="acme">'), "q", "acme")).toBe("acme");
    expect(capture).not.toHaveBeenCalled();
  });

  it("falls back when the form has no such field", () => {
    expect(formText(form('<input name="q" value="x">'), "missing", "state")).toBe("state");
  });

  it("falls back for a disabled field, which a form never submits", () => {
    expect(formText(form('<input name="q" value="x" disabled>'), "q", "state")).toBe("state");
  });

  it("keeps an empty box empty rather than falling back to a stale copy", () => {
    expect(formText(form('<input name="q" value="">'), "q", "stale")).toBe("");
  });
});
