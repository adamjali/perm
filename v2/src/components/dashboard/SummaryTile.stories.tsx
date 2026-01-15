import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import SummaryTile from "./SummaryTile";

/**
 * SummaryTile - Dashboard summary tile showing case counts by stage.
 *
 * Features:
 * - Color-coded by case stage (PWD, Recruitment, ETA 9089, I-140, Complete, Closed)
 * - Optional corner decoration (none, solid, bar, or tag)
 * - Expanding underline on hover (StageProgression effect)
 * - Text color changes to stage color on hover
 * - Neobrutalist styling with hard shadows
 * - Dark mode compatible (uses theme-aware colors)
 * - Links to filtered case list
 *
 * Corner Variants:
 * - "none" (default): No corner decoration
 * - "solid": Small color square in top-right corner (no text)
 * - "bar": Full-width stage label bar at top
 * - "tag": Small pill badge in top-right corner with stage name
 */
const meta = {
  title: "Dashboard/SummaryTile",
  component: SummaryTile,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["pwd", "recruitment", "eta9089", "i140", "complete", "closed"],
      description: "Case stage status for color coding",
    },
    count: {
      control: { type: "number", min: 0 },
      description: "Number of cases in this status",
    },
    label: {
      control: "text",
      description: "Display label for the status",
    },
    subtext: {
      control: "text",
      description: "Additional context text",
    },
    href: {
      control: "text",
      description: "Link destination when clicked",
    },
    cornerVariant: {
      control: "select",
      options: ["none", "solid", "bar", "tag"],
      description: "Corner decoration style",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-48">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SummaryTile>;

export default meta;
type Story = StoryObj<typeof meta>;

// =============================================================================
// INDIVIDUAL STAGE STORIES
// =============================================================================

/** PWD stage tile (blue). */
export const PWD: Story = {
  args: {
    status: "pwd",
    label: "PWD",
    count: 12,
    subtext: "8 working, 4 filed",
    href: "/cases?status=pwd",
  },
};

/** Recruitment stage tile (purple). */
export const Recruitment: Story = {
  args: {
    status: "recruitment",
    label: "Recruitment",
    count: 8,
    subtext: "3 ready, 5 in progress",
    href: "/cases?status=recruitment",
  },
};

/** ETA 9089 stage tile (orange). */
export const ETA9089: Story = {
  args: {
    status: "eta9089",
    label: "ETA 9089",
    count: 5,
    subtext: "2 prep, 1 RFI, 2 filed",
    href: "/cases?status=eta9089",
  },
};

/** I-140 stage tile (green). */
export const I140: Story = {
  args: {
    status: "i140",
    label: "I-140",
    count: 15,
    subtext: "5 prep, 2 RFE, 8 filed",
    href: "/cases?status=i140",
  },
};

/** Complete cases tile (green). */
export const Complete: Story = {
  args: {
    status: "complete",
    label: "Complete",
    count: 42,
    subtext: "I-140 Approved",
    href: "/cases?status=complete",
  },
};

/** Closed cases tile (gray). */
export const Closed: Story = {
  args: {
    status: "closed",
    label: "Closed",
    count: 3,
    subtext: "Archived",
    href: "/cases?status=closed",
  },
};

// =============================================================================
// CORNER VARIANT COMPARISON
// =============================================================================

/** No corner decoration (clean look). */
export const CornerNone: Story = {
  args: {
    status: "recruitment",
    label: "Recruitment",
    count: 8,
    subtext: "3 ready, 5 in progress",
    href: "/cases?status=recruitment",
    cornerVariant: "none",
  },
};

/** Solid color square in top-right corner. */
export const CornerSolid: Story = {
  args: {
    status: "recruitment",
    label: "Recruitment",
    count: 8,
    subtext: "3 ready, 5 in progress",
    href: "/cases?status=recruitment",
    cornerVariant: "solid",
  },
};

/** Full-width bar at top with stage label. */
export const CornerBar: Story = {
  args: {
    status: "recruitment",
    label: "Recruitment",
    count: 8,
    subtext: "3 ready, 5 in progress",
    href: "/cases?status=recruitment",
    cornerVariant: "bar",
  },
};

/** Small pill badge in top-right with stage name. */
export const CornerTag: Story = {
  args: {
    status: "recruitment",
    label: "Recruitment",
    count: 8,
    subtext: "3 ready, 5 in progress",
    href: "/cases?status=recruitment",
    cornerVariant: "tag",
  },
};

// =============================================================================
// ALL STAGES GRID (for visual comparison)
// =============================================================================

/** All 6 stages - no corner decoration. */
export const AllStagesNone: Story = {
  decorators: [(Story) => <div className="w-[500px]"><Story /></div>],
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile status="pwd" label="PWD" count={12} subtext="8 working" href="#" cornerVariant="none" />
      <SummaryTile status="recruitment" label="Recruitment" count={8} subtext="3 ready" href="#" cornerVariant="none" />
      <SummaryTile status="eta9089" label="ETA 9089" count={5} subtext="2 prep" href="#" cornerVariant="none" />
      <SummaryTile status="i140" label="I-140" count={15} subtext="5 prep" href="#" cornerVariant="none" />
      <SummaryTile status="complete" label="Complete" count={42} subtext="Approved" href="#" cornerVariant="none" />
      <SummaryTile status="closed" label="Closed" count={3} subtext="Archived" href="#" cornerVariant="none" />
    </div>
  ),
};

