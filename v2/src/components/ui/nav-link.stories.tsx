import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NavLink } from "./nav-link";

/**
 * NavLink - Navigation link with loading state indicator.
 *
 * Features:
 * - Shows loading spinner while navigating
 * - Disables interaction during navigation
 * - Supports styled and unstyled variants
 */
const meta = {
  title: "UI/NavLink",
  component: NavLink,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    showLoading: {
      control: "boolean",
      description: "Show loading spinner during navigation",
    },
    spinnerSize: {
      control: { type: "number", min: 12, max: 24 },
      description: "Size of the loading spinner",
    },
    spinnerClassName: {
      control: "text",
      description: "Additional class for the spinner",
    },
  },
} satisfies Meta<typeof NavLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default NavLink - simple text link with loading support.
 */
export const Default: Story = {
  args: {
    href: "/dashboard",
    children: "Dashboard",
  },
};

/**
 * NavLink with custom styling.
 */
export const Styled: Story = {
  args: {
    href: "/settings",
    children: "Settings",
    className: "text-primary font-bold hover:underline",
  },
};

/**
 * NavLink as a button-style link.
 */
export const ButtonStyle: Story = {
  args: {
    href: "/login",
    children: "Sign In",
    className:
      "rounded-none border-4 border-black bg-transparent px-4 py-2 text-sm font-bold font-heading uppercase text-black shadow-hard transition-all hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  },
};

/**
 * NavLink with primary button styling.
 */
export const PrimaryButton: Story = {
  args: {
    href: "/signup",
    children: "Sign Up",
    className:
      "rounded-none border-4 border-primary bg-transparent px-4 py-2 text-sm font-bold font-heading uppercase text-primary shadow-[4px_4px_0px_rgba(34,139,34,0.4)] transition-all hover:-translate-y-[2px] hover:shadow-[6px_6px_0px_rgba(34,139,34,0.5)] hover:bg-primary/10 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  },
};

/**
 * NavLink on dark background.
 */
export const OnDarkBackground: Story = {
  args: {
    href: "/home",
    children: "Home",
    className: "text-white font-medium hover:text-primary",
    spinnerClassName: "text-white",
  },
  parameters: {
    backgrounds: { default: "dark" },
  },
};

/**
 * Small inline NavLink (like "Sign up" at the bottom of forms).
 */
export const InlineLink: Story = {
  args: {
    href: "/signup",
    children: "Sign up",
    className:
      "text-foreground font-bold hover:text-primary hover:underline hover:underline-offset-4 transition-colors",
    spinnerSize: 12,
  },
};
