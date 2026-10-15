"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, useEffect } from "react";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { handleOperationError } from "@/lib/errors";
import { CaretDownIcon, CircleNotchIcon, FileTextIcon, GearIcon as Settings, ListIcon as Menu, SignOutIcon, XIcon } from "@phosphor-icons/react";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";
import { AUTHENTICATED_NAV_LINKS, ADMIN_NAV_LINK } from "@/lib/constants/navigation";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { useAdminAuth } from "@/lib/admin/adminAuth";
import { NavLink } from "@/components/ui/nav-link";
import { NotificationBell, NotificationDropdown } from "@/components/notifications";
import { AppSearch } from "@/components/search/AppSearch";
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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load clears every signed-in query and cache
      window.location.href = "/login";
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t sign out. Try again.",
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
        className="group flex min-h-11 cursor-pointer items-center gap-2 px-3 text-base transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border-2 border-border"
      >
        <span className="max-w-[100px] truncate">{userName}</span>
        <CaretDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[180px] border-3 border-border bg-popover p-0 text-popover-foreground shadow-hard"
      >
        <DropdownMenuItem
          onSelect={handleSettingsClick}
          disabled={isNavigatingToSettings || isOnSettingsPage}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-3 px-4 text-sm",
            "border-b-2 border-border",
            isOnSettingsPage
              ? "cursor-default bg-muted text-muted-foreground"
              : "hover:bg-muted"
          )}
        >
          {isNavigatingToSettings ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <Settings className={cn("size-4", isOnSettingsPage && "text-muted-foreground")} />
          )}
          {getSettingsLabel()}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={handleSignOut}
          disabled={isSigningOut}
          className="flex min-h-11 cursor-pointer items-center gap-3 px-4 text-sm hover:bg-muted"
        >
          {isSigningOut ? (
            <CircleNotchIcon className="size-4 animate-spin" />
          ) : (
            <SignOutIcon className="size-4" />
          )}
          {isSigningOut ? "Signing out..." : "Sign out"}
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
  // No name on file: the part of the address before the @, never a generic "User".
  const displayName = user?.name || user?.email?.split("@")[0] || "Account";

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
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load clears every signed-in query and cache
      window.location.href = "/login";
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t sign out. Try again.",
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
    <header className="sticky top-0 z-50 border-b-3 border-border bg-black">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-2 px-4 sm:px-8">
        {/* The same mark as the public header. The {" "} keeps the two words
            apart for anything that reads the page's text. */}
        <Link
          href="/dashboard"
          className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap font-heading text-xl font-bold text-foreground hover:bg-primary"
        >
          <FileTextIcon aria-hidden="true" className="size-6 text-primary-text" />
          <span>
            <span className="text-primary-text">PERM</span>{" "}Tracker
          </span>
        </Link>

        <nav aria-label="App" className="flex items-center gap-1 lg:gap-4">
          <div className="hidden items-center lg:flex">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const tourId = link.href === "/cases" ? "nav-cases" : link.href === "/calendar" ? "nav-calendar" : undefined;
              return (
                <Fragment key={link.href}>
                  <NavLink
                    href={link.href}
                    data-tour={tourId}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center border-b-2 px-3 text-base transition-colors",
                      isActive ? "border-primary-text font-semibold text-foreground" : "border-transparent text-soft hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </NavLink>{" "}
                </Fragment>
              );
            })}
          </div>

          <AppSearch />

          <NotificationBell>
            <NotificationDropdown />
          </NotificationBell>

          {/* A fixed-width slot: the name arrives from a query after the first
              paint, and a growing trigger would shove the links left. */}
          <div className="hidden w-[148px] shrink-0 justify-end lg:flex">
            {user && <UserMenu userName={displayName} />}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-11 items-center gap-2 px-2 text-base font-semibold hover:bg-accent lg:hidden border-2 border-border"
            aria-expanded={isMobileMenuOpen}
            aria-controls="app-mobile-menu"
          >
            {isMobileMenuOpen ? <XIcon className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            Menu
          </button>
        </nav>
      </div>

      {/* The phone's menu: one sheet */}
      {isMobileMenuOpen && (
        <div id="app-mobile-menu" className="absolute inset-x-0 top-full z-50 border-b border-border bg-background px-4 pb-6 lg:hidden">
          <nav aria-label="Menu" className="divide-y divide-border">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <NavLink
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("flex min-h-12 items-center text-lg", isActive ? "font-semibold text-foreground" : "text-soft")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              );
            })}

            {user && (
              <div className="pt-3">
                <p className="text-sm text-muted-foreground">{displayName}</p>
                <NavLink
                  href="/settings"
                  className="flex min-h-12 items-center gap-3 text-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Settings className="size-5" aria-hidden="true" />
                  Settings
                </NavLink>
                <button
                  onClick={handleMobileSignOut}
                  disabled={isSigningOut}
                  className="flex min-h-12 w-full items-center gap-3 text-left text-lg disabled:text-muted-foreground"
                >
                  {isSigningOut ? (
                    <CircleNotchIcon className="size-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <SignOutIcon className="size-5" aria-hidden="true" />
                  )}
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