/** All 6 stages - solid corner. */
export const AllStagesSolid: Story = {
  decorators: [(Story) => <div className="w-[500px]"><Story /></div>],
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile status="pwd" label="PWD" count={12} subtext="8 working" href="#" cornerVariant="solid" />
      <SummaryTile status="recruitment" label="Recruitment" count={8} subtext="3 ready" href="#" cornerVariant="solid" />
      <SummaryTile status="eta9089" label="ETA 9089" count={5} subtext="2 prep" href="#" cornerVariant="solid" />
      <SummaryTile status="i140" label="I-140" count={15} subtext="5 prep" href="#" cornerVariant="solid" />
      <SummaryTile status="complete" label="Complete" count={42} subtext="Approved" href="#" cornerVariant="solid" />
      <SummaryTile status="closed" label="Closed" count={3} subtext="Archived" href="#" cornerVariant="solid" />
    </div>
  ),
};

/** All 6 stages - bar at top. */
export const AllStagesBar: Story = {
  decorators: [(Story) => <div className="w-[500px]"><Story /></div>],
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile status="pwd" label="PWD" count={12} subtext="8 working" href="#" cornerVariant="bar" />
      <SummaryTile status="recruitment" label="Recruitment" count={8} subtext="3 ready" href="#" cornerVariant="bar" />
      <SummaryTile status="eta9089" label="ETA 9089" count={5} subtext="2 prep" href="#" cornerVariant="bar" />
      <SummaryTile status="i140" label="I-140" count={15} subtext="5 prep" href="#" cornerVariant="bar" />
      <SummaryTile status="complete" label="Complete" count={42} subtext="Approved" href="#" cornerVariant="bar" />
      <SummaryTile status="closed" label="Closed" count={3} subtext="Archived" href="#" cornerVariant="bar" />
    </div>
  ),
};

/** All 6 stages - tag badge (design4 style). */
export const AllStagesTag: Story = {
  decorators: [(Story) => <div className="w-[500px]"><Story /></div>],
  render: () => (
    <div className="grid grid-cols-3 gap-3">
      <SummaryTile status="pwd" label="PWD" count={12} subtext="8 working" href="#" cornerVariant="tag" />
      <SummaryTile status="recruitment" label="Recruitment" count={8} subtext="3 ready" href="#" cornerVariant="tag" />
      <SummaryTile status="eta9089" label="ETA 9089" count={5} subtext="2 prep" href="#" cornerVariant="tag" />
      <SummaryTile status="i140" label="I-140" count={15} subtext="5 prep" href="#" cornerVariant="tag" />
      <SummaryTile status="complete" label="Complete" count={42} subtext="Approved" href="#" cornerVariant="tag" />
      <SummaryTile status="closed" label="Closed" count={3} subtext="Archived" href="#" cornerVariant="tag" />
    </div>
  ),
};
