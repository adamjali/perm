import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Button } from "./button"

const meta = {
  title: "UI/Button",
  component: Button,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon", "icon-sm", "icon-lg"],
    },
    loading: {
      control: "boolean",
    },
    loadingText: {
      control: "text",
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: "Button" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }
export const Ghost: Story = { args: { children: "Ghost", variant: "ghost" } }
export const Link: Story = { args: { children: "Link", variant: "link" } }
export const Small: Story = { args: { children: "Small", size: "sm" } }
export const Large: Story = { args: { children: "Large", size: "lg" } }
export const Disabled: Story = { args: { children: "Disabled", disabled: true } }

export const AllVariants: Story = {
  args: {
    children: "Button",
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  args: {
    children: "Button",
  },
  render: () => (
    <div className="flex flex-wrap gap-4 items-center">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
}

export const WithIcon: Story = {
  args: {
    children: "Button",
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        Add Item
      </Button>
      <Button variant="outline">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        Remove
      </Button>
    </div>
  ),
}

export const Loading: Story = {
  args: {
    children: "Sign In",
    loading: true,
  },
}

export const LoadingWithText: Story = {
  args: {
    children: "Sign In",
    loading: true,
    loadingText: "Signing in...",
  },
}

export const LoadingVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground">Loading State Variants</div>
      <div className="flex flex-wrap gap-4">
        <Button loading loadingText="Processing...">Default</Button>
        <Button variant="secondary" loading loadingText="Loading...">Secondary</Button>
        <Button variant="destructive" loading loadingText="Deleting...">Destructive</Button>
        <Button variant="outline" loading loadingText="Saving...">Outline</Button>
      </div>
      <div className="text-xs text-foreground/70 mt-2">
        Loading state prevents interaction and displays spinner
      </div>
    </div>
  ),
}

export const LoadingSizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold text-foreground">Loading State Sizes</div>
      <div className="flex flex-wrap gap-4 items-center">
        <Button size="sm" loading loadingText="Saving...">Small</Button>
        <Button loading loadingText="Processing...">Default</Button>
        <Button size="lg" loading loadingText="Loading...">Large</Button>
      </div>
      <div className="text-xs text-foreground/70 mt-2">
        Spinner size automatically matches button size
      </div>
    </div>
  ),
}

export const NeobrutalistShowcase: Story = {
  args: {
    children: "Button",
  },
  render: () => (
    <div className="p-8 space-y-4">
      <div className="text-sm font-semibold mb-4 text-foreground">Press buttons to see the neobrutalist active state (shadow removal + translation)</div>
      <div className="flex flex-wrap gap-4">
        <Button>Press Me</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
      </div>
      <div className="text-xs text-foreground/70 mt-4">
        Notice the hard shadows (4px 4px 0px #000) and the press effect (translate + shadow removal)
      </div>
    </div>
  ),
}
