import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ThemeToggle from "./ThemeToggle";

/**
 * Header - Main navigation header for authenticated users.
 *
 * Note: The actual Header component uses Convex for user data.
 * This story demonstrates the header design with static content.
 *
 * Features:
 * - Logo linking to /dashboard
 * - Navigation links with active state
 * - User name display
 * - Theme toggle button
 * - Sticky positioning with neobrutalist border
 */

const NAV_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Cases", href: "/cases" },
  { label: "Calendar", href: "/calendar" },
  { label: "Notifications", href: "/notifications" },
  { label: "Settings", href: "/settings" },
];

// Static header component for Storybook (doesn't use Convex)
function StaticHeader({
  pathname = "/dashboard",
  userName,
}: {
  pathname?: string;
  userName?: string;
}) {
  return (
    <header className="sticky top-0 z-50 border-b-4 border-black bg-background">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="text-2xl font-bold font-heading transition-colors hover:text-primary"
        >
          PERM Tracker
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          {/* Nav Links */}
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User name */}
          {userName && (
            <div className="text-sm font-medium text-muted-foreground">
              {userName}
            </div>
          )}

          {/* Theme toggle */}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

const meta = {
  title: "Layout/Header",
  component: StaticHeader,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    pathname: {
      control: "select",
      options: [
        "/dashboard",
        "/cases",
        "/calendar",
        "/notifications",
        "/settings",
      ],
      description: "Current page path for active state",
    },
    userName: {
      control: "text",
      description: "User name to display (optional)",
    },
  },
} satisfies Meta<typeof StaticHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default header with Dashboard active.
 */
export const Default: Story = {
  args: {
    pathname: "/dashboard",
    userName: "Jane Attorney",
  },
};

/**
 * Header with Cases page active.
 */
export const CasesActive: Story = {
  args: {
    pathname: "/cases",
    userName: "Jane Attorney",
  },
};

/**
 * Header with Calendar page active.
 */
export const CalendarActive: Story = {
  args: {
    pathname: "/calendar",
    userName: "Jane Attorney",
  },
};

/**
 * Header without user name (loading state).
 */
export const NoUser: Story = {
  args: {
    pathname: "/dashboard",
  },
};

/**
 * Header with long user name.
 */
export const LongUserName: Story = {
  args: {
    pathname: "/dashboard",
    userName: "Alexandra Katherine Johnson-Smith",
  },
};
