"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, useEffect } from "react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { handleOperationError } from "@/lib/errors";
import { ChevronDown, Settings, LogOut, FileText, Loader2, Menu, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { AUTHENTICATED_NAV_LINKS, ADMIN_NAV_LINK } from "@/lib/constants/navigation";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { useAdminAuth } from "@/lib/admin/adminAuth";
import ThemeToggle from "./ThemeToggle";
import { NavLink } from "@/components/ui/nav-link";
import { NotificationBell, NotificationDropdown } from "@/components/notifications";
import { useNotificationToasts } from "@/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// USER MENU COMPONENT
// ============================================================================

interface UserMenuProps {
  userName: string;
}

function UserMenu({ userName }: UserMenuProps) {
  const pathname = usePathname();
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();
  const { isNavigating: isNavigatingToSettings, navigateTo } = useNavigationLoading();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isOnSettingsPage = pathname === "/settings";

  // Close dropdown when navigation completes (pathname changes)
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  function handleSettingsClick(e: Event): void {
    if (isOnSettingsPage) return;
    e.preventDefault(); // Prevent Radix from closing the dropdown
    navigateTo("/settings");
  }

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) return;

    beginSignOut();
    try {
      await signOut();
      window.location.href = "/login";
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to sign out. Please try again.",
        context: { operation: "signOut" },
      });
      cancelSignOut();
    }
  }

  function getSettingsLabel(): string {
    if (isNavigatingToSettings) return "Loading...";
    if (isOnSettingsPage) return "Already on Settings";
    return "Settings";
  }

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger
        className="group flex cursor-pointer items-center gap-2 rounded-none border-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-white transition-all hover:border-white/50 hover:bg-white/10 focus:outline-none"
      >
        <span className="max-w-[100px] truncate">{userName}</span>
        <ChevronDown className="size-4 transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[180px] rounded-none border-3 border-border bg-popover p-0 text-popover-foreground shadow-hard"
      >
        <DropdownMenuItem
          onSelect={handleSettingsClick}
          disabled={isNavigatingToSettings || isOnSettingsPage}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-sm font-semibold",
            "border-b-2 border-border",
            isOnSettingsPage
              ? "cursor-default bg-muted text-muted-foreground"
              : "hover:bg-muted"
          )}
        >
          {isNavigatingToSettings ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Settings className={cn("size-4", isOnSettingsPage && "text-muted-foreground")} />
          )}
          {getSettingsLabel()}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={handleSignOut}
          disabled={isSigningOut}
          className="flex cursor-pointer items-center gap-3 rounded-none px-4 py-3 text-sm font-semibold hover:bg-muted"
        >
          {isSigningOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// HEADER COMPONENT
// ============================================================================

export default function Header(): React.ReactElement {
  const pathname = usePathname();
  const user = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Extracted to local variable (React Compiler disabled; kept for SWC safety)
  const displayName = user?.name ?? "User";

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Handle mobile sign out
  async function handleMobileSignOut(): Promise<void> {
    if (isSigningOut) return;
    setIsMobileMenuOpen(false);
    beginSignOut();
    try {
      await signOut();
      window.location.href = "/login";
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to sign out. Please try again.",
        context: { operation: "mobileSignOut" },
      });
      cancelSignOut();
    }
  }

  // Enable toast notifications for new notifications
  useNotificationToasts();

  // Check if user is admin (server-side, no secrets on client)
  const { isAdmin } = useAdminAuth();

  // Build nav links with conditional admin link
  const navLinks = isAdmin
    ? [...AUTHENTICATED_NAV_LINKS, ADMIN_NAV_LINK]
    : AUTHENTICATED_NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b-3 border-white/20 bg-black">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 sm:px-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="group flex min-h-[44px] shrink-0 items-center gap-2 px-2 py-1 font-heading text-xl font-bold transition-colors hover:bg-primary sm:text-2xl"
        >
          <FileText
            className="size-6 text-primary transition-colors group-hover:text-black"
            strokeWidth={2.5}
          />
          <span>
            <span className="text-primary transition-colors group-hover:text-black">PERM</span>{" "}
            <span className="text-white transition-colors group-hover:text-black"> Tracker</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-2 sm:gap-4 lg:gap-8">
          {/* Desktop Navigation - hidden below lg (1024px) */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const tourId = link.href === "/cases" ? "nav-cases" : link.href === "/calendar" ? "nav-calendar" : undefined;
              return (
                <Fragment key={link.href}>
                  <NavLink
                    href={link.href}
                    spinnerClassName="text-primary"
                    data-tour={tourId}
                    className={cn(
                      "hover-underline px-3 py-2 font-heading text-sm font-semibold uppercase tracking-wide transition-colors lg:px-4",
                      isActive
                        ? "text-primary"
                        : "text-white hover:text-primary"
                    )}
                  >
                    {link.label}
                  </NavLink>{" "}
                </Fragment>
              );
            })}
          </div>

          {/* Notification bell - always visible */}
          <NotificationBell>
            <NotificationDropdown />
          </NotificationBell>

          {/* User dropdown - hidden below lg, shown in mobile menu.
              The slot is a FIXED width because `user` arrives from a Convex
              query, not from the server render: without it the four nav links
              jump left the moment the name resolves, on every load. 148px is
              the trigger at its widest (px-3 x2 + the 100px name cap + gap-2 +
              a 16px chevron), so a short name simply sits right-aligned in a
              box that never changes size. */}
          <div className="hidden w-[148px] shrink-0 justify-end lg:flex">
            {user && <UserMenu userName={displayName} />}
          </div>

          {/* Theme toggle - always visible */}
          <ThemeToggle />

          {/* Mobile Menu Button - visible below lg */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex lg:hidden h-11 w-11 items-center justify-center border-2 border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute inset-x-0 top-full z-50 border-b-3 border-white/20 bg-black px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {/* Navigation Links */}
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <NavLink
                  key={link.href}
                  href={link.href}
                  spinnerClassName="text-primary"
                  className={cn(
                    "block py-3 px-2 font-heading text-base font-semibold uppercase tracking-wide transition-colors",
                    isActive ? "text-primary" : "text-white hover:text-primary"
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              );
            })}

            {/* User Section in Mobile Menu */}
            {user && (
              <div className="flex flex-col gap-1 border-t border-white/20 pt-3 mt-2">
                <span className="text-sm text-white/60 font-semibold px-2 mb-1">
                  {displayName}
                </span>
                <NavLink
                  href="/settings"
                  className="flex items-center gap-3 py-3 px-2 font-heading text-base font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Settings className="size-4" />
                  Settings
                </NavLink>
                <button
                  onClick={handleMobileSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-3 py-3 px-2 font-heading text-base font-semibold uppercase tracking-wide text-white transition-colors hover:text-primary text-left disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <LogOut className="size-4" />
                  )}
                  {isSigningOut ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
