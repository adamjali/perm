import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { toast } from "@/lib/toast"
import { Button } from "./button"

const meta = {
  title: "UI/Toast",
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Button onClick={() => toast("This is a toast message")}>
      Show Toast
    </Button>
  ),
}

export const Success: Story = {
  render: () => (
    <Button onClick={() => toast.success("Case saved successfully!")}>
      Show Success
    </Button>
  ),
}

export const Error: Story = {
  render: () => (
    <Button
      variant="destructive"
      onClick={() => toast.error("Failed to save case")}
    >
      Show Error
    </Button>
  ),
}

export const WithDescription: Story = {
  render: () => (
    <Button onClick={() => toast("Case Updated", {
      description: "PWD determination date has been changed to March 15, 2024",
    })}>
      Show With Description
    </Button>
  ),
}

export const WithAction: Story = {
  render: () => (
    <Button onClick={() => toast("Case deleted", {
      action: {
        label: "Undo",
        onClick: () => toast.success("Case restored!"),
      },
    })}>
      Show With Action
    </Button>
  ),
}

export const PromiseToast: Story = {
  render: () => (
    <Button onClick={() => {
      toast.promise(
        new globalThis.Promise<void>((resolve) => setTimeout(resolve, 2000)),
        {
          loading: "Saving case...",
          success: "Case saved!",
          error: "Failed to save",
        }
      )
    }}>
      Show Promise Toast
    </Button>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => toast("Default toast")}>Default</Button>
      <Button onClick={() => toast.success("Success!")}>Success</Button>
      <Button onClick={() => toast.error("Error!")}>Error</Button>
      <Button onClick={() => toast.warning("Warning!")}>Warning</Button>
      <Button onClick={() => toast.info("Info message")}>Info</Button>
    </div>
  ),
}
