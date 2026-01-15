import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Skeleton } from "./skeleton"

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["line", "block", "circle"],
    },
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Line: Story = {
  args: { variant: "line" },
  decorators: [(Story) => <div className="w-full max-w-md"><Story /></div>],
}

export const Block: Story = {
  args: { variant: "block" },
  decorators: [(Story) => <div className="w-full max-w-md"><Story /></div>],
}

export const Circle: Story = {
  args: { variant: "circle" },
  parameters: { layout: "centered" },
}

export const CardSkeleton: Story = {
  render: () => (
    <div className="w-[300px] p-4 border-2 border-border shadow-hard space-y-3">
      <Skeleton variant="block" className="h-32" />
      <Skeleton variant="line" className="w-3/4" />
      <Skeleton variant="line" className="w-1/2" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton variant="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="line" />
          <Skeleton variant="line" className="w-2/3" />
        </div>
      </div>
    </div>
  ),
}

export const ListSkeleton: Story = {
  render: () => (
    <div className="w-[300px] space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 border-2 border-border">
          <Skeleton variant="circle" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="line" className="w-3/4" />
            <Skeleton variant="line" className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ),
}
