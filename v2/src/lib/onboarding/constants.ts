import type { ChecklistItem, UserRole, TourPhaseConfig } from "./types";

/** Roles offered during onboarding */
export const ONBOARDING_ROLES: {
  role: UserRole;
  description: string;
  icon: string;
}[] = [
  {
    // Listed FIRST. It is the largest group arriving here, and it gets its
    // own short path: one case number and an email when DOL moves it.
    role: "Waiting on my own case",
    description: "You're the applicant. Watch your case by email",
    icon: "UserCheck",
  },
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

/** Checklist items for the Getting Started widget */
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "create_case",
    label: "Create your first case",
    description: "Done during setup",
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
    label: "Dashboard",
    page: "/dashboard",
    steps: [
      {
        element: "[data-tour='deadline-hero']",
        title: "Deadlines",
        description:
          "Every deadline in your cases, grouped by when it falls, with the next one named at the top. Late ones come first.",
      },
      {
        element: "[data-tour='summary-tiles']",
        title: "Cases by stage",
        description: "How many cases sit at each stage. Each count opens those cases.",
      },
      {
        element: "[data-tour='recent-activity']",
        title: "Recent changes",
        description: "The cases changed most recently, newest first.",
      },
    ],
  },
  {
    phase: "cases",
    label: "Cases",
    page: "/cases",
    steps: [
      {
        element: "[data-tour='cases-list']",
        title: "Your case list",
        description:
          "Every PERM case in one place. Sort by deadline, filter by stage, search by name, and click any case to see full details and edit dates.",
      },
    ],
  },
  {
    phase: "calendar",
    label: "Calendar",
    page: "/calendar",
    steps: [
      {
        element: "[data-tour='calendar-view']",
        title: "Deadline calendar",
        description:
          "All your deadlines on a monthly calendar. Connect Google Calendar in Settings to sync everything automatically.",
      },
    ],
  },
  {
    phase: "settings",
    label: "Settings",
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
    label: "Getting around",
    page: "/dashboard",
    steps: [
      {
        element: "[data-tour='nav-cases']",
        title: "Quick navigation",
        description:
          "Jump between Cases, Calendar, and Timeline from any page. All your tools are one click away.",
      },
      {
        element: "[data-tour='chat-bubble']",
        title: "Your AI assistant",
        description:
          "Click this bubble to open the AI assistant. Ask about PERM deadlines, get case status summaries, or learn about the immigration process. Try saying \"What are my upcoming deadlines?\" to start.",
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
