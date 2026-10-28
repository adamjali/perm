import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { QueueTape } from "../QueueTape";

/**
 * The two flags, "DOL is here" and "You", were both positioned
 * `-top-7 left-1/2 -translate-x-1/2`. A flag is about 90px wide over a column
 * that can be 30px, so whenever the selected month sat near the frontier the
 * badges overlapped and neither was readable. Reported from a screenshot with
 * the two one month apart.
 */

const flags = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("span")).filter((s) =>
    /^(DOL is here|You)$/i.test((s.textContent ?? "").trim()),
  );

describe("QueueTape flag placement", () => {
  it("stacks the two flags on different rows when they are close", () => {
    const { container } = render(
      <QueueTape frontierMonth="2025-10" selectedMonth="2025-11" />,
    );
    const [dol, you] = flags(container).sort((a, b) =>
      (a.textContent ?? "").localeCompare(b.textContent ?? ""),
    );
    expect(dol?.className).toContain("-top-7");
    // "You" is raised a full row, so the two cannot occupy the same band.
    expect(you?.className).toContain("-top-14");
    expect(you?.className).not.toContain("-top-7 ");
  });

  it("leaves both on the same row when they are far apart", () => {
    const { container } = render(
      <QueueTape frontierMonth="2025-10" selectedMonth="2026-06" />,
    );
    for (const f of flags(container)) expect(f.className).toContain("-top-7");
  });

  it("reserves the taller headroom only when they collide", () => {
    const near = render(<QueueTape frontierMonth="2025-10" selectedMonth="2025-11" />);
    expect(near.container.querySelector(".pt-14")).not.toBeNull();
    const far = render(<QueueTape frontierMonth="2025-10" selectedMonth="2026-06" />);
    expect(far.container.querySelector(".pt-14")).toBeNull();
    expect(far.container.querySelector(".pt-7")).not.toBeNull();
  });

  it("does not raise anything when no month is selected", () => {
    const { container } = render(<QueueTape frontierMonth="2025-10" />);
    expect(container.querySelector(".pt-14")).toBeNull();
  });
});

describe("QueueTape in a translated page", () => {
  it("draws its flags, ticks and key in the page's language", () => {
    const { container } = render(<QueueTape frontierMonth="2025-10" selectedMonth="2026-06" lang="ko" />);
    const text = container.textContent ?? "";
    expect(text).toContain("노동부 위치");
    expect(text).toContain("내 케이스");
    expect(text).toContain("처리됨");
    expect(text).toContain("25년 10월");
    expect(text).not.toMatch(/DOL is here|Still pending/);
    const tip = container.querySelector('[data-href="/perm-queue/2026-06"]')?.getAttribute("data-tip");
    expect(tip).toBe("2026년 6월\n노동부의 위치보다 8개월 뒤\n내 접수 월");
  });
});
