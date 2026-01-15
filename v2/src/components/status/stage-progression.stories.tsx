import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { StageProgression, StageProgressionItem } from "./stage-progression"

const meta = {
  title: "Status/StageProgression",
  component: StageProgression,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof StageProgression>

export default meta
type Story = StoryObj<typeof meta>

export const SingleStage: StoryObj<typeof StageProgressionItem> = {
  render: () => (
    <StageProgressionItem stage="pwd" progressLabel="FILED" />
  ),
}

export const AllStages: Story = {
  args: {
    stages: [
      { stage: "pwd", progressLabel: "APPROVED" },
      { stage: "recruitment", progressLabel: "ACTIVE" },
      { stage: "eta9089", progressLabel: "PREP" },
      { stage: "i140", progressLabel: "PENDING" },
    ],
  },
}

export const CaseInRecruitment: Story = {
  args: {
    stages: [
      { stage: "pwd", progressLabel: "APPROVED" },
      { stage: "recruitment", progressLabel: "ACTIVE" },
    ],
  },
}

export const CompletedCase: Story = {
  args: {
    stages: [
      { stage: "pwd", progressLabel: "APPROVED" },
      { stage: "recruitment", progressLabel: "COMPLETE" },
      { stage: "eta9089", progressLabel: "APPROVED" },
      { stage: "i140", progressLabel: "APPROVED" },
    ],
  },
}

export const ClosedCase: StoryObj<typeof StageProgressionItem> = {
  render: () => (
    <StageProgressionItem stage="closed" progressLabel="ARCHIVED" />
  ),
}
