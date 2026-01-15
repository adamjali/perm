import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Button } from "./button"

const meta = {
  title: "UI/Utilities",
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const HazardBackground: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Warning/alert stripe pattern</p>
      <div className="hazard-bg h-4 w-full" />
      <div className="hazard-bg h-8 w-32" />
      <div className="relative overflow-hidden border-2 border-border p-4">
        <div className="absolute top-0 right-0 w-24 h-24 hazard-bg opacity-10 -mr-12 -mt-12 rotate-45" />
        <p className="relative z-10">Card with hazard corner accent</p>
      </div>
    </div>
  ),
}

export const BounceAnimations: Story = {
  render: () => (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground mb-4">Snappy, reactive bounce animations (design3 style)</p>
      <div className="flex gap-8 items-end justify-center py-12">
        <div className="text-center">
          <div className="bounce w-16 h-16 bg-primary border-2 border-border" />
          <p className="text-xs mt-8 mono">.bounce</p>
          <p className="text-xs text-muted-foreground">2s + 90deg spin</p>
        </div>
        <div className="text-center">
          <div className="bounce-fast w-16 h-16 bg-stage-pwd border-2 border-border" />
          <p className="text-xs mt-8 mono">.bounce-fast</p>
          <p className="text-xs text-muted-foreground">1.2s</p>
        </div>
        <div className="text-center">
          <div className="bounce-slow w-16 h-16 bg-stage-recruitment border-2 border-border" />
          <p className="text-xs mt-8 mono">.bounce-slow</p>
          <p className="text-xs text-muted-foreground">3s</p>
        </div>
        <div className="text-center">
          <div className="bounce-subtle w-16 h-16 bg-stage-eta9089 border-2 border-border" />
          <p className="text-xs mt-8 mono">.bounce-subtle</p>
          <p className="text-xs text-muted-foreground">no rotation</p>
        </div>
        <div className="text-center">
          <div className="bounce-spin w-16 h-16 bg-stage-i140 border-2 border-border" />
          <p className="text-xs mt-8 mono">.bounce-spin</p>
          <p className="text-xs text-muted-foreground">continuous spin</p>
        </div>
      </div>
    </div>
  ),
}

export const SnappyCardHover: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Snappy card hover with shadow transition (design3 style)</p>
      <div className="flex gap-6">
        <Card className="card-snappy w-48 cursor-pointer">
          <CardHeader>
            <CardTitle>Hover Me</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Lifts up on hover, depresses on click</p>
          </CardContent>
        </Card>
        <Card className="card-snappy w-48 cursor-pointer">
          <CardHeader>
            <CardTitle>Try Click</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Shadow disappears when pressed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
}

export const CornerAccents: Story = {
  render: () => (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">Dramatic corner accents inspired by design4</p>

      <div className="flex flex-wrap gap-6">
        <Card className="corner-accent w-64">
          <CardHeader>
            <CardTitle>Green Accent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">.corner-accent</p>
          </CardContent>
        </Card>

        <Card className="corner-accent-hazard w-64">
          <CardHeader>
            <CardTitle>Hazard Accent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">.corner-accent-hazard</p>
          </CardContent>
        </Card>

        <Card className="corner-accent corner-accent-lg w-64">
          <CardHeader>
            <CardTitle>Large Accent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">.corner-accent-lg</p>
          </CardContent>
        </Card>

        <Card className="corner-accent corner-accent-sm w-64">
          <CardHeader>
            <CardTitle>Small Accent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">.corner-accent-sm</p>
          </CardContent>
        </Card>

        <Card className="corner-accent corner-accent-bl w-64">
          <CardHeader>
            <CardTitle>Bottom-Left</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">.corner-accent-bl</p>
          </CardContent>
        </Card>
      </div>
    </div>
  ),
}

export const GrainOverlay: Story = {
  render: () => (
    <div className="text-center space-y-2">
      <p className="text-sm text-muted-foreground">
        The grain overlay is visible on all stories (added globally)
      </p>
      <p className="text-xs text-muted-foreground">
        Look closely at the background for subtle noise texture
      </p>
    </div>
  ),
}

export const GlassPanel: Story = {
  render: () => (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Frosted glass effect with backdrop blur for modals and overlays
      </p>

      {/* Demo with colored background to show the effect */}
      <div className="relative h-64 bg-gradient-to-br from-primary/30 via-stage-pwd/30 to-stage-recruitment/30 border-2 border-border p-4">
        <p className="text-xs mono mb-2">Background gradient to demonstrate blur</p>

        <div className="glass-panel p-6 shadow-hard absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64">
          <h4 className="font-heading font-bold text-lg mb-2">Glass Panel</h4>
          <p className="text-sm text-muted-foreground">
            Content appears over a frosted glass background with 10px blur.
          </p>
          <Button className="mt-4 w-full">Action</Button>
        </div>
      </div>

      {/* Multiple panels */}
      <div className="flex gap-4">
        <div className="glass-panel p-4 flex-1 shadow-hard">
          <p className="text-sm font-medium">Panel 1</p>
          <p className="text-xs text-muted-foreground">.glass-panel</p>
        </div>
        <div className="glass-panel p-4 flex-1 shadow-hard-sm">
          <p className="text-sm font-medium">Panel 2</p>
          <p className="text-xs text-muted-foreground">with shadow-hard-sm</p>
        </div>
        <div className="glass-panel p-4 flex-1 border-2 border-border">
          <p className="text-sm font-medium">Panel 3</p>
          <p className="text-xs text-muted-foreground">with border override</p>
        </div>
      </div>
    </div>
  ),
}

export const DotBackground: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="bg-dots p-8 border-2 border-border">
        <p className="text-foreground">Content on dot pattern background</p>
      </div>
      <div className="bg-dots bg-card p-8 border-2 border-border">
        <Card>
          <CardContent className="p-4">
            Card on dot pattern
          </CardContent>
        </Card>
      </div>
    </div>
  ),
}

export const AllUtilities: Story = {
  render: () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-bold mb-4">Backgrounds</h3>
        <div className="flex gap-4">
          <div className="bg-dots w-24 h-24 border-2 border-border flex items-center justify-center text-xs">.bg-dots</div>
          <div className="hazard-bg w-24 h-24 border-2 border-border" />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-4">Shadows</h3>
        <div className="flex gap-4">
          <div className="w-24 h-24 bg-card border-2 border-border shadow-hard-sm flex items-center justify-center text-xs">sm</div>
          <div className="w-24 h-24 bg-card border-2 border-border shadow-hard flex items-center justify-center text-xs">default</div>
          <div className="w-24 h-24 bg-card border-2 border-border shadow-hard-lg flex items-center justify-center text-xs">lg</div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-4">Bounce Animations (Snappy)</h3>
        <div className="flex gap-6 items-end py-8">
          <div className="bounce w-12 h-12 bg-primary border-2 border-border" />
          <div className="bounce-fast w-12 h-12 bg-stage-pwd border-2 border-border" />
          <div className="bounce-slow w-12 h-12 bg-stage-recruitment border-2 border-border" />
          <div className="bounce-subtle w-12 h-12 bg-stage-eta9089 border-2 border-border" />
          <div className="bounce-spin w-12 h-12 bg-stage-i140 border-2 border-border" />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-bold mb-4">Corner Accents</h3>
        <div className="flex gap-4">
          <div className="corner-accent w-24 h-24 bg-card border-2 border-border flex items-center justify-center text-xs">green</div>
          <div className="corner-accent-hazard w-24 h-24 bg-card border-2 border-border flex items-center justify-center text-xs">hazard</div>
        </div>
      </section>
    </div>
  ),
}
