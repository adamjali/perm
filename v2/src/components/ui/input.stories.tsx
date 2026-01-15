import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Input } from "./input"
import { Label } from "./label"

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "date", "tel", "url"],
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    placeholder: "Enter text..."
  }
}

export const WithLabel: Story = {
  args: {},
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="email">Email</Label>
      <Input type="email" id="email" placeholder="name@example.com" />
    </div>
  ),
}

export const Disabled: Story = {
  args: {
    placeholder: "Disabled input",
    disabled: true
  }
}

export const WithError: Story = {
  args: {},
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="error-input">Email (with error)</Label>
      <Input
        type="email"
        id="error-input"
        placeholder="name@example.com"
        aria-invalid="true"
      />
      <p className="text-sm text-destructive">Please enter a valid email address</p>
    </div>
  ),
}

export const DifferentTypes: Story = {
  args: {},
  render: () => (
    <div className="grid w-full max-w-sm gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="text">Text</Label>
        <Input type="text" id="text" placeholder="Enter text" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="email-type">Email</Label>
        <Input type="email" id="email-type" placeholder="name@example.com" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input type="password" id="password" placeholder="••••••••" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="number">Number</Label>
        <Input type="number" id="number" placeholder="0" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="date">Date</Label>
        <Input type="date" id="date" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tel">Phone</Label>
        <Input type="tel" id="tel" placeholder="(555) 123-4567" />
      </div>
    </div>
  ),
}

export const CaseForm: Story = {
  args: {},
  render: () => (
    <div className="grid w-full max-w-md gap-4 p-6 border-2 border-border">
      <h3 className="text-lg font-semibold">New Case</h3>
      <div className="grid gap-1.5">
        <Label htmlFor="beneficiary">Beneficiary Name</Label>
        <Input type="text" id="beneficiary" placeholder="John Doe" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="employer">Employer</Label>
        <Input type="text" id="employer" placeholder="TechCorp Inc." />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="position">Job Title</Label>
        <Input type="text" id="position" placeholder="Software Engineer" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="pwd-date">PWD Determination Date</Label>
        <Input type="date" id="pwd-date" />
      </div>
    </div>
  ),
}

export const NeobrutalistShowcase: Story = {
  args: {},
  render: () => (
    <div className="p-8 space-y-4">
      <div className="text-sm font-semibold mb-4 text-foreground">Focus inputs to see the neobrutalist shadow upgrade</div>
      <div className="grid gap-4 max-w-sm">
        <Input placeholder="Click to focus..." />
        <Input placeholder="Watch the shadow change..." />
        <Input placeholder="Hard shadow on focus!" />
      </div>
      <div className="text-xs text-foreground/70 mt-4">
        Notice the hard shadow (shadow-hard-sm → shadow-hard) and focus ring
      </div>
    </div>
  ),
}

export const WithFile: Story = {
  args: {},
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <Label htmlFor="file">Upload Document</Label>
      <Input type="file" id="file" />
    </div>
  ),
}
