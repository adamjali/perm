import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SummaryTile, { type CornerVariant } from "./SummaryTile";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * SummaryTilesGrid - Grid layout for dashboard summary tiles.
 *
 * Note: The actual SummaryTilesGrid component uses Convex for data.
 * This story demonstrates the grid layout with static data.
 *
 * Features:
 * - Responsive grid: 2 columns on mobile, 3 on tablet, 6 on desktop
 * - Loading skeleton state
 * - Color-coded tiles for each case stage
 * - Corner variant options: "none", "solid", "bar", or "tag"
 */
const meta = {
  title: "Dashboard/SummaryTilesGrid",
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

// Mock data with perm_flow.md subtext format
const mockData = {
  pwd: { count: 12, subtext: "8 working, 4 filed" },
  recruitment: { count: 8, subtext: "3 ready, 5 in progress" },
  eta9089: { count: 5, subtext: "2 prep, 1 RFI, 2 filed" },
  i140: { count: 15, subtext: "5 prep, 2 RFE, 8 filed" },
  complete: { count: 42, subtext: "I-140 Approved" },
  closed: { count: 3, subtext: "Archived" },
};

/** Helper to render grid with specified corner variant */
function renderGrid(cornerVariant: CornerVariant = "none") {
  return (
    <div className="max-w-4xl">
      <h2 className="font-heading text-2xl font-bold mb-6">Case Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryTile status="pwd" label="PWD" count={mockData.pwd.count} subtext={mockData.pwd.subtext} href="/cases?status=pwd" cornerVariant={cornerVariant} />
        <SummaryTile status="recruitment" label="Recruitment" count={mockData.recruitment.count} subtext={mockData.recruitment.subtext} href="/cases?status=recruitment" cornerVariant={cornerVariant} />
        <SummaryTile status="eta9089" label="ETA 9089" count={mockData.eta9089.count} subtext={mockData.eta9089.subtext} href="/cases?status=eta9089" cornerVariant={cornerVariant} />
        <SummaryTile status="i140" label="I-140" count={mockData.i140.count} subtext={mockData.i140.subtext} href="/cases?status=i140" cornerVariant={cornerVariant} />
        <SummaryTile status="complete" label="Complete" count={mockData.complete.count} subtext={mockData.complete.subtext} href="/cases?status=complete" cornerVariant={cornerVariant} />
        <SummaryTile status="closed" label="Closed" count={mockData.closed.count} subtext={mockData.closed.subtext} href="/cases?status=closed" cornerVariant={cornerVariant} />
      </div>
    </div>
  );
}

/** Grid with no corner decoration (default). */
export const WithData: Story = {
  render: () => renderGrid("none"),
};

/** Grid with solid color corners. */
export const WithSolidCorner: Story = {
  render: () => renderGrid("solid"),
};

/** Grid with full-width bar labels. */
export const WithBarCorner: Story = {
  render: () => renderGrid("bar"),
};

/** Grid with small tag badges. */
export const WithTagCorner: Story = {
  render: () => renderGrid("tag"),
};

/** Loading state - skeleton placeholders. */
export const Loading: Story = {
  render: () => (
    <div className="max-w-4xl">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
    </div>
  ),
};

/** Empty state - all tiles show zero count. */
export const Empty: Story = {
  render: () => (
    <div className="max-w-4xl">
      <h2 className="font-heading text-2xl font-bold mb-6">Case Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryTile status="pwd" label="PWD" count={0} subtext="0 working" href="/cases?status=pwd" />
        <SummaryTile status="recruitment" label="Recruitment" count={0} subtext="0 ready" href="/cases?status=recruitment" />
        <SummaryTile status="eta9089" label="ETA 9089" count={0} subtext="0 prep" href="/cases?status=eta9089" />
        <SummaryTile status="i140" label="I-140" count={0} subtext="0 prep" href="/cases?status=i140" />
        <SummaryTile status="complete" label="Complete" count={0} subtext="I-140 Approved" href="/cases?status=complete" />
        <SummaryTile status="closed" label="Closed" count={0} subtext="Archived" href="/cases?status=closed" />
      </div>
    </div>
  ),
};
