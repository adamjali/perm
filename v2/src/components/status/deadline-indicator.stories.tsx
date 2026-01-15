import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { DeadlineIndicator } from "./deadline-indicator"
import { addDays, format } from "date-fns"

const meta = {
  title: "Status/DeadlineIndicator",
  component: DeadlineIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    deadline: {
      control: "text",
      description: "ISO date string (YYYY-MM-DD)",
    },
    label: {
      control: "text",
      description: "Optional label like 'PWD Expires'",
    },
    showDate: {
      control: "boolean",
      description: "Whether to show the formatted date",
    },
  },
} satisfies Meta<typeof DeadlineIndicator>

export default meta
type Story = StoryObj<typeof meta>

// Helper to generate ISO date strings relative to today
const getISODate = (daysOffset: number) => format(addDays(new Date(), daysOffset), "yyyy-MM-dd")

export const Urgent: Story = {
  args: {
    deadline: getISODate(3),
    label: "PWD Expires",
    showDate: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Urgent deadline (3 days out) with red indicator.",
      },
    },
  },
}

export const Soon: Story = {
  args: {
    deadline: getISODate(20),
    label: "Recruitment Ends",
    showDate: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Soon deadline (20 days out) with orange indicator.",
      },
    },
  },
}

export const Normal: Story = {
  args: {
    deadline: getISODate(60),
    label: "ETA 9089 Filing Window Closes",
    showDate: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Normal deadline (60 days out) with green indicator.",
      },
    },
  },
}

export const Overdue: Story = {
  args: {
    deadline: getISODate(-5),
    label: "Deadline",
    showDate: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Overdue deadline (5 days past) with urgent red indicator and 'OVERDUE' label.",
      },
    },
  },
}

export const WithoutLabel: Story = {
  args: {
    deadline: getISODate(10),
    showDate: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Deadline indicator without a label.",
      },
    },
  },
}

export const WithoutDate: Story = {
  args: {
    deadline: getISODate(15),
    label: "Filing Deadline",
    showDate: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Deadline indicator without the formatted date shown.",
      },
    },
  },
}

export const AllScenarios: Story = {
  args: {
    deadline: getISODate(3),
  },
  render: () => (
    <div className="flex flex-col gap-6">
      <DeadlineIndicator
        deadline={getISODate(3)}
        label="Urgent (3 days)"
        showDate
      />
      <DeadlineIndicator
        deadline={getISODate(20)}
        label="Soon (20 days)"
        showDate
      />
      <DeadlineIndicator
        deadline={getISODate(60)}
        label="Normal (60 days)"
        showDate
      />
      <DeadlineIndicator
        deadline={getISODate(-5)}
        label="Overdue (-5 days)"
        showDate
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All deadline scenarios: urgent, soon, normal, and overdue.",
      },
    },
  },
}
