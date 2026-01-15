/**
 * HazardStripes Component Stories
 * Visual reference for diagonal warning stripes
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import HazardStripes from "./hazard-stripes";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

const meta: Meta<typeof HazardStripes> = {
  title: "UI/HazardStripes",
  component: HazardStripes,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof HazardStripes>;

export const Footer: Story = {
  args: {
    variant: "footer",
  },
  decorators: [
    (Story) => (
      <div className="w-[400px]">
        <Card>
          <CardHeader>
            <CardTitle>Overdue Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This deadline has passed. Hazard stripes indicate urgency.
            </p>
          </CardContent>
          <Story />
        </Card>
      </div>
    ),
  ],
};

export const Badge: Story = {
  args: {
    variant: "badge",
  },
  decorators: [
    (Story) => (
      <div className="inline-flex flex-col gap-2">
        <div className="flex items-center gap-2 border-2 border-black bg-white p-2 shadow-hard">
          <span className="mono text-xs font-bold">OVERDUE</span>
          <Story />
        </div>
      </div>
    ),
  ],
};

export const Full: Story = {
  args: {
    variant: "full",
  },
  decorators: [
    (Story) => (
      <div className="h-32 w-[400px] border-2 border-black">
        <Story />
      </div>
    ),
  ],
};

export const CustomSize: Story = {
  args: {
    className: "h-4",
  },
  decorators: [
    (Story) => (
      <div className="w-[400px] space-y-4">
        <div className="border-2 border-black">
          <Story />
        </div>
        <p className="text-xs text-muted-foreground">
          Custom height using className prop
        </p>
      </div>
    ),
  ],
};
