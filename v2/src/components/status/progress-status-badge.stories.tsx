import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { ProgressStatusBadge } from "./progress-status-badge"

const meta = {
  title: "Status/ProgressStatusBadge",
  component: ProgressStatusBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["working", "waiting_intake", "filed", "approved", "under_review", "rfi_rfe"],
      description: "Progress status within a case stage",
    },
  },
} satisfies Meta<typeof ProgressStatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Working: Story = {
  args: {
    status: "working",
  },
  parameters: {
    docs: {
      description: {
        story: "Working on it - neutral muted badge.",
      },
    },
  },
}

export const WaitingIntake: Story = {
  args: {
    status: "waiting_intake",
  },
  parameters: {
    docs: {
      description: {
        story: "Waiting for Intake - neutral muted badge.",
      },
    },
  },
}

export const Filed: Story = {
  args: {
    status: "filed",
  },
  parameters: {
    docs: {
      description: {
        story: "Filed - blue badge indicating submission.",
      },
    },
  },
}

export const Approved: Story = {
  args: {
    status: "approved",
  },
  parameters: {
    docs: {
      description: {
        story: "Approved - green badge indicating success.",
      },
    },
  },
}

export const UnderReview: Story = {
  args: {
    status: "under_review",
  },
  parameters: {
    docs: {
      description: {
        story: "Under Review - yellow badge indicating pending review.",
      },
    },
  },
}

export const RFIRFE: Story = {
  args: {
    status: "rfi_rfe",
  },
  parameters: {
    docs: {
      description: {
        story: "RFI/RFE - red badge indicating request for information/evidence.",
      },
    },
  },
}

export const AllStatuses: Story = {
  args: {
    status: "working",
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <ProgressStatusBadge status="working" />
      <ProgressStatusBadge status="waiting_intake" />
      <ProgressStatusBadge status="filed" />
      <ProgressStatusBadge status="approved" />
      <ProgressStatusBadge status="under_review" />
      <ProgressStatusBadge status="rfi_rfe" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All progress statuses shown side-by-side.",
      },
    },
  },
}
