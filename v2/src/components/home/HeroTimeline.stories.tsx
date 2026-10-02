import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { TimelineGrid, type TimelineCaseData } from "@/components/timeline/TimelineGrid";
import { TimelineLegendCompact } from "@/components/timeline/TimelineLegend";
import { TourConvex } from "@/components/tour/fakeConvex";
import fixtures from "@/components/tour/tour-fixtures.json";

/**
 * The app's real case timeline over the sample firm the other tour pictures
 * show (src/components/tour/). It is the source of the attorney page's hero
 * image; scripts/tour_shots.py says how the captures are taken and encoded.
 */

const CASES = Object.entries(fixtures)
  .filter(([key]) => key.startsWith("cases:get "))
  .map(([, doc]) => ({ ...(doc as object), id: (doc as { _id: string })._id }) as unknown as TimelineCaseData)
  .filter((c) => c.caseStatus !== "closed");

const meta = {
  title: "Home/Attorney hero timeline",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const HeroTimeline: Story = {
  name: "Hero timeline",
  render: () => (
    <TourConvex>
      <div id="hero-capture" className="w-[1180px] bg-background p-5">
        <TimelineLegendCompact className="mb-3" />
        <TimelineGrid cases={CASES} timeRange={12} rowHeight={56} />
      </div>
    </TourConvex>
  ),
};

/** The phone crop: six months around today, so the names and the bars both fit. */
export const HeroTimelinePhone: Story = {
  name: "Hero timeline, phone",
  render: () => (
    <TourConvex>
      <div id="hero-capture" className="w-[600px] bg-background p-4">
        <TimelineLegendCompact className="mb-3" />
        <TimelineGrid cases={CASES} timeRange={6} rowHeight={56} />
      </div>
    </TourConvex>
  ),
};
