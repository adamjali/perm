import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Divider } from "./divider"

const meta = {
  title: "UI/Divider",
  component: Divider,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "thick"],
    },
  },
} satisfies Meta<typeof Divider>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { variant: "default" },
}

export const Thick: Story = {
  args: { variant: "thick" },
}

export const InContext: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-foreground">Content above the divider</p>
      <Divider />
      <p className="text-foreground">Content below the divider</p>
    </div>
  ),
}

export const ThickInContext: Story = {
  render: () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Section Title</h2>
      <Divider variant="thick" />
      <p className="text-muted-foreground">Section content goes here...</p>
    </div>
  ),
}
