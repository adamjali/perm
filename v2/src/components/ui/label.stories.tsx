import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Label } from "./label"
import { Input } from "./input"

const meta = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: "Email Address",
  },
}

export const WithInput: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="you@example.com" />
    </div>
  ),
}

export const Required: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="name">
        Full Name <span className="text-destructive">*</span>
      </Label>
      <Input id="name" placeholder="John Doe" />
    </div>
  ),
}

export const WithDescription: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="pwd-date">PWD Determination Date</Label>
      <Input type="date" id="pwd-date" />
      <p className="text-xs text-muted-foreground">
        The date shown on your PWD determination letter
      </p>
    </div>
  ),
}
