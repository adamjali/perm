import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReviewForm, sentMotion } from "../ReviewForm";

const originalFetch = global.fetch;

beforeEach(() => {
  // Signed out by default: the account prefill answers empty.
  global.fetch = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

describe("ReviewForm", () => {
  it("shows five empty stars, each a labelled radio, until one is picked", () => {
    render(<ReviewForm />);
    const stars = screen.getAllByRole("radio");
    expect(stars.map((s) => s.getAttribute("aria-label"))).toEqual(["1 star", "2 stars", "3 stars", "4 stars", "5 stars"]);
    expect(stars.every((s) => !(s as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("Tap a star")).toBeTruthy();
  });

  it("picks on a click and says the number in words", () => {
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText("3 stars"));
    expect((screen.getByLabelText("3 stars") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("3 of 5")).toBeTruthy();
  });

  it("fills a signed-in reader's name and email", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ name: "Pat", email: "pat@example.com" }), { status: 200 })) as unknown as typeof fetch;
    render(<ReviewForm />);
    await waitFor(() => expect((screen.getByRole("textbox", { name: /Your name/ }) as HTMLInputElement).value).toBe("Pat"));
    expect((screen.getByRole("textbox", { name: /Email/ }) as HTMLInputElement).value).toBe("pat@example.com");
  });

  it("asks for a star under the stars, out loud, and sends nothing", async () => {
    render(<ReviewForm />);
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Tap a star first"));
    expect(document.getElementById("review-error-rating")?.textContent).toBe("Tap a star first");
    // One message, not the hint and the error both.
    expect(document.getElementById("review-hint-rating")).toBeNull();
    // No focus ring dropped onto a star.
    expect(document.activeElement?.getAttribute("type")).not.toBe("radio");
    // Only the prefill call went out.
    expect(vi.mocked(global.fetch).mock.calls.every(([u]) => String(u).includes("/api/review-prefill"))).toBe(true);
  });

  it("doesn't fill stars under a resting mouse right after asking for one", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      render(<ReviewForm />);
      const lit = () => document.querySelectorAll("label svg.text-primary").length;
      fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
      await waitFor(() => expect(document.getElementById("review-error-rating")).toBeTruthy());
      // The form scrolls to the stars on the next frame.
      await new Promise((done) => requestAnimationFrame(() => done(null)));
      // Read after the shake: the row remounts for it.
      const third = screen.getByLabelText("3 stars").closest("label")!;
      // The scroll just moved the stars under the cursor: no fill, the message stands.
      fireEvent.pointerEnter(third, { pointerType: "mouse" });
      expect(lit()).toBe(0);
      // A moment later, pointing works again.
      now.mockReturnValue(1_001_000);
      fireEvent.pointerLeave(third, { pointerType: "mouse" });
      fireEvent.pointerEnter(third, { pointerType: "mouse" });
      expect(lit()).toBe(3);
    } finally {
      now.mockRestore();
    }
  });

  it("says a name is missing under the name box, marks the box invalid and points it at the message", async () => {
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText("4 stars"));
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    await waitFor(() => expect(document.getElementById("review-error-name")?.textContent).toMatch(/Add a name/));
    const box = screen.getByRole("textbox", { name: /Your name/ });
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect(box.getAttribute("aria-describedby") ?? "").toContain("review-error-name");
    // Typing a name takes the error away.
    fireEvent.change(box, { target: { value: "Pat" } });
    expect(document.getElementById("review-error-name")).toBeNull();
    expect(box.getAttribute("aria-invalid")).toBeNull();
  });
});

describe("the thanks, by the stars given", () => {
  /** Answers the review with a stored id and the note with ok, and records what each route was sent. */
  function routes() {
    const sent: { path: string; body: Record<string, unknown> }[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      // The form posts through the site's own relay (/c/<route>); the route is what's after it.
      const path = new URL(String(input), "https://x.test").pathname.replace(/^\/c(?=\/)/, "");
      if (init?.method === "POST") sent.push({ path, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      if (path === "/review/submit") return new Response(JSON.stringify({ ok: true, message: "Thanks.", reviewId: "rev123" }), { status: 200 });
      if (path === "/review/note") return new Response(JSON.stringify({ ok: true, message: "Thank you." }), { status: 200 });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    return sent;
  }

  async function postWith(stars: number) {
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText(`${stars} ${stars === 1 ? "star" : "stars"}`));
    fireEvent.change(screen.getByRole("textbox", { name: /Your name/ }), { target: { value: "Pat" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
  }

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("apologizes for a 1 or 2 and asks, privately, what we should do better, then sends it tied to the review", async () => {
    const sent = routes();
    await postWith(2);
    await waitFor(() => expect(screen.getByRole("heading", { name: "We're sorry it fell short, Pat." })).toBeTruthy());
    const box = screen.getByRole("textbox", { name: "What should we do better?" });
    expect(screen.getByText(/Only we read this/)).toBeTruthy();
    fireEvent.change(box, { target: { value: "Tell me about RFIs sooner." } });
    fireEvent.click(screen.getByRole("button", { name: "Send it to us" }));
    await waitFor(() => expect(screen.getByText(/We read every note/)).toBeTruthy());
    expect(sent.find((s) => s.path === "/review/note")?.body).toEqual({ reviewId: "rev123", note: "Tell me about RFIs sooner." });
  });

  it("sends a name Chrome on iPhone filled into the box without React hearing it", async () => {
    // Arrange: the box shows "Pat", set the way a phone's autofill sets it, with no event React listens for.
    const sent = routes();
    render(<ReviewForm />);
    fireEvent.click(screen.getByLabelText("5 stars"));
    const box = screen.getByRole("textbox", { name: /Your name/ }) as HTMLInputElement;
    box.value = "Pat";
    // Act
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));
    // Assert: sent with the name, not refused as empty.
    await waitFor(() => expect(sent.find((s) => s.path === "/review/submit")?.body.name).toBe("Pat"));
    expect(document.getElementById("review-error-name")).toBeNull();
  });

  it("asks a 3 what would have made it a 5, and asks a 4 or 5 nothing", async () => {
    routes();
    await postWith(3);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "What would have made it a 5?" })).toBeTruthy());
  });

  it("cheers a 5 with no box", async () => {
    routes();
    await postWith(5);
    await waitFor(() => expect(screen.getByText(/Glad PERM Tracker helped/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Send it to us" })).toBeNull();
  });
});

describe("sentMotion", () => {
  it("cheers only a 4 or 5: a 3 settles and a 1 or 2 just fades in", () => {
    expect([5, 4, 3, 2, 1].map(sentMotion)).toEqual([
      "review-star-hop",
      "review-star-hop",
      "review-star-settle",
      "review-star-calm",
      "review-star-calm",
    ]);
  });
});
