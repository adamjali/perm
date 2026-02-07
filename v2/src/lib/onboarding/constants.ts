import type { ChecklistItem, UserRole, TourPhaseConfig } from "./types";

/** Roles offered during onboarding */
export const ONBOARDING_ROLES: {
  role: UserRole;
  description: string;
  icon: string;
}[] = [
  {
    role: "Immigration Attorney",
    description: "Managing PERM cases for clients",
    icon: "Scale",
  },
  {
    role: "Paralegal",
    description: "Assisting attorneys with case preparation",
    icon: "Briefcase",
  },
  {
    role: "HR Professional",
    description: "Handling PERM for company employees",
    icon: "Building2",
  },
  {
    role: "Employer/Petitioner",
    description: "Sponsoring a worker for permanent residency",
    icon: "UserCheck",
  },
  {
    role: "Other",
    description: "Exploring PERM Tracker",
    icon: "HelpCircle",
  },
];

/** PERM stages for the case creation step */
export const PERM_STAGES = [
  { value: "pwd", label: "PWD", color: "bg-blue-500" },
  { value: "recruitment", label: "Recruitment", color: "bg-purple-500" },
  { value: "eta9089", label: "ETA 9089", color: "bg-orange-500" },
  { value: "i140", label: "I-140", color: "bg-green-600" },
] as const;

/** Checklist items for the Getting Started widget */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "create_case",
    label: "Create your first case",
    description: "Already done during setup!",
  },
  {
    id: "add_dates",
    label: "Add dates to your case",
    description: "Enter PWD filing date, determination date, or other key dates",
    href: "/cases",
  },
  {
    id: "explore_calendar",
    label: "Explore the deadline calendar",
    description: "See all your case deadlines at a glance",
    href: "/calendar",
  },
  {
    id: "setup_notifications",
    label: "Set up notifications",
    description: "Never miss a deadline with email and push alerts",
    href: "/settings",
  },
  {
    id: "try_assistant",
    label: "Try the AI assistant",
    description: "Ask questions about your cases or PERM process",
  },
  {
    id: "explore_settings",
    label: "Explore settings",
    description: "Customize quiet hours, calendar sync, and more",
    href: "/settings",
  },
];

/** Multi-phase tour configuration — navigates across pages */
export const TOUR_PHASES: TourPhaseConfig[] = [
  {
    phase: "dashboard",
    page: "/dashboard",
    steps: [
      {
        element: "[data-tour='deadline-hero']",
        title: "Deadline Command Center",
        description:
          "Your most critical view — every deadline grouped by urgency. Overdue items surface first so nothing slips through the cracks.",
      },
      {
        element: "[data-tour='summary-tiles']",
        title: "Case Pipeline",
        description:
          "Instant snapshot of all cases by PERM stage. Click any tile to jump straight to those cases.",
      },
      {
        element: "[data-tour='upcoming-deadlines']",
        title: "30-Day Lookahead",
        description:
          "Deadlines approaching in the next month. Each links directly to its case for quick action.",
      },
      {
        element: "[data-tour='recent-activity']",
        title: "Activity Feed",
        description:
          "Every change across all your cases — status updates, date edits, new notes — in real time.",
      },
    ],
  },
  {
    phase: "cases",
    page: "/cases",
    steps: [
      {
        element: "[data-tour='cases-list']",
        title: "Your Case List",
        description:
          "Every PERM case in one place. Sort by deadline, filter by stage, search by name — and click any case to see full details and edit dates.",
      },
    ],
  },
  {
    phase: "calendar",
    page: "/calendar",
    steps: [
      {
        element: "[data-tour='calendar-view']",
        title: "Deadline Calendar",
        description:
          "All your deadlines on a monthly calendar. Connect Google Calendar in Settings to sync everything automatically.",
      },
    ],
  },
  {
    phase: "settings",
    page: "/settings",
    steps: [
      {
        element: "[data-tour='settings-page']",
        title: "Settings & Notifications",
        description:
          "Configure email reminders, push notifications, quiet hours, and Google Calendar sync. Customize everything to your workflow.",
      },
    ],
  },
  {
    phase: "chat",
    page: "/dashboard",
    steps: [
      {
        element: "[data-tour='nav-cases']",
        title: "Quick Navigation",
        description:
          "Jump between Cases, Calendar, and Timeline from any page. All your tools are one click away.",
      },
      {
        element: "[data-tour='chat-bubble']",
        title: "Your AI Assistant",
        description:
          "Click this bubble to open the AI assistant. Ask about PERM deadlines, get case status summaries, or learn about the immigration process. Try saying \"What are my upcoming deadlines?\" to get started!",
      },
    ],
  },
];

/** Ordered list of tour phase keys for navigation */
export const TOUR_PHASE_ORDER = TOUR_PHASES.map((p) => p.phase);

/** Legacy flat TOUR_STEPS — kept for backwards compat, derived from phases */
export const TOUR_STEPS = TOUR_PHASES.flatMap((phase) =>
  phase.steps.map((step) => ({
    element: step.element,
    popover: {
      title: step.title,
      description: step.description,
    },
  }))
);
