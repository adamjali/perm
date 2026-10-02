import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { TimelineGrid, type TimelineCaseData } from "./TimelineGrid";
import { TimelineControls } from "./TimelineControls";
import { TimelineLegendCompact } from "./TimelineLegend";
import { InlineCaseTimeline } from "@/components/cases/detail/InlineCaseTimeline";
import type { Id } from "@convex/_generated/dataModel";

/**
 * The timeline page and the case page's timeline with cases shaped like real
 * ones: dates days apart (markers that used to cover each other), names too
 * long for the label column, dates outside the range, and cases with nothing
 * in range. Built for QA at phone and desktop widths (Sep 30 2026); the pages
 * themselves need a signed-in session.
 */

const d = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");
const id = (n: number) => `case_${n}` as Id<"cases">;

function makeCase(n: number, name: string, title: string, dates: Partial<TimelineCaseData>): TimelineCaseData {
  return {
    id: id(n),
    employerName: name,
    positionTitle: title,
    caseStatus: "eta9089",
    progressStatus: "working",
    rfiEntries: [],
    rfeEntries: [],
    ...dates,
  };
}

const CASES: TimelineCaseData[] = [
  // Everything in the last year, several dates days apart.
  makeCase(1, "testtesttestestestestest", "testtesttesttest senior engineer", {
    caseStatus: "recruitment",
    pwdFilingDate: d(-330),
    pwdDeterminationDate: d(-325),
    pwdExpirationDate: d(-20),
    jobOrderStartDate: d(-300),
    jobOrderEndDate: d(-270),
    sundayAdFirstDate: d(-298),
    sundayAdSecondDate: d(-291),
  }),
  // A whole case, filed through I-140, with clustered milestones.
  makeCase(2, "1", "1", {
    caseStatus: "i140",
    pwdFilingDate: d(-360),
    pwdDeterminationDate: d(-300),
    pwdExpirationDate: d(40),
    jobOrderStartDate: d(-290),
    jobOrderEndDate: d(-259),
    sundayAdFirstDate: d(-285),
    sundayAdSecondDate: d(-278),
    eta9089FilingDate: d(-200),
    eta9089CertificationDate: d(-12),
    eta9089ExpirationDate: d(167),
    i140FilingDate: d(-5),
  }),
  // Nothing in any range: the "no dates" note.
  makeCase(3, "Test Tech Solutions International Holdings", "Software Engineer II, Platform", {}),
  makeCase(4, "RFI Test Company", "Senior Software Developer", {}),
  // An open RFI next to its filing.
  makeCase(5, "Active RFI Corporation", "Data Scientist", {
    eta9089FilingDate: d(-60),
    rfiEntries: [
      {
        id: "rfi1",
        title: "Audit",
        receivedDate: d(-20),
        responseDueDate: d(10),
        createdAt: Date.now(),
      },
    ],
  }),
  // Dates only far in the past, then only far in the future.
  makeCase(6, "Test Deadline Enterprises", "Software Engineering Manager", {
    pwdFilingDate: d(-900),
    pwdDeterminationDate: d(-860),
    pwdExpirationDate: d(-400),
  }),
  makeCase(7, "Final Calendar Sync LLC", "Test Engineer", { eta9089ExpirationDate: d(700) }),
  // Three dates within a week of each other.
  makeCase(8, "Log Test Company", "Software Engineer", {
    pwdFilingDate: d(-40),
    pwdDeterminationDate: d(-38),
    jobOrderStartDate: d(-36),
    jobOrderEndDate: d(-6),
    sundayAdFirstDate: d(-35),
    sundayAdSecondDate: d(-34),
  }),
];

function TimelinePage({ cases }: { cases: TimelineCaseData[] }) {
  const [timeRange, setTimeRange] = useState<3 | 6 | 12 | 24>(24);
  const [zoom, setZoom] = useState(100);
  const months = Math.max(1, Math.min(48, Math.round(timeRange * (100 / zoom))));
  return (
    <div className="flex flex-col">
      <div className="mb-4 sm:mb-6">
        <TimelineControls
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          onOpenCaseSelector={() => {}}
          caseCount={cases.length}
          zoomLevel={zoom}
          onZoomChange={setZoom}
          eyebrow={`${cases.length} cases displayed`}
        />
      </div>
      <TimelineLegendCompact className="mb-3" />
      <TimelineGrid cases={cases} timeRange={months} rowHeight={cases.length > 10 ? 48 : 56} />
    </div>
  );
}

const meta = {
  title: "Timeline/QA",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const TimelinePageStory: Story = {
  name: "Timeline page",
  render: () => <TimelinePage cases={CASES} />,
};

export const CaseTimeline: Story = {
  name: "Case page timeline",
  render: () => (
    <div className="max-w-4xl">
      <InlineCaseTimeline caseData={CASES[1]!} />
    </div>
  ),
};

export const CaseTimelineClustered: Story = {
  name: "Case page timeline, clustered dates",
  render: () => (
    <div className="max-w-4xl">
      <InlineCaseTimeline caseData={CASES[7]!} />
    </div>
  ),
};
