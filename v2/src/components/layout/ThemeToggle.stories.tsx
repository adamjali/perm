import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import ThemeToggle from "./ThemeToggle";

/**
 * ThemeToggle - Button to toggle between light and dark themes.
 *
 * Features:
 * - Sun icon in dark mode (to switch to light)
 * - Moon icon in light mode (to switch to dark)
 * - Neobrutalist styling with hard shadows
 * - Accessible with aria-label
 */
const meta = {
  title: "Layout/ThemeToggle",
  component: ThemeToggle,
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#000000" },
        { name: "light", value: "#FAFAFA" },
      ],
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state showing the theme toggle button.
 * Click to toggle between light and dark modes.
 */
export const Default: Story = {};

/**
 * Theme toggle on a dark background (as it appears in the header).
 */
export const OnDarkBackground: Story = {
  parameters: {
    backgrounds: { default: "dark" },
  },
};

/**
 * Theme toggle as it appears in context (always on dark header).
 * Note: This component is designed for the black header background.
 */
export const InHeader: Story = {
  decorators: [
    (Story) => (
      <div className="bg-black p-4">
        <Story />
      </div>
    ),
  ],
};
