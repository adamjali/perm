"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { FileTextIcon, FolderOpenIcon, NoteIcon as StickyNote, ScalesIcon as Scale, SquaresFourIcon as LayoutDashboard, UsersIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type TabId =
  | "overview"
  | "recruitment"
  | "eta9089"
  | "i140"
  | "documents"
  | "notes";

interface TabConfig {
  id: TabId;
  label: string;
  icon: typeof LayoutDashboard;
}

const TABS: TabConfig[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "recruitment", label: "Recruitment", icon: UsersIcon },
  { id: "eta9089", label: "ETA 9089", icon: FileTextIcon },
  { id: "i140", label: "I-140", icon: Scale },
  { id: "documents", label: "Documents", icon: FolderOpenIcon },
  { id: "notes", label: "Notes", icon: StickyNote },
];

interface CaseDetailTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  className?: string;
  children: React.ReactNode;
}

export function CaseDetailTabs({
  activeTab,
  onTabChange,
  className,
  children,
}: CaseDetailTabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // On a phone the bar scrolls sideways; keep the open section's tab in view.
  useEffect(() => {
    const i = TABS.findIndex((t) => t.id === activeTab);
    tabRefs.current[i]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeTab]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = TABS.findIndex((t) => t.id === activeTab);
      let nextIndex = currentIndex;

      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % TABS.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = TABS.length - 1;
      } else {
        return;
      }

      e.preventDefault();
      onTabChange(TABS[nextIndex]!.id);
      tabRefs.current[nextIndex]?.focus();
    },
    [activeTab, onTabChange]
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Tab Bar */}
      <div
        className="section-tab-bar"
        role="tablist"
        aria-label="Case detail sections"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className="section-tab"
              onClick={() => onTabChange(tab.id)}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Folder Body */}
      <div className="section-tab-body">
        <div className="section-tab-content">{children}</div>
      </div>
    </div>
  );
}

// Re-export for tab panel wrapper
interface TabPanelProps {
  id: TabId;
  activeTab: TabId;
  children: React.ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
    >
      {children}
    </div>
  );
}
