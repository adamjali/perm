import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AuthHeader from "./AuthHeader";

/**
 * AuthHeader - Header for public/authentication pages.
 *
 * Features:
 * - Logo linking to home (/)
 * - Home and Demo navigation links with loading states
 * - Context-aware auth buttons (shows/hides based on current page)
 * - Sign In: white outline style
 * - Sign Up: green outline style
 * - Theme toggle button
 * - All text uses Space Grotesk (font-heading)
 */
const meta = {
  title: "Layout/AuthHeader",
  component: AuthHeader,
  parameters: {
    layout: "fullscreen",
    nextjs: {
      navigation: {
        pathname: "/",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AuthHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default header on home page - shows both Sign In and Sign Up buttons.
 */
export const Default: Story = {};

/**
 * Header on login page - hides Sign In button, shows Sign Up.
 */
export const OnLoginPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/login",
      },
    },
  },
};

/**
 * Header on signup page - hides Sign Up button, shows Sign In.
 */
export const OnSignupPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/signup",
      },
    },
  },
};

/**
 * Header on demo page - shows both buttons.
 */
export const OnDemoPage: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: "/demo",
      },
    },
  },
};
