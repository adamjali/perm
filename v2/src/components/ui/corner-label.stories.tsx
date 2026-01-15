/**
 * CornerLabel Component Stories
 * Visual reference for corner metric labels
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import CornerLabel from "./corner-label";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

const meta: Meta<typeof CornerLabel> = {
  title: "UI/CornerLabel",
  component: CornerLabel,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    position: {
      control: "select",
      options: ["top-left", "top-right", "bottom-left", "bottom-right"],
    },
    color: {
      control: "select",
      options: ["bg-background", "bg-primary", "bg-destructive", "bg-stage-pwd"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof CornerLabel>;

export const TopRight: Story = {
  args: {
    value: 42,
    position: "top-right",
  },
  decorators: [
    (Story) => (
      <div className="relative w-[300px]">
        <Story />
        <Card>
          <CardHeader>
            <CardTitle>Card with Label</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Count appears in top-right corner
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  ],
};

export const TopLeft: Story = {
  args: {
    value: 7,
    position: "top-left",
  },
  decorators: [
    (Story) => (
      <div className="relative w-[300px]">
        <Story />
        <Card>
          <CardHeader>
            <CardTitle>Active Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Label positioned at top-left
            </p>
          </CardContent>
        </Card>
      </div>
    ),
  ],
};

export const AllPositions: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      {(["top-left", "top-right", "bottom-left", "bottom-right"] as const).map(
        (position) => (
          <div key={position} className="relative w-[240px]">
            <CornerLabel value={Math.floor(Math.random() * 99)} position={position} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{position}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Position: {position}
                </p>
              </CardContent>
            </Card>
          </div>
        )
      )}
    </div>
  ),
};

export const ColoredLabels: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="relative w-[240px]">
        <CornerLabel value="NEW" color="bg-primary text-white" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Color</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Forest green label</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-[240px]">
        <CornerLabel value="URGENT" color="bg-destructive text-white" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Destructive Color</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Red alert label</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};

export const StringValues: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8">
      <div className="relative w-[240px]">
        <CornerLabel value="HOT" position="top-right" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">String Label</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Text values supported</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative w-[240px]">
        <CornerLabel value="99+" position="top-right" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overflow Count</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Shows 99+ format</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
};
