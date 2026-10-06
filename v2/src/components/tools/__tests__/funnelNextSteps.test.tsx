import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

/**
 * The next steps that turn a page into a way to someone's own case: the
 * case-number block on entity pages and articles, the calculator's buttons,
 * the month page's alert, and the events that let the funnel be counted.
 */

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", () => ({ analytics: { capture } }));

const { CaseNextStep } = await import("../CaseNextStep");
const { CaseLookupForm } = await import("../CaseLookupForm");
const { PermTimelineEstimator } = await import("../PermTimelineEstimator");
const { trackAlertSignup } = await import("@/lib/alertSignupEvent");
const ContentCTA = (await import("@/components/content/ContentCTA")).default;
const { QueueAlertForm } = await import("@/app/(site)/(public)/perm-processing-times/QueueAlertForm");

const ROOT = join(__dirname, "..", "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

beforeEach(() => capture.mockReset());

describe("CaseNextStep", () => {
  it("asks in the page's terms and sends the number to the case page", () => {
    const { container } = render(
      <CaseNextStep
        question="Waiting on a case with Adobe Inc.?"
        searchHref="/case-search?q=Adobe%20Inc."
        searchLabel="Find it among their filings"
        extra={{ href: "#follow", label: "Or follow this employer by email" }}
        source="employer-page"
      />,
    );
    expect(screen.getByRole("heading", { name: "Waiting on a case with Adobe Inc.?" })).toBeInTheDocument();
    const form = container.querySelector("form")!;
    expect(form.getAttribute("action")).toBe("/perm-case-status");
    expect(form.getAttribute("method")).toBe("get");
    // The label is still there for screen readers, just not shown twice.
    expect(screen.getByLabelText("Your PERM case number")).toHaveAttribute("name", "case");
    expect(screen.getByRole("link", { name: "Find it among their filings" })).toHaveAttribute(
      "href",
      "/case-search?q=Adobe%20Inc.",
    );
    expect(screen.getByRole("link", { name: "Or follow this employer by email" })).toHaveAttribute("href", "#follow");
  });

  it("records which page sent the lookup, and nothing else about it", () => {
    const { container } = render(<CaseNextStep question="Waiting on a PERM case?" source="article-end" />);
    fireEvent.submit(container.querySelector("form")!);
    expect(capture).toHaveBeenCalledWith("case_lookup_submitted", { source: "article-end" });
  });

  it("leaves the plain lookup form quiet when no page is named", () => {
    const { container } = render(<CaseLookupForm />);
    fireEvent.submit(container.querySelector("form")!);
    expect(capture).not.toHaveBeenCalled();
  });
});

describe("the end of every article", () => {
  it("leads with the case lookup and sends people who file cases to the attorney page, not straight to sign-up", () => {
    const { container } = render(<ContentCTA />);
    expect(container.querySelector('form[action="/perm-case-status"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: /free deadline tracker/ })).toHaveAttribute("href", "/for-attorneys");
    expect(container.querySelector('a[href="/signup"]')).toBeNull();
  });
});

describe("entity pages put the next step before their figures", () => {
  it.each([
    ["src/app/(site)/(public)/perm-employers/[slug]/page.tsx", "<EntityStatCards"],
    ["src/app/(site)/(public)/perm-attorneys/[slug]/page.tsx", "<EntityStatCards"],
  ])("%s", (file, figures) => {
    const src = read(file);
    expect(src.indexOf("<CaseNextStep")).toBeGreaterThan(-1);
    expect(src.indexOf("<CaseNextStep")).toBeLessThan(src.indexOf(figures));
    // The old bottom card only pointed at the calculator.
    expect(src).not.toContain("DecisionEstimatorCard");
  });

  it("gives the live-only and the other-employer pages one too", () => {
    const src = read("src/app/(site)/(public)/perm-employers/[slug]/page.tsx");
    expect(src.match(/<CaseNextStep/g)).toHaveLength(3);
  });
});

describe("the calculator's answer", () => {
  const FRONTIER = { analystQueueMonth: "2025-09", officialAvgDays: 372, asOf: "2026-08-20" };
  const renderEstimator = (extra: Record<string, unknown> = {}) =>
    render(
      <PermTimelineEstimator
        initialMonth="2025-12"
        frontier={FRONTIER}
        cohorts={[]}
        frontierAdvance={null}
        disclosure={null}
        today="2026-08-26"
        {...extra}
      />,
    );

  it("is followed by an email button for the month and a way to the case itself", () => {
    renderEstimator({ alertAnchor: "queue-alert" });
    expect(screen.getByRole("link", { name: /Email me when DOL reaches December 2025/ })).toHaveAttribute(
      "href",
      "#queue-alert",
    );
    expect(screen.getByRole("link", { name: /Check the case itself/ })).toHaveAttribute("href", "/perm-case-status");
  });

  it("offers no email button where the page has no alert form", () => {
    renderEstimator();
    expect(screen.queryByRole("link", { name: /Email me when DOL reaches/ })).toBeNull();
  });
});

describe("the queue alert on a month's page", () => {
  it("starts on that month", () => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://test.convex.cloud");
    render(<QueueAlertForm source="queue-month-page" newestMonth="2026-10" defaultMonth="2026-02" />);
    const select = document.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("2026-02");
    vi.unstubAllEnvs();
  });

  it("is offered on a month page only while DOL hasn't reached the month", () => {
    const src = read("src/app/(site)/(public)/perm-queue/[month]/page.tsx");
    expect(src).toMatch(/const awaitingDol = dolMonth !== null && month > dolMonth;/);
    expect(src).toMatch(/\{awaitingDol \? \(\s*<section id="queue-alert"/);
  });
});

describe("alert sign-up events", () => {
  it("say which alert and how it went, never the address", () => {
    trackAlertSignup("case", "accepted", { program: "perm", status: 200 });
    expect(capture).toHaveBeenCalledWith("alert_signup", { kind: "case", outcome: "accepted", program: "perm", status: 200 });
    const props = capture.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(props)).not.toContain("email");
  });

  it("are sent by every alert form", () => {
    for (const [file, kind] of [
      ["src/components/tools/CaseAlertForm.tsx", "case"],
      ["src/app/(site)/(public)/perm-processing-times/QueueAlertForm.tsx", "queue"],
      ["src/components/tools/BulletinAlertForm.tsx", "bulletin"],
      ["src/components/employers/EmployerFollowForm.tsx", "employer"],
    ] as const) {
      const src = read(file);
      expect(src, file).toContain(`trackAlertSignup("${kind}", `);
    }
  });
});
