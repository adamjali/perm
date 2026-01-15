import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Spinner } from "./spinner"
import { Button } from "./button"

const meta = {
  title: "UI/Spinner",
  component: Spinner,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "accent"],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Accent: Story = {
  args: {
    variant: "accent",
  },
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <Spinner size="sm" />
        <span className="text-xs text-foreground/70">Small</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner />
        <span className="text-xs text-foreground/70">Default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner size="lg" />
        <span className="text-xs text-foreground/70">Large</span>
      </div>
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Spinner variant="default" />
        <span className="text-xs text-foreground/70">Default (Black)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spinner variant="accent" />
        <span className="text-xs text-foreground/70">Accent (Forest Green)</span>
      </div>
    </div>
  ),
}

export const WithButton: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground">Loading Button Simulation</div>
      <div className="flex flex-wrap gap-4">
        <Button disabled className="cursor-not-allowed opacity-70">
          <Spinner size="sm" />
          Signing in...
        </Button>
        <Button variant="secondary" disabled className="cursor-not-allowed opacity-70">
          <Spinner size="sm" />
          Processing...
        </Button>
        <Button variant="outline" disabled className="cursor-not-allowed opacity-70">
          <Spinner size="sm" />
          Loading...
        </Button>
      </div>
      <div className="text-xs text-foreground/70 mt-2">
        Spinners automatically match button size (sm buttons get sm spinner)
      </div>
    </div>
  ),
}

export const SizeVariants: Story = {
  render: () => (
    <div className="p-8 space-y-6">
      <div className="text-sm font-semibold text-foreground">Size & Color Combinations</div>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Spinner size="sm" variant="default" />
          <Spinner size="default" variant="default" />
          <Spinner size="lg" variant="default" />
          <span className="text-xs text-foreground/70">Default (Black)</span>
        </div>
        <div className="flex items-center gap-4">
          <Spinner size="sm" variant="accent" />
          <Spinner size="default" variant="accent" />
          <Spinner size="lg" variant="accent" />
          <span className="text-xs text-foreground/70">Accent (Forest Green #228B22)</span>
        </div>
      </div>
    </div>
  ),
}
