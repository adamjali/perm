import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { CaseStageBadge } from "./case-stage-badge"

const meta = {
  title: "Status/CaseStageBadge",
  component: CaseStageBadge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    stage: {
      control: "select",
      options: ["pwd", "recruitment", "eta9089", "i140", "closed"],
      description: "The PERM case stage",
    },
  },
} satisfies Meta<typeof CaseStageBadge>

export default meta
type Story = StoryObj<typeof meta>

export const PWD: Story = {
  args: {
    stage: "pwd",
  },
}

export const Recruitment: Story = {
  args: {
    stage: "recruitment",
  },
}

export const ETA9089: Story = {
  args: {
    stage: "eta9089",
  },
}

export const I140: Story = {
  args: {
    stage: "i140",
  },
}

export const Closed: Story = {
  args: {
    stage: "closed",
  },
}

export const AllStages: Story = {
  args: {
    stage: "pwd",
  },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <CaseStageBadge stage="pwd" />
      <CaseStageBadge stage="recruitment" />
      <CaseStageBadge stage="eta9089" />
      <CaseStageBadge stage="i140" />
      <CaseStageBadge stage="closed" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All case stages shown side-by-side. PWD (Blue), Recruitment (Purple), ETA 9089 (Orange), I-140 (Teal), Closed (Gray).",
      },
    },
  },
}
