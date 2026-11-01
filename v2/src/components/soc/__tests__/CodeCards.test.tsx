import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeCards } from "../CodeCards";
import type { CodeSummary } from "@/lib/db/reference";
import type { TitleCode } from "@/lib/socFinder";

const code = (soc: string, filings: number): TitleCode => ({
  soc, codeTitle: `Title ${soc}`, filings, share: null, perm: filings, pwd: 0, lca: 0, onet: true, slug: null, zone: 4,
  spellings: [], becameCodes: [],
});
const summary = (soc: string): CodeSummary => ({
  soc, onetCode: `${soc}.00`, title: `Title ${soc}`, description: `What ${soc} does.`, tasks: [`Task of ${soc}`],
  jobZone: 2, zoneLabel: "1-2", zoneName: "Very little to some preparation needed",
});

describe("CodeCards", () => {
  it("sets the most-filed described codes side by side and folds the rest", () => {
    const codes = ["11-1011", "11-1021", "11-2011", "11-2021", "11-2022", "11-3011"].map((s, i) => code(s, 600 - i * 100));
    const summaries = new Map(codes.filter((c) => c.soc !== "11-2011").map((c) => [c.soc, summary(c.soc)]));
    const { container } = render(
      <CodeCards title="Manager" codes={codes} summaries={summaries} total={2100} payOf={new Map([["11-1011", 120000]])} />,
    );
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("What each code covers");
    // 11-2011 has no description and gets no card; four show, one folds.
    expect(container.querySelectorAll("article")).toHaveLength(5);
    expect(container.querySelectorAll("details article")).toHaveLength(1);
    expect(container.textContent).not.toContain("What 11-2011 does.");
    expect(container.textContent).toContain("Job Zone 1-2: Very little to some preparation needed");
    expect(container.textContent).toContain("BLS median $120,000 a year");
    expect(container.querySelector("summary")?.textContent).toBe("1 more code, 4.8% of filings or fewer each");
    expect(container.textContent).toContain("CC BY 4.0 license");
  });

  it("names the one code when there is one, and nothing when none is described", () => {
    const one = render(<CodeCards title="Nurse" codes={[code("29-1141", 90)]} summaries={new Map([["29-1141", summary("29-1141")]])} total={90} payOf={new Map()} />);
    expect(one.getByRole("heading", { level: 2 }).textContent).toBe("What 29-1141 covers");
    expect(one.container.querySelector("details")).toBeNull();
    one.unmount();
    const none = render(<CodeCards title="Nurse" codes={[code("29-1141", 90)]} summaries={new Map()} total={90} payOf={new Map()} />);
    expect(none.container.innerHTML).toBe("");
  });
});
