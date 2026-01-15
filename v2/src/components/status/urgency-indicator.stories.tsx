import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { UrgencyIndicator } from "./urgency-indicator"

const meta = {
  title: "Status/UrgencyIndicator",
  component: UrgencyIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    level: {
      control: "select",
      options: ["urgent", "soon", "normal"],
      description: "Urgency level",
    },
    daysUntil: {
      control: { type: "number", min: 0, max: 180 },
      description: "Number of days until deadline",
    },
    showDays: {
      control: "boolean",
      description: "Whether to display the days count",
    },
  },
} satisfies Meta<typeof UrgencyIndicator>

export default meta
type Story = StoryObj<typeof meta>

export const Urgent: Story = {
  args: {
    level: "urgent",
    daysUntil: 3,
    showDays: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Urgent level with red indicator (≤7 days).",
      },
    },
  },
}

export const Soon: Story = {
  args: {
    level: "soon",
    daysUntil: 20,
    showDays: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Soon level with orange indicator (8-30 days).",
      },
    },
  },
}

export const Normal: Story = {
  args: {
    level: "normal",
    daysUntil: 60,
    showDays: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Normal level with green indicator (30+ days).",
      },
    },
  },
}

export const WithoutDaysCount: Story = {
  args: {
    level: "urgent",
    daysUntil: 5,
    showDays: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Indicator without days count displayed.",
      },
    },
  },
}

export const AllLevels: Story = {
  args: {
    level: "urgent",
    daysUntil: 3,
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <UrgencyIndicator level="urgent" daysUntil={3} showDays />
      <UrgencyIndicator level="soon" daysUntil={20} showDays />
      <UrgencyIndicator level="normal" daysUntil={60} showDays />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All urgency levels shown together. Urgent (red), Soon (orange), Normal (green).",
      },
    },
  },
}
