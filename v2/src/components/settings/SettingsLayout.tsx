"use client";

import { useCallback, useRef, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  User,
  Bell,
  Moon,
  Calendar,
  Shield,
  HelpCircle,
  LucideIcon,
} from "lucide-react";
import { useSettingsUnsavedChanges } from "./SettingsUnsavedChangesContext";

// ============================================================================
// TYPES
// ============================================================================

export type SettingsSectionType =
  | "profile"
  | "notifications"
  | "quiet-hours"
  | "calendar-sync"
  | "auto-close"
  | "support";

interface NavItem {
  id: SettingsSectionType;
  label: string;
  icon: LucideIcon;
}

interface SettingsLayoutProps {
  activeSection: SettingsSectionType;
  onSectionChange: (section: SettingsSectionType) => void;
  children: React.ReactNode;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "quiet-hours", label: "Quiet Hours", icon: Moon },
  { id: "calendar-sync", label: "Calendar Sync", icon: Calendar },
  { id: "auto-close", label: "Auto-Close", icon: Shield },
  { id: "support", label: "Support", icon: HelpCircle },
];

// ============================================================================
// HOOKS
// ============================================================================

function useTabKeyboardNavigation(
  items: NavItem[],
  onSelect: (id: SettingsSectionType) => void,
  buttonRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>,
  orientation: "horizontal" | "vertical"
): (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => void {
  return useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
      const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

      let newIndex: number | null = null;

      if (e.key === nextKey) {
        e.preventDefault();
        newIndex = (currentIndex + 1) % items.length;
      } else if (e.key === prevKey) {
        e.preventDefault();
        newIndex = (currentIndex - 1 + items.length) % items.length;
      } else if (e.key === "Home") {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === "End") {
        e.preventDefault();
        newIndex = items.length - 1;
      }

      if (newIndex !== null) {
        const newItem = items[newIndex];
        if (newItem) {
          onSelect(newItem.id);
          requestAnimationFrame(() => {
            buttonRefs.current.get(newItem.id)?.focus();
          });
        }
      }
    },
    [items, onSelect, buttonRefs, orientation]
  );
}

// ============================================================================
// NAV BUTTON COMPONENT
// ============================================================================

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
  variant: "sidebar" | "tab";
  tabIndex?: number;
  setRef?: (el: HTMLButtonElement | null) => void;
}

function NavButton({
  item,
  isActive,
  onClick,
  onKeyDown,
  variant,
  tabIndex,
  setRef,
}: NavButtonProps): React.ReactElement {
  const Icon = item.icon;

  return (
    <button
      ref={setRef}
      type="button"
      role="tab"
      id={`settings-tab-${item.id}`}
      aria-selected={isActive}
      aria-controls={`settings-panel-${item.id}`}
      tabIndex={tabIndex}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={cn(
        "flex items-center gap-3 text-sm font-heading font-bold border-2 transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        // Mobile-first: 44px minimum touch target (py-3 on mobile for tabs, sidebar always has py-3)
        variant === "sidebar" && "w-full px-4 py-3 text-left",
        variant === "tab" && "px-4 py-3 whitespace-nowrap",
        isActive
          ? cn(
              "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black",
              variant === "sidebar" && "shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_rgba(255,255,255,0.3)]"
            )
          : "border-transparent text-muted-foreground hover:border-black/50 hover:text-foreground dark:hover:border-white/50"
      )}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
    </button>
  );
}

// ============================================================================
// NAV LIST COMPONENT (shared logic for sidebar and tabs)
// ============================================================================

interface NavListProps {
  activeSection: SettingsSectionType;
  onSectionChange: (section: SettingsSectionType) => void;
  variant: "sidebar" | "tab";
  orientation: "horizontal" | "vertical";
  className?: string;
}

function NavList({
  activeSection,
  onSectionChange,
  variant,
  orientation,
  className,
}: NavListProps): React.ReactElement {
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = useTabKeyboardNavigation(
    NAV_ITEMS,
    onSectionChange,
    buttonRefs,
    orientation
  );

  function setButtonRef(id: string): (el: HTMLButtonElement | null) => void {
    return (el) => {
      if (el) {
        buttonRefs.current.set(id, el);
      } else {
        buttonRefs.current.delete(id);
      }
    };
  }

  return (
    <nav
      className={className}
      role="tablist"
      aria-label="Settings navigation"
      aria-orientation={orientation}
    >
      {NAV_ITEMS.map((item, index) => (
        <NavButton
          key={item.id}
          item={item}
          isActive={activeSection === item.id}
          onClick={() => onSectionChange(item.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          variant={variant}
          tabIndex={activeSection === item.id ? 0 : -1}
          setRef={setButtonRef(item.id)}
        />
      ))}
    </nav>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
}: SettingsLayoutProps): React.ReactElement {
  const { requestNavigation, hasUnsavedChanges } = useSettingsUnsavedChanges();

  const handleSectionChange = useCallback(
    (section: SettingsSectionType) => {
      if (section === activeSection) return;

      if (hasUnsavedChanges) {
        requestNavigation(() => onSectionChange(section));
      } else {
        onSectionChange(section);
      }
    },
    [activeSection, hasUnsavedChanges, requestNavigation, onSectionChange]
  );

  return (
    <div className="flex flex-col md:flex-row gap-8">
      {/* Mobile tabs */}
      <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-4 mb-4 border-b-2 border-black dark:border-white/50">
        <NavList
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          variant="tab"
          orientation="horizontal"
          className="flex gap-2"
        />
      </div>

      {/* Desktop sidebar */}
      <NavList
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        variant="sidebar"
        orientation="vertical"
        className="hidden md:flex flex-col gap-2 w-56 flex-shrink-0"
      />

      {/* Content area with tab switch animation */}
      <main
        className="flex-1 min-w-0"
        role="tabpanel"
        id={`settings-panel-${activeSection}`}
        aria-labelledby={`settings-tab-${activeSection}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export { NAV_ITEMS };
