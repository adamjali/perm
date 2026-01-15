import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Badge } from "./badge"

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { children: "Badge" } }
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } }
export const Destructive: Story = { args: { children: "Error", variant: "destructive" } }
export const Outline: Story = { args: { children: "Outline", variant: "outline" } }

export const AllVariants: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
}

export const CaseStatusColors: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold mb-4">PERM Case Status Badges</div>
      <div className="flex flex-wrap gap-3">
        <Badge className="bg-[#0066FF] text-white border-[#0066FF]">PWD</Badge>
        <Badge className="bg-[#9333ea] text-white border-[#9333ea]">Recruitment</Badge>
        <Badge className="bg-[#D97706] text-white border-[#D97706]">ETA 9089</Badge>
        <Badge className="bg-[#EAB308] text-black border-[#EAB308]">ETA 9089 (Working)</Badge>
        <Badge className="bg-[#059669] text-white border-[#059669]">I-140</Badge>
        <Badge className="bg-[#6B7280] text-white border-[#6B7280]">Closed</Badge>
      </div>
    </div>
  ),
}

export const UrgencyBadges: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold mb-4">Urgency Levels</div>
      <div className="flex flex-wrap gap-3">
        <Badge className="bg-[#DC2626] text-white border-[#DC2626]">Urgent (≤7 days)</Badge>
        <Badge className="bg-[#EA580C] text-white border-[#EA580C]">Soon (8-30 days)</Badge>
        <Badge className="bg-[#059669] text-white border-[#059669]">Normal (30+ days)</Badge>
      </div>
    </div>
  ),
}

export const WithIcons: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        Active
      </Badge>
      <Badge variant="destructive">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        RFI Active
      </Badge>
      <Badge variant="outline">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
        </svg>
        Info
      </Badge>
    </div>
  ),
}

export const AdditionalTags: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="space-y-4">
      <div className="text-sm font-semibold mb-4">Additional Case Tags</div>
      <div className="flex flex-wrap gap-3">
        <Badge className="bg-[#1F2937] text-[#F9FAFB] border-[#1F2937]">Professional</Badge>
        <Badge className="bg-[#DC2626] text-white border-[#DC2626]">RFI Active</Badge>
        <Badge className="bg-[#DC2626] text-white border-[#DC2626]">RFE Active</Badge>
      </div>
    </div>
  ),
}

export const MixedSizes: Story = {
  args: {
    children: "Badge",
  },
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Badge className="text-xs">Extra Small</Badge>
      <Badge>Default</Badge>
      <Badge className="text-sm px-3 py-1">Larger</Badge>
    </div>
  ),
}
