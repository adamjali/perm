import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ analytics: { capture } }));

import { MonthShareBlock, embedCode } from "../MonthShareBlock";

const ALT = 'PERM applications filed in February 2026: 41% have a decision, "8,200" of 20,000.';

describe("MonthShareBlock", () => {
  const writeText = vi.fn();
  const write = vi.fn();
  const realClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  beforeEach(() => {
    capture.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    write.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText, write } });
  });
  afterEach(() => {
    if (realClipboard) Object.defineProperty(navigator, "clipboard", realClipboard);
    vi.unstubAllGlobals();
  });

  it("shows the month's picture with every figure in its alt text, and a way to save it", () => {
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toBe("/perm-queue/2026-02/share.png");
    expect(img.getAttribute("alt")).toBe(ALT);
    const save = screen.getByRole("link", { name: /save picture/i });
    expect(save.getAttribute("href")).toBe("/perm-queue/2026-02/share.png");
    expect(save.getAttribute("download")).toBe("perm-2026-02.png");
    expect(screen.getByRole("heading", { level: 2, name: "Share February 2026" })).toBeTruthy();
  });

  it("copies the page's link, not the picture's, and says so", async () => {
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/\/perm-queue\/2026-02$/));
    expect(screen.getByRole("status").textContent).toBe("Link to February 2026 copied.");
    expect(capture).toHaveBeenCalledWith("month_share", { action: "link", month: "2026-02" });
  });

  it("copies an embed that links back, with the alt text safe inside its attribute", async () => {
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    await userEvent.click(screen.getByRole("button", { name: /copy embed code/i }));
    const code = writeText.mock.calls[0]?.[0] as string;
    expect(code).toBe(embedCode("2026-02", ALT));
    expect(code).toMatch(/^<a href="[^"]*\/perm-queue\/2026-02"><img src="[^"]*\/perm-queue\/2026-02\/share\.png" width="600" height="315" alt="[^"]*"><\/a>$/);
    expect(code).toContain("&quot;8,200&quot;");
  });

  it("copies the picture itself where the browser can", async () => {
    vi.stubGlobal("ClipboardItem", class { constructor(public items: Record<string, unknown>) {} });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Blob(["png"]), { status: 200 })));
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    await userEvent.click(screen.getByRole("button", { name: /copy picture/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Picture copied. Paste it into a chat or a post."));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("says plainly when a browser can't copy a picture, and records no share", async () => {
    vi.stubGlobal("ClipboardItem", undefined);
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    await userEvent.click(screen.getByRole("button", { name: /copy picture/i }));
    expect(screen.getByRole("status").textContent).toBe("This browser can't copy pictures. Save it instead.");
    expect(capture).not.toHaveBeenCalled();
  });

  it("puts the embed code in a box to select when the browser won't copy it", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<MonthShareBlock month="2026-02" label="February 2026" alt={ALT} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /copy embed code/i }));
    expect((screen.getByRole("textbox", { name: /embed code/i }) as HTMLTextAreaElement).value).toBe(embedCode("2026-02", ALT));
  });
});
