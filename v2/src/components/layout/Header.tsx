"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "@/lib/toast";
import { ChevronDown, Settings, LogOut, FileText, Loader2, Menu, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { AUTHENTICATED_NAV_LINKS, ADMIN_NAV_LINK } from "@/lib/constants/navigation";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { ADMIN_EMAIL } from "@/lib/admin/adminAuth";
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
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();

  const [isNavigatingToSettings, setIsNavigatingToSettings] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const isOnSettingsPage = pathname === "/settings";

  // Reset navigation state when pathname changes
  useEffect(() => {
    setIsNavigatingToSettings(false);
  }, [pathname]);

  // Safety timeout: reset spinner after 3 seconds if navigation is slow
  useEffect(() => {
    if (!isNavigatingToSettings) return;
    const timeout = setTimeout(() => setIsNavigatingToSettings(false), 3000);
    return () => clearTimeout(timeout);
  }, [isNavigatingToSettings]);

  function handleSettingsClick(): void {
    if (isOnSettingsPage) return;
    setIsNavigatingToSettings(true);
    setIsOpen(false);
    router.push("/settings");
  }

  async function handleSignOut(): Promise<void> {
    if (isSigningOut) return;

    beginSignOut();
    setIsOpen(false);
    try {
      await signOut();
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      cancelSignOut();
      toast.error("Failed to sign out. Please try again.");
    }
  }

  function getSettingsLabel(): string {
    if (isNavigatingToSettings) return "Loading...";
    if (isOnSettingsPage) return "Already on Settings";
    return "Settings";
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        className="flex cursor-pointer items-center gap-2 rounded-none border-2 border-transparent bg-transparent px-3 py-2 text-sm font-medium text-white transition-all hover:border-white/50 hover:bg-white/10 focus:outline-none"
      >
        <span className="max-w-[120px] truncate">{userName}</span>
        <ChevronDown className={cn(
          "size-4 transition-transform duration-150",
          isOpen && "rotate-180"
        )} />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-[180px] border-4 border-black bg-white shadow-hard rounded-none p-0"
      >
        <DropdownMenuItem
          onClick={handleSettingsClick}
          disabled={isNavigatingToSettings || isOnSettingsPage}
          className={cn(
            "flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-none cursor-pointer",
            "border-b-2 border-black",
            isOnSettingsPage
              ? "bg-gray-100 text-gray-400 cursor-default"
              : "text-black hover:bg-gray-100"
          )}
        >
          {isNavigatingToSettings ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Settings className={cn("size-4", isOnSettingsPage && "text-gray-400")} />
          )}
          {getSettingsLabel()}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex items-center gap-3 px-4 py-3 text-sm font-semibold text-black rounded-none cursor-pointer hover:bg-gray-100"
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
  const router = useRouter();
  const user = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();
  const { isSigningOut, beginSignOut, cancelSignOut } = useAuthContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      cancelSignOut();
      toast.error("Failed to sign out. Please try again.");
    }
  }

  // Enable toast notifications for new notifications
  useNotificationToasts();

  // Check if user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  // Build nav links with conditional admin link
  const navLinks = isAdmin
    ? [...AUTHENTICATED_NAV_LINKS, ADMIN_NAV_LINK]
    : AUTHENTICATED_NAV_LINKS;

  return (
    <header className="sticky top-0 z-50 border-b-4 border-black bg-black dark:border-white dark:bg-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="group flex items-center gap-2 px-2 py-1 text-2xl font-bold font-heading transition-all duration-150 hover:bg-primary hover:shadow-hard"
        >
          <FileText
            className="size-6 text-primary transition-colors group-hover:text-black"
            strokeWidth={2.5}
          />
          <span>
            <span className="text-primary transition-colors group-hover:text-black">PERM</span>
            <span className="text-white transition-colors group-hover:text-black"> Tracker</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-4 sm:gap-8">
          {/* Desktop Navigation - hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <NavLink
                  key={link.href}
                  href={link.href}
                  spinnerClassName="text-primary"
                  className={cn(
                    "hover-underline px-3 lg:px-4 py-2 text-sm font-semibold font-heading uppercase tracking-wide transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-white hover:text-primary"
                  )}
                >
                  {link.label}
                </NavLink>
              );
            })}
          </div>

          {/* Notification bell - always visible */}
          <NotificationBell>
            <NotificationDropdown />
          </NotificationBell>

          {/* User dropdown - hidden on mobile, shown in mobile menu */}
          <div className="hidden md:block">
            {user && <UserMenu userName={user.name ?? "User"} />}
          </div>

          {/* Theme toggle - always visible */}
          <ThemeToggle />

          {/* Mobile Menu Button - visible on mobile only */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex md:hidden h-11 w-11 items-center justify-center border-2 border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b-4 border-white/20 bg-black px-4 py-4 md:hidden z-50">
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
                  {user.name ?? "User"}
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
