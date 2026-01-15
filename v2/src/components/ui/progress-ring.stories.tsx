/**
 * ProgressRing Component Stories
 * Visual reference for circular progress indicators
 *
 * Phase: 20 (Dashboard + Deadline Hub)
 * Created: 2025-12-23
 */

import type { Meta, StoryObj } from "@storybook/nextjs";
import ProgressRing from "./progress-ring";
import { Card, CardContent } from "./card";

const meta: Meta<typeof ProgressRing> = {
  title: "UI/ProgressRing",
  component: ProgressRing,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: { type: "range", min: 0, max: 100, step: 1 },
    },
    size: {
      control: { type: "range", min: 40, max: 200, step: 10 },
    },
    strokeWidth: {
      control: { type: "range", min: 2, max: 20, step: 2 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProgressRing>;

export const Default: Story = {
  args: {
    value: 75,
    size: 120,
    strokeWidth: 8,
    animateOnScroll: false,
  },
};

export const Small: Story = {
  args: {
    value: 60,
    size: 60,
    strokeWidth: 4,
    animateOnScroll: false,
  },
};

export const Large: Story = {
  args: {
    value: 85,
    size: 200,
    strokeWidth: 12,
    animateOnScroll: false,
  },
};

export const StageColors: Story = {
  render: () => (
    <div className="flex flex-wrap items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <ProgressRing
          value={65}
          size={100}
          color="#0066FF"
          animateOnScroll={false}
        />
        <p className="mono text-xs">PWD (Blue)</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProgressRing
          value={45}
          size={100}
          color="#9333ea"
          animateOnScroll={false}
        />
        <p className="mono text-xs">Recruitment (Purple)</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProgressRing
          value={80}
          size={100}
          color="#D97706"
          animateOnScroll={false}
        />
        <p className="mono text-xs">ETA 9089 (Orange)</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProgressRing
          value={90}
          size={100}
          color="#059669"
          animateOnScroll={false}
        />
        <p className="mono text-xs">I-140 (Emerald)</p>
      </div>
    </div>
  ),
};

export const ProgressLevels: Story = {
  render: () => (
    <div className="flex flex-wrap items-center justify-center gap-6">
      {[0, 25, 50, 75, 100].map((value) => (
        <div key={value} className="flex flex-col items-center gap-2">
          <ProgressRing value={value} size={80} animateOnScroll={false} />
          <p className="mono text-xs font-bold">{value}%</p>
        </div>
      ))}
    </div>
  ),
};

export const ScrollAnimation: Story = {
  render: () => (
    <div className="space-y-8">
      <Card className="p-4">
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scroll down to see the progress ring animate when it enters the
            viewport.
          </p>
        </CardContent>
      </Card>

      {/* Spacer to force scrolling */}
      <div className="h-[600px] border-2 border-dashed border-muted p-8 text-center">
        <p className="text-muted-foreground">Scroll down ↓</p>
      </div>

      <Card className="p-8">
        <CardContent className="flex flex-col items-center gap-4">
          <h3 className="font-heading text-xl font-bold">Animated Progress</h3>
          <ProgressRing
            value={75}
            size={160}
            strokeWidth={12}
            animateOnScroll={true}
          />
          <p className="text-sm text-muted-foreground">
            This ring animates when you scroll it into view
          </p>
        </CardContent>
      </Card>

      <div className="h-[400px]" />
    </div>
  ),
};

export const InSummaryTile: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6">
      <Card className="relative overflow-hidden">
        <CardContent className="flex items-center gap-4 p-6">
          <ProgressRing
            value={68}
            size={80}
            strokeWidth={6}
            color="#0066FF"
            animateOnScroll={false}
          />
          <div className="flex-1">
            <h3 className="font-heading text-2xl font-bold">24</h3>
            <p className="text-sm text-muted-foreground">PWD Cases</p>
            <p className="mono mt-1 text-xs text-muted-foreground">
              16 working, 8 filed
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden">
        <CardContent className="flex items-center gap-4 p-6">
          <ProgressRing
            value={85}
            size={80}
            strokeWidth={6}
            color="#059669"
            animateOnScroll={false}
          />
          <div className="flex-1">
            <h3 className="font-heading text-2xl font-bold">12</h3>
            <p className="text-sm text-muted-foreground">I-140 Cases</p>
            <p className="mono mt-1 text-xs text-muted-foreground">
              3 prep, 1 RFE, 8 filed
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  ),
};
