import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AuthFooter from "./AuthFooter";

/**
 * AuthFooter - Footer for public/authentication pages.
 *
 * Features:
 * - Privacy Policy, Terms of Service, Contact links
 * - Copyright with current year
 * - Neobrutalist top border (border-t-4, border-black)
 * - Black background with white text
 */
const meta = {
  title: "Layout/AuthFooter",
  component: AuthFooter,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AuthFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default footer as it appears on auth pages.
 */
export const Default: Story = {};

/**
 * Footer with a mock page content above it.
 */
export const WithPageContent: Story = {
  decorators: [
    (Story) => (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex-1 p-8">
          <p className="text-muted-foreground">Page content above footer</p>
        </div>
        <Story />
      </div>
    ),
  ],
};
