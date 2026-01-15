import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"

const meta = {
  title: "UI/Card",
  component: Card,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content with neobrutalist hard shadow styling.</p>
      </CardContent>
      <CardFooter>
        <Button>Action</Button>
      </CardFooter>
    </Card>
  ),
}

export const WithAction: Story = {
  args: {},
  render: () => (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Case: John Doe</CardTitle>
        <CardDescription>PWD Phase - Due in 5 days</CardDescription>
        <CardAction>
          <Badge variant="destructive">Urgent</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-foreground/70">Employer:</span>
            <span className="font-semibold">TechCorp Inc.</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-foreground/70">Position:</span>
            <span className="font-semibold">Software Engineer</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">View Details</Button>
        <Button size="sm" variant="outline">Edit</Button>
      </CardFooter>
    </Card>
  ),
}

export const Minimal: Story = {
  args: {},
  render: () => (
    <Card className="w-[300px]">
      <CardContent>
        <p className="text-sm">A simple card with just content, no header or footer.</p>
      </CardContent>
    </Card>
  ),
}

export const WithMultipleCards: Story = {
  args: {},
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <Card className="w-[250px]">
        <CardHeader>
          <CardTitle>PWD Phase</CardTitle>
          <CardDescription>3 active cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-foreground/70">Total this month</p>
        </CardContent>
      </Card>
      <Card className="w-[250px]">
        <CardHeader>
          <CardTitle>Recruitment</CardTitle>
          <CardDescription>5 active cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">8</div>
          <p className="text-xs text-foreground/70">Total this month</p>
        </CardContent>
      </Card>
      <Card className="w-[250px]">
        <CardHeader>
          <CardTitle>ETA 9089</CardTitle>
          <CardDescription>2 active cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">15</div>
          <p className="text-xs text-foreground/70">Total this month</p>
        </CardContent>
      </Card>
      <Card className="w-[250px]">
        <CardHeader>
          <CardTitle>I-140</CardTitle>
          <CardDescription>1 active case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">7</div>
          <p className="text-xs text-foreground/70">Total this month</p>
        </CardContent>
      </Card>
    </div>
  ),
}

export const NeobrutalistShowcase: Story = {
  args: {},
  render: () => (
    <div className="p-8 space-y-4">
      <div className="text-sm font-semibold mb-4 text-foreground">Hover over cards to see the neobrutalist lift effect</div>
      <div className="grid grid-cols-2 gap-6">
        <Card className="w-[280px]">
          <CardHeader>
            <CardTitle>Hover Me</CardTitle>
            <CardDescription>Watch the shadow grow</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Hard shadows and lift on hover create depth.</p>
          </CardContent>
        </Card>
        <Card className="w-[280px]">
          <CardHeader>
            <CardTitle>Me Too!</CardTitle>
            <CardDescription>Neobrutalist design</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Bold borders and defined edges.</p>
          </CardContent>
        </Card>
      </div>
      <div className="text-xs text-foreground/70 mt-4">
        Notice the hard shadows (shadow-hard) and the hover lift effect
      </div>
    </div>
  ),
}
