"use client";

import { useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";
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
  | "api-keys"
  | "support";

interface NavItem {
  id: SettingsSectionType;
  label: string;
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
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "quiet-hours", label: "Quiet hours" },
  { id: "calendar-sync", label: "Calendar sync" },
  { id: "auto-close", label: "Auto-close" },
  { id: "api-keys", label: "API keys" },
  { id: "support", label: "Support" },
];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * One menu of sections: a scrolling row on a phone, a column beside the
 * content from `md` up. It's rendered once, so every tab has one id, and the
 * arrow keys move along it either way.
 */
export default function SettingsLayout({
  activeSection,
  onSectionChange,
  children,
}: SettingsLayoutProps): React.ReactElement {
  const { requestNavigation, hasUnsavedChanges } = useSettingsUnsavedChanges();
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // On a phone the tabs are one row that scrolls sideways; keep the open one in view.
  useEffect(() => {
    buttonRefs.current.get(activeSection)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeSection]);

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

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
      const last = NAV_ITEMS.length - 1;
      const step: Record<string, number> = {
        ArrowDown: currentIndex + 1,
        ArrowRight: currentIndex + 1,
        ArrowUp: currentIndex - 1,
        ArrowLeft: currentIndex - 1,
        Home: 0,
        End: last,
      };
      const target = step[e.key];
      if (target === undefined) return;
      e.preventDefault();
      const next = NAV_ITEMS[(target + NAV_ITEMS.length) % NAV_ITEMS.length];
      if (!next) return;
      handleSectionChange(next.id);
      requestAnimationFrame(() => buttonRefs.current.get(next.id)?.focus());
    },
    [handleSectionChange]
  );

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <nav
        role="tablist"
        aria-label="Settings sections"
        className="-mx-4 flex shrink-0 gap-2 overflow-x-auto overscroll-x-none px-4 pb-1 md:mx-0 md:w-52 md:flex-col md:gap-1 md:overflow-visible md:px-0"
      >
        {NAV_ITEMS.map((item, index) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(item.id, el);
                else buttonRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`settings-tab-${item.id}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSectionChange(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              // A row of choices on a phone; in the column, the chosen one
              // keeps its tint and the rest lose their outline.
              className={cn(
                choiceVariants({ on: isActive }),
                "shrink-0 whitespace-nowrap md:justify-start md:border-transparent md:px-3",
                !isActive && "md:bg-transparent md:hover:border-transparent md:hover:bg-muted",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div
        className="min-w-0 flex-1"
        role="tabpanel"
        id={`settings-panel-${activeSection}`}
        aria-labelledby={`settings-tab-${activeSection}`}
      >
        {children}
      </div>
    </div>
  );
}

export { NAV_ITEMS };
