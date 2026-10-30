import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";

import { CaseEstimateSection, type CaseEstimateSectionCase } from "./CaseEstimateSection";
import { CaseCorpusProvider } from "@/components/app/CaseCorpusProvider";
import { TourConvex } from "@/components/tour/fakeConvex";
import type { AppCaseCorpus } from "@/lib/db/appCaseCorpus";
import type { Id } from "@convex/_generated/dataModel";

/**
 * The DOL live-status + estimate block on a saved case. Rendered here against a
 * hand-built corpus (the real one is a server-only mirror read) and the fake
 * Convex provider the tour uses, so the watch toggle's mutation is a no-op.
 */
const CORPUS: AppCaseCorpus = {
  backlog: [
    { month: "2025-06", total: 14000, pending: 200, decided: 13800, decidedPct: 0.99, analystReview: 150 },
    { month: "2025-12", total: 18000, pending: 9000, decided: 9000, decidedPct: 0.5, analystReview: 8000 },
    { month: "2026-01", total: 17000, pending: 14000, decided: 3000, decidedPct: 0.18, analystReview: 13000 },
  ],
  estimator: {
    frontier: { analystQueueMonth: "2025-12", officialAvgDays: 336, asOf: "2026-10-28" },
    cohorts: [],
    frontierHistory: [],
    frontierAdvance: { rate: 1, fromMonth: "2025-06", toMonth: "2025-12", pointsUsed: 6, slowest: 0.5, fastest: 1.5 },
    disclosure: null,
  },
  decisionPace: { pace: 620, fast: 780, slow: 480, weekdayMean: 790, weekendMean: 210, weekdaysUsed: 20, daysUsed: 28 },
  sweepFinishedOn: "2026-10-28",
  stragglers: null,
  rangeCoverage: null,
  rfiClock: null,
  byDay: null,
  stageStats: null,
  pwdDay: {
    queue: {
      asOf: "2026-10-28",
      byDay: [
        ["2026-09-01", 500],
        ["2026-09-15", 400],
        ["2026-10-01", 300],
      ],
      pace: { perWorkday: 250, fast: 300, slow: 200, workdaysUsed: 20 },
    },
    measuredRange: [],
    tested: null,
  },
};

const BASE: CaseEstimateSectionCase = {
  _id: "case_fixture_1" as unknown as Id<"cases">,
  caseNumber: "G-100-26015-123456", // decodes to a 2026-01 filing
  caseStatus: "recruitment",
  liveStatus: "ANALYST REVIEW",
  liveStatusSeenAt: Date.parse("2026-10-28T10:00:00Z"),
  liveStatusIsFinal: false,
  watchEnabled: true,
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <TourConvex>
      <CaseCorpusProvider corpus={CORPUS}>
        <div className="mx-auto max-w-[1300px] bg-tint p-6">{children}</div>
      </CaseCorpusProvider>
    </TourConvex>
  );
}

const meta: Meta<typeof CaseEstimateSection> = {
  title: "App/CaseEstimateSection",
  component: CaseEstimateSection,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <Frame><Story /></Frame>],
};
export default meta;

type Story = StoryObj<typeof CaseEstimateSection>;

/** In analyst review: DOL's status, the firm's stage beside it, and the estimate. */
export const AnalystReview: Story = { args: { caseData: BASE } };

/** A final decision: the dot goes lime and the estimate yields to the outcome. */
export const Certified: Story = {
  args: { caseData: { ...BASE, liveStatus: "CERTIFIED", liveStatusIsFinal: true } },
};

/** Watched, but DOL has not been seen yet (a recent filing outside the mirror). */
export const NotSeenYet: Story = {
  args: { caseData: { ...BASE, liveStatus: null, liveStatusSeenAt: null, liveStatusIsFinal: null } },
};

/** The watch is off for this case. */
export const WatchOff: Story = {
  args: { caseData: { ...BASE, liveStatus: null, watchEnabled: false } },
};

/** No DOL case number, but a PERM filing date: the estimate still works, off the date. */
export const FromDatesNoNumber: Story = {
  args: {
    caseData: {
      ...BASE,
      caseNumber: null,
      liveStatus: null,
      liveStatusSeenAt: null,
      liveStatusIsFinal: null,
      eta9089FilingDate: "2026-01-20",
    },
  },
};

/** At the PWD step with only a wage-request filing date: the determination estimate. */
export const PwdStep: Story = {
  args: {
    caseData: {
      ...BASE,
      caseNumber: null,
      caseStatus: "pwd",
      liveStatus: null,
      liveStatusSeenAt: null,
      liveStatusIsFinal: null,
      pwdFilingDate: "2026-10-10",
    },
  },
};

/** No DOL case number and no filing dates: the block renders nothing. */
export const NoCaseNumber: Story = {
  args: { caseData: { ...BASE, caseNumber: null, liveStatus: null } },
};
