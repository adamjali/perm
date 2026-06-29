# Codebase Structure

**Analysis Date:** 2026-02-21

## Directory Layout

```
perm-tracker/                      # Repository root
├── .claude/                       # Claude Code settings
├── .github/
│   └── workflows/
│       ├── claude-code-review.yml # Claude-powered PR review
│       ├── claude.yml             # Claude CI workflow
│       └── codeql-analysis.yml    # CodeQL security scanning
├── .planning/                     # GSD planning documents
│   └── codebase/                  # Architecture/structure docs (this file)
├── docs/
│   └── images/                    # Documentation images
├── page_audits/                   # Page audit reports
├── CLAUDE.md                      # Root-level project instructions
├── LICENSE                        # License file
├── README.md                      # Repository README
├── perm_flow.md                   # Canonical PERM workflow reference (domain spec)
└── v2/                            # ** ALL APPLICATION CODE **
    ├── .storybook/                # Storybook configuration
    ├── .vercel/                   # Vercel project config (linked to "perm")
    ├── content/                   # MDX content hub articles
    │   ├── blog/                  # Blog posts (3 articles)
    │   ├── changelog/             # Product changelog (2 entries)
    │   ├── guides/                # Reference guides (3 guides)
    │   ├── resources/             # PERM resources (1 article)
    │   └── tutorials/             # Step-by-step tutorials (3 tutorials)
    ├── convex/                    # ** CONVEX BACKEND **
    │   ├── _generated/            # Auto-generated Convex types (DO NOT EDIT)
    │   ├── __tests__/             # Convex function integration tests
    │   ├── lib/                   # Shared backend helpers
    │   │   ├── __tests__/         # Lib unit tests
    │   │   ├── perm/              # ** CENTRAL PERM BUSINESS LOGIC **
    │   │   │   ├── calculators/   # PWD, ETA9089, recruitment, I-140, RFI calculators
    │   │   │   ├── dates/         # Business day, holiday, filing window logic
    │   │   │   │   └── __tests__/ # Date utility tests
    │   │   │   ├── deadlines/     # Deadline extraction, supersession, timezone rules
    │   │   │   ├── recruitment/   # Recruitment completeness checks, method categories
    │   │   │   │   └── __tests__/ # Recruitment tests
    │   │   │   ├── utils/         # Field mapper (snake_case <-> camelCase)
    │   │   │   │   └── __tests__/ # Field mapper tests
    │   │   │   └── validators/    # All PERM validation rules
    │   │   │       └── __tests__/ # Validator tests
    │   │   └── rag/               # RAG knowledge base content
    │   └── *.ts                   # Convex function files (queries/mutations/actions)
    ├── coverage/                  # Test coverage reports (generated)
    ├── docs/                      # Developer documentation
    ├── outreach/                  # Private launch/outreach docs (gitignored)
    ├── page_audits/               # Page audit results
    ├── public/                    # Static assets
    │   ├── .well-known/           # Web standards files
    │   ├── images/                # All images
    │   │   ├── backgrounds/       # Background patterns
    │   │   ├── content/           # Content hub images
    │   │   ├── empty-states/      # Empty state illustrations
    │   │   ├── features/          # Feature illustrations
    │   │   ├── hero/              # Hero section images
    │   │   ├── journey/           # PERM journey photos
    │   │   └── screenshots/       # App screenshots and walkthroughs
    │   │       └── archive/       # Archived screenshots
    │   └── lottie/                # Lottie animation JSON files
    ├── scripts/
    │   └── migration/             # v1->v2 migration scripts
    │       └── logs/              # Migration logs
    ├── src/                       # ** NEXT.JS FRONTEND SOURCE **
    │   ├── app/                   # Next.js App Router pages
    │   │   ├── (auth)/            # Auth layout group
    │   │   │   ├── login/         # Login page
    │   │   │   ├── signup/        # Signup page
    │   │   │   └── reset-password/# Password reset
    │   │   ├── (authenticated)/   # Authenticated layout group
    │   │   │   ├── admin/         # Admin dashboard
    │   │   │   ├── calendar/      # Calendar view
    │   │   │   ├── cases/         # Case management
    │   │   │   │   ├── [id]/      # Case detail + edit pages
    │   │   │   │   │   └── edit/  # Case edit page
    │   │   │   │   ├── components/# Cases-specific components
    │   │   │   │   ├── hooks/     # Cases-specific hooks
    │   │   │   │   └── new/       # New case page
    │   │   │   ├── dashboard/     # Main dashboard
    │   │   │   ├── notifications/ # Notification center
    │   │   │   ├── settings/      # User settings
    │   │   │   └── timeline/      # Timeline view
    │   │   ├── (public)/          # Public layout group
    │   │   │   ├── blog/          # Blog listing + [slug]
    │   │   │   ├── changelog/     # Changelog page
    │   │   │   ├── contact/       # Contact page
    │   │   │   ├── demo/          # Interactive demo
    │   │   │   ├── guides/        # Guides listing + [slug]
    │   │   │   ├── privacy/       # Privacy policy
    │   │   │   ├── resources/     # Resources listing + [slug]
    │   │   │   ├── terms/         # Terms of service
    │   │   │   └── tutorials/     # Tutorials listing + [slug]
    │   │   ├── api/               # API route handlers
    │   │   │   ├── chat/          # AI chat streaming + tool execution
    │   │   │   ├── google/        # Google OAuth (connect/callback/disconnect)
    │   │   │   ├── health/        # Health check endpoint
    │   │   │   └── sentry-check/  # Sentry config check
    │   │   ├── sentry-example-page/ # Sentry test page
    │   │   └── ~offline/          # PWA offline fallback
    │   ├── components/            # React components
    │   │   ├── admin/             # Admin dashboard components
    │   │   ├── auth/              # Auth components (LoginTracker, PendingTermsHandler)
    │   │   ├── calendar/          # Calendar view components
    │   │   ├── cases/             # Case management components
    │   │   │   ├── __tests__/     # Case component tests
    │   │   │   └── detail/        # Case detail view components
    │   │   │       ├── __tests__/ # Detail component tests
    │   │   │       └── quick-edit/# Inline editing components
    │   │   ├── chat/              # AI chatbot components
    │   │   │   └── __tests__/     # Chat component tests
    │   │   ├── content/           # Content hub components (22 components)
    │   │   ├── dashboard/         # Dashboard widgets
    │   │   │   └── __tests__/     # Dashboard component tests
    │   │   ├── demo/              # Demo page components
    │   │   ├── empty-states/      # Empty state illustrations
    │   │   │   └── __tests__/     # Empty state tests
    │   │   ├── error/             # Error handling components
    │   │   │   └── __tests__/     # Error component tests
    │   │   ├── forms/             # Case form components
    │   │   │   ├── __tests__/     # Form component tests
    │   │   │   └── sections/      # Form section components
    │   │   │       └── __tests__/ # Section tests
    │   │   ├── home/              # Homepage sections (15 components)
    │   │   ├── illustrations/     # SVG illustrations
    │   │   │   └── animated/      # Animated SVG components
    │   │   ├── job-description/   # Job description template components
    │   │   │   └── __tests__/     # JD template tests
    │   │   ├── layout/            # Layout components (Header, Footer, etc.)
    │   │   │   └── __tests__/     # Layout tests
    │   │   ├── notifications/     # Notification UI components
    │   │   │   └── __tests__/     # Notification tests
    │   │   ├── onboarding/        # Onboarding wizard + tour
    │   │   │   └── steps/         # Wizard step components
    │   │   ├── providers/         # Theme provider
    │   │   ├── pwa/               # PWA service worker registration
    │   │   ├── settings/          # Settings page sections
    │   │   │   └── __tests__/     # Settings tests
    │   │   ├── skeletons/         # Loading skeleton components
    │   │   ├── status/            # PERM status badge components
    │   │   ├── timeline/          # Timeline view components
    │   │   │   └── __tests__/     # Timeline tests
    │   │   └── ui/                # Core UI primitives (shadcn/ui + custom)
    │   │       └── patterns/      # UI pattern components
    │   ├── emails/                # React Email templates (13 templates)
    │   │   ├── __tests__/         # Email template tests
    │   │   └── components/        # Shared email components
    │   ├── hooks/                 # Top-level custom hooks
    │   │   └── __tests__/         # Hook tests
    │   ├── lib/                   # Frontend libraries
    │   │   ├── __tests__/         # Lib tests
    │   │   ├── admin/             # Admin types
    │   │   ├── ai/                # AI chat system (providers, tools, prompts)
    │   │   │   └── __tests__/     # AI tests
    │   │   ├── auth/              # Auth utilities
    │   │   │   └── __tests__/     # Auth tests
    │   │   ├── calendar/          # Calendar utilities
    │   │   ├── constants/         # App constants
    │   │   ├── content/           # MDX content processing
    │   │   │   └── __tests__/     # Content tests
    │   │   ├── contexts/          # React contexts
    │   │   │   └── __tests__/     # Context tests
    │   │   ├── demo/              # Demo data and logic
    │   │   │   └── __tests__/     # Demo tests
    │   │   ├── export/            # Data export utilities
    │   │   │   └── __tests__/     # Export tests
    │   │   ├── forms/             # Form utilities
    │   │   │   └── __tests__/     # Form utility tests
    │   │   ├── google/            # Google API helpers
    │   │   │   └── __tests__/     # Google tests
    │   │   ├── hooks/             # Lib-level hooks (useTilt, useGSAP, useInactivityTimeout)
    │   │   │   └── __tests__/     # Hook tests
    │   │   ├── import/            # Case import utilities
    │   │   │   └── __tests__/     # Import tests
    │   │   ├── onboarding/        # Onboarding logic
    │   │   ├── perm/              # Frontend re-exports of convex/lib/perm
    │   │   ├── processing-times/  # PERM processing time estimates
    │   │   ├── recruitment/       # Recruitment UI helpers
    │   │   │   └── __tests__/     # Recruitment tests
    │   │   ├── shared/            # Shared utilities
    │   │   ├── status/            # Status display helpers
    │   │   ├── testing/           # Test utilities
    │   │   ├── timeline/          # Timeline computation
    │   │   │   └── __tests__/     # Timeline tests
    │   │   └── utils/             # General utilities
    │   │       └── __tests__/     # Utility tests
    │   └── remotion/              # Remotion video compositions
    │       ├── components/        # Shared Remotion components
    │       └── compositions/      # Video compositions
    ├── test-utils/                # Shared test fixtures and utilities
    └── tests/
        └── e2e/                   # Playwright E2E tests
```

## Directory Purposes

### Root-level Files

| File | Purpose |
|------|---------|
| `perm_flow.md` | Canonical PERM workflow reference -- all deadline rules and business logic source of truth |
| `CLAUDE.md` | Root-level developer instructions and project overview |
| `.gitignore` | Git ignore rules |
| `README.md` | Repository README with architecture overview |
| `LICENSE` | MIT license |

### `v2/` -- Application Root

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Primary developer documentation (tech stack, patterns, conventions) |
| `TEST_README.md` | Comprehensive testing guide |
| `LAUNCH_GUIDE.md` | Production launch checklist |
| `package.json` | Dependencies and scripts (pnpm) |
| `pnpm-lock.yaml` | Lockfile |
| `pnpm-workspace.yaml` | Workspace config |
| `next.config.ts` | Next.js config (Serwist, Sentry, security headers, redirects) |
| `tsconfig.json` | TypeScript config (strict mode) |
| `eslint.config.mjs` | ESLint config |
| `postcss.config.mjs` | PostCSS config (Tailwind) |
| `vitest.config.ts` | Vitest config (3 projects: unit, components, convex) |
| `vitest.setup.ts` | Vitest setup (DOM mocking, matchMedia, ResizeObserver) |
| `vitest.setup.convex.ts` | Vitest setup for Convex tests |
| `playwright.config.ts` | Playwright E2E config |
| `run-e2e-tests.sh` | E2E test runner script |
| `sentry.client.config.ts` | Sentry browser config (Session Replay, console logging) |
| `sentry.server.config.ts` | Sentry Node.js server config |
| `sentry.edge.config.ts` | Sentry Edge/middleware config |
| `components.json` | shadcn/ui configuration |
| `convex.json` | Convex project configuration |
| `serwist.d.ts` | Serwist type declarations |
| `.npmrc` | npm config |

### `v2/convex/` -- Convex Backend

| File | Purpose |
|------|---------|
| `schema.ts` | **Database schema** -- single source of truth for all 14+ tables |
| `auth.ts` | Auth providers (Google, Password) + `createOrUpdateUser` callback |
| `auth.config.ts` | Auth configuration |
| `cases.ts` | Case CRUD queries/mutations (list, get, create, update, delete) |
| `dashboard.ts` | Dashboard queries (deadlines, summary, activity) |
| `notifications.ts` | Notification queries/mutations (list, mark read, dismiss) |
| `notificationActions.ts` | Email sending actions via Resend (internal actions) |
| `conversations.ts` | Chat conversation CRUD |
| `conversationMessages.ts` | Chat message queries/mutations |
| `conversationSummary.ts` | Conversation summarization mutations |
| `users.ts` | User profile queries/mutations |
| `admin.ts` | Admin dashboard queries/mutations |
| `timeline.ts` | Timeline view queries |
| `calendar.ts` | Calendar view queries |
| `deadlineEnforcement.ts` | Auto-closure mutation (checks expired deadlines) |
| `scheduledJobs.ts` | All cron job handlers (internal functions) |
| `crons.ts` | Cron job definitions (6 scheduled tasks) |
| `http.ts` | HTTP route definitions (Resend webhook) |
| `pushNotifications.ts` | Web Push actions (`"use node"` runtime) |
| `pushSubscriptions.ts` | Push subscription queries/mutations |
| `googleAuth.ts` | Google OAuth token management |
| `googleCalendarSync.ts` | Calendar sync internal queries/mutations |
| `googleCalendarActions.ts` | Google Calendar API actions (`"use node"` runtime) |
| `knowledge.ts` | RAG knowledge base search action |
| `webSearch.ts` | Web search action (Tavily + Brave fallback) |
| `chatCaseData.ts` | Case data formatting for chat context |
| `toolCache.ts` | AI tool result caching mutations |
| `apiUsage.ts` | API usage tracking (rate limits for search providers) |
| `dataExport.ts` | User data export action |
| `supportEmail.ts` | Inbound support email processing |
| `sentryReportAction.ts` | Sentry HTTP API bridge (for mutations) |
| `systemErrors.ts` | System error recording mutations |
| `jobDescriptionTemplates.ts` | Job description template CRUD |
| `userCaseOrder.ts` | Custom case ordering mutations |
| `onboarding.ts` | Onboarding state mutations |
| `welcomeEmail.ts` | Welcome email action |
| `welcomeEmailHelpers.ts` | Welcome email content helpers |
| `authRateLimit.ts` | Auth rate limiting functions |
| `convex.config.ts` | Convex app config (registers RAG plugin) |
| `ResendOTP.ts` | Resend OTP verification provider |
| `ResendPasswordReset.ts` | Resend password reset provider |

### `v2/convex/lib/` -- Backend Helpers

| File | Purpose |
|------|---------|
| `auth.ts` | Auth guards: `getCurrentUserId()`, `verifyOwnership()`, `verifyFirmAccess()` |
| `admin.ts` | Admin authorization: `requireAdmin()`, `getAdminProfile()` |
| `audit.ts` | Audit logging: `logCreate()`, `logUpdate()`, `logDelete()` |
| `validation.ts` | Input validation: string length limits, sanitization |
| `email.ts` | Shared email config: `getResend()`, `FROM_EMAIL` |
| `crypto.ts` | Encryption: `encryptToken()`, `decryptToken()` (FEIN, OAuth tokens) |
| `errorRecording.ts` | Unified error recording: DB + admin email + Sentry |
| `sentry.ts` | Sentry HTTP store API utility |
| `logging.ts` | Structured logging with named loggers |
| `userDefaults.ts` | Default profile factory: `buildDefaultProfile()` |
| `userProfileHelpers.ts` | Profile lookup utilities |
| `notificationHelpers.ts` | Notification formatting, shouldSendEmail checks |
| `deadlineEnforcementHelpers.ts` | Pure deadline violation detection logic |
| `deadlineTypeMapping.ts` | Deadline type string mappings |
| `dashboardHelpers.ts` | Dashboard data extraction/grouping |
| `dashboardTypes.ts` | Dashboard TypeScript types |
| `derivedCalculations.ts` | Filing window, recruitment window computation |
| `derivedCalculations.test.ts` | Derived calculation tests |
| `dateTypes.ts` | Date type utilities |
| `dateValidation.ts` | ISO date validation and safe parsing |
| `formatDate.ts` | Date formatting helpers |
| `caseListHelpers.ts` | Case list filtering, sorting, projection |
| `caseListTypes.ts` | Case list pagination and sort types |
| `calendarEventExtractor.ts` | Calendar event extraction from case data |
| `calendarHelpers.ts` | Calendar deadline extraction |
| `calendarSyncHelpers.ts` | Calendar sync scheduling |
| `calendarTypes.ts` | Calendar TypeScript types |
| `googleHelpers.ts` | Google API token refresh |
| `digestHelpers.ts` | Weekly digest content builder |
| `deletion.ts` | Account deletion: `purgeAllUserData()` |
| `rateLimit.ts` | Rate limit checking logic |

### `v2/convex/lib/perm/` -- PERM Business Logic

| File | Purpose |
|------|---------|
| `index.ts` | Main barrel export -- re-exports everything |
| `types.ts` | Core types: `ISODateString`, `CaseData`, `ValidationResult` |
| `statusTypes.ts` | Enums: `CaseStatus`, `ProgressStatus` |
| `constants.ts` | All PERM constants (filing window days, deadlines, etc.) |
| `cascade.ts` | Cascade rules: auto-compute dependent fields |
| `statusCalculation.ts` | Auto-status determination from dates |
| `calculators/pwd.ts` | PWD expiration calculator |
| `calculators/eta9089.ts` | ETA 9089 window/expiration calculator |
| `calculators/recruitment.ts` | Recruitment deadline calculators |
| `calculators/i140.ts` | I-140 filing deadline calculator |
| `calculators/rfi.ts` | RFI due date calculator (strict 30 days) |
| `calculators/index.ts` | Calculator barrel export |
| `dates/index.ts` | Date utility barrel export |
| `dates/businessDays.ts` | Business day math (add/subtract/count) |
| `dates/holidays.ts` | Federal holiday detection |
| `dates/core.ts` | Core date utilities (parse, format, add) |
| `dates/filingWindow.ts` | Filing window calculation |
| `dates/methodDates.ts` | Recruitment method date utilities |
| `deadlines/index.ts` | Deadline extraction barrel export |
| `deadlines/extraction.ts` | Extract active deadlines from case |
| `deadlines/supersession.ts` | Deadline active/superseded logic |
| `deadlines/timezones.ts` | Timezone display rules |
| `deadlines/types.ts` | Deadline types |
| `recruitment/isRecruitmentComplete.ts` | Recruitment completeness check |
| `recruitment/methodCategories.ts` | Method classification (date-range, sub-entry) |
| `validators/index.ts` | Validator barrel export |
| `validators/pwd.ts` | PWD validation rules |
| `validators/recruitment.ts` | Recruitment validation rules |
| `validators/professionalMethods.ts` | V-PROF validation rules |
| `validators/eta9089.ts` | ETA 9089 validation rules |
| `validators/i140.ts` | I-140 validation rules |
| `validators/rfi.ts` | RFI validation rules |
| `validators/rfe.ts` | RFE validation rules |
| `validators/validateCase.ts` | Full case validation (orchestrator) |
| `utils/fieldMapper.ts` | Field name conversion (snake_case <-> camelCase) |

### `v2/src/app/` -- Next.js Pages

**Layout hierarchy:**
- `layout.tsx` (root): ConvexAuthNextjsServerProvider + SharedProviders
- `(public)/layout.tsx`: Marketing pages, no Convex connection
- `(auth)/layout.tsx`: Login/signup, uses ConvexProviders
- `(authenticated)/layout.tsx`: Full app with all providers

**Page pattern:** Server Component page.tsx exports metadata, renders a `*PageClient` component.

| Page | Purpose |
|------|---------|
| `(public)/page.tsx` | Homepage (landing page) |
| `(public)/demo/page.tsx` | Interactive demo with sample cases |
| `(public)/contact/page.tsx` | Contact form |
| `(public)/terms/page.tsx` | Terms of service |
| `(public)/privacy/page.tsx` | Privacy policy |
| `(public)/blog/page.tsx` | Blog listing |
| `(public)/blog/[slug]/page.tsx` | Blog article |
| `(public)/tutorials/page.tsx` | Tutorial listing |
| `(public)/tutorials/[slug]/page.tsx` | Tutorial article |
| `(public)/guides/page.tsx` | Guide listing |
| `(public)/guides/[slug]/page.tsx` | Guide article |
| `(public)/resources/page.tsx` | Resource listing |
| `(public)/resources/[slug]/page.tsx` | Resource article |
| `(public)/changelog/page.tsx` | Changelog timeline |
| `(auth)/login/page.tsx` | Login page |
| `(auth)/signup/page.tsx` | Signup page |
| `(auth)/reset-password/page.tsx` | Password reset |
| `(authenticated)/dashboard/page.tsx` | Main dashboard |
| `(authenticated)/cases/page.tsx` | Case list (cards/table, filters, sorting, DnD reorder) |
| `(authenticated)/cases/new/page.tsx` | Create new case |
| `(authenticated)/cases/[id]/page.tsx` | Case detail view |
| `(authenticated)/cases/[id]/edit/page.tsx` | Case edit form |
| `(authenticated)/calendar/page.tsx` | Calendar view (react-big-calendar) |
| `(authenticated)/timeline/page.tsx` | Timeline (Gantt-style) view |
| `(authenticated)/notifications/page.tsx` | Notification center |
| `(authenticated)/settings/page.tsx` | User settings (tabbed) |
| `(authenticated)/admin/page.tsx` | Admin dashboard |

**Other app-level files:**

| File | Purpose |
|------|---------|
| `globals.css` | Global styles (Tailwind base + custom) |
| `calendar.css` | react-big-calendar custom styles |
| `providers.tsx` | `ConvexProviders` -- Convex + Auth + PageContext (client-only) |
| `shared-providers.tsx` | `SharedProviders` -- Theme + Toaster + NavLink (all pages) |
| `global-error.tsx` | Root error boundary |
| `not-found.tsx` | 404 page |
| `icon.tsx` | Dynamic favicon generation |
| `opengraph-image.tsx` | Dynamic OG image generation |
| `sitemap.ts` | Dynamic sitemap generation |
| `robots.ts` | Robots.txt generation |
| `manifest.ts` | PWA manifest generation |
| `sw.ts` | Service worker source (Serwist) |
| `~offline/page.tsx` | PWA offline fallback page |

### `v2/src/components/` -- React Components

| Directory | Purpose | Key Components |
|-----------|---------|----------------|
| `admin/` | Admin dashboard UI | User management, system error viewer |
| `auth/` | Auth flow components | `LoginTracker`, `PendingTermsHandler`, auth forms |
| `calendar/` | Calendar view components | Calendar wrapper, event rendering |
| `cases/` | Case management | `CaseCard`, `CaseListView`, `CaseFilterBar`, `ImportModal` |
| `cases/detail/` | Case detail sections | `PWDSection`, `RecruitmentSection`, `ETA9089Section`, `I140Section`, `NextUpSection`, `WindowsDisplay`, `InlineCaseTimeline` |
| `cases/detail/quick-edit/` | Inline editing | `QuickEditFields` (in-place date/field editing) |
| `chat/` | AI chatbot | `ChatWidget`, `ChatPanel`, `ChatInput`, `ChatMessage`, `ToolCallCard`, `InChatConfirmationCard`, `ActionModeToggle` |
| `content/` | Content hub (22 components) | `ArticleLayout`, `ContentListing`, `ContentGrid`, `ScreenshotFigure`, `VideoFigure`, `ChangelogTimeline` |
| `dashboard/` | Dashboard widgets | `DeadlineHeroWidget`, `SummaryTilesGrid`, `UpcomingDeadlinesWidget`, `RecentActivityWidget`, `AutoClosureAlertBanner` |
| `demo/` | Demo page components | Demo case modal, interactive previews |
| `empty-states/` | Empty state illustrations | SVG illustrations for empty lists |
| `error/` | Error handling | Error boundaries, auth error detection |
| `forms/` | Case form system | `CaseForm`, `FormField`, `DateInput`, `CollapsibleSection`, `NotesJournal` |
| `forms/sections/` | Form PERM sections | `BasicInfoSection`, `PWDSection`, `RecruitmentSection`, `ETA9089Section`, `I140Section`, `RFIEntry`, `RFEEntry` |
| `home/` | Homepage (15 components) | `HeroSection`, `FeaturesGrid`, `HowItWorks`, `StatsSection`, `FAQSection`, `CTASection`, `TestimonialsSection`, `VideoShowcase`, `JourneySection` |
| `illustrations/` | SVG illustrations | Static and animated SVGs |
| `job-description/` | Job description templates | Template CRUD UI |
| `layout/` | Layout components | `Header`, `Footer`, `AuthHeader`, `AuthFooter`, `InactivityTimeoutProvider`, `TimeoutWarningModal`, `DeletionBanner`, `SignOutOverlay`, `SentryUserContext` |
| `notifications/` | Notification UI | Notification list, filters, mark-read actions |
| `onboarding/` | Onboarding system | `OnboardingWizard`, `OnboardingTour`, `OnboardingChecklist`, `OnboardingProvider` |
| `providers/` | React providers | `ThemeProvider` (next-themes) |
| `pwa/` | PWA components | Service worker registration |
| `settings/` | Settings sections | Profile, notifications, calendar sync, quiet hours, support, deadline enforcement, account deletion |
| `skeletons/` | Loading states | Skeleton components for each page |
| `status/` | Status badges | PERM status/progress badge components |
| `timeline/` | Timeline view | Timeline visualization components |
| `ui/` | Core UI primitives | shadcn/ui + custom: `Button`, `Card`, `Dialog`, `Input`, `Badge`, `Tooltip`, `Popover`, `Command`, `ScrollArea`, `DropdownMenu`, `AlertDialog`, `Switch`, `Checkbox`, `Label`, `Skeleton`, `Spinner`, `MagneticButton`, `PageTransition`, `LottieAnimation`, `Lightbox`, `NavLink`, `ErrorBoundary` |

### `v2/src/hooks/` -- Custom Hooks

| Hook | Purpose |
|------|---------|
| `useChatWithPersistence.ts` | AI chat with Convex message persistence |
| `useToolOrchestrator.ts` | Multi-step tool execution orchestration |
| `useToolConfirmations.ts` | Tool confirmation UI state management |
| `useClientActions.ts` | Client-side tool action execution |
| `useCaseFormSection.ts` | Form section state + cascade logic |
| `useFormCalculations.ts` | Derived date calculations for forms |
| `useFormSubmission.ts` | Form submission logic |
| `useFormErrors.ts` | Form error management |
| `useDateFieldValidation.ts` | Date field validation |
| `useDerivedDates.ts` | Derived date computation |
| `useSectionState.ts` | Collapsible section state |
| `useUnsavedChanges.ts` | Unsaved changes detection + prompt |
| `useNavigationLoading.ts` | Navigation loading state |
| `useNotificationToasts.ts` | Real-time notification toasts |
| `useJobDescriptionTemplates.ts` | Job description template CRUD hook |
| `usePrevious.ts` | Previous value tracking |
| `use-case-form-submit.ts` | Case form submit handler |
| `use-debounce.ts` | Debounce utility hook |

### `v2/src/lib/` -- Frontend Libraries

| Directory/File | Purpose |
|----------------|---------|
| `ai/` | AI chat system: providers, tools, prompts, summarization, caching, page context |
| `auth/` | Auth utilities |
| `admin/types.ts` | Admin TypeScript types (`UserSummary`) |
| `calendar/` | Calendar view utilities |
| `constants/` | App-wide constants |
| `content/` | MDX content processing (loading, types, SEO, OG images, MDX components) |
| `contexts/` | React contexts (AuthContext) |
| `demo/` | Demo data generation |
| `export/` | Data export (CSV/JSON) |
| `forms/` | Form utilities (validation, defaults) |
| `google/` | Google API helpers |
| `hooks/` | Lib-level hooks: `useTilt`, `useGSAP`, `useInactivityTimeout` |
| `import/` | Case import (CSV parsing) |
| `onboarding/` | Onboarding step definitions |
| `perm/` | **Frontend re-exports** of `convex/lib/perm/` |
| `processing-times/` | PERM processing time estimates |
| `recruitment/` | Recruitment UI helpers |
| `shared/` | Shared utilities |
| `status/` | Status display formatting |
| `testing/` | Test helper utilities |
| `timeline/` | Timeline computation logic |
| `utils/` | General utilities |
| `animations.ts` | Animation constants |
| `errors.ts` | Error type definitions |
| `pushSubscription.ts` | Push notification subscription logic |
| `sentry.ts` | Sentry frontend utilities (`captureError`, `addBreadcrumb`, `setUser`) |
| `structuredData.ts` | JSON-LD structured data generators |
| `toast.ts` | Toast notification utilities |
| `utils.ts` | General utility functions (`cn()` class merge) |

### `v2/src/emails/` -- Email Templates

| File | Purpose |
|------|---------|
| `DeadlineReminder.tsx` | Deadline reminder email |
| `StatusChange.tsx` | Status change notification |
| `RfiAlert.tsx` | RFI alert email |
| `RfeAlert.tsx` | RFE alert email |
| `AutoClosure.tsx` | Auto-closure notification |
| `WeeklyDigest.tsx` | Weekly summary email |
| `WelcomeEmail.tsx` | Welcome email for new users |
| `AccountDeletionConfirm.tsx` | Account deletion confirmation |
| `AdminEmail.tsx` | Admin notification email |
| `VerificationCode.tsx` | OTP verification email |
| `PasswordResetCode.tsx` | Password reset email |
| `TestEmail.tsx` | Test email template |
| `components/` | Shared email components (header, footer) |

### `v2/src/remotion/` -- Video Compositions

| File | Purpose |
|------|---------|
| `Root.tsx` | Remotion root (registers compositions) |
| `index.ts` | Barrel export |
| `compositions/ProductDemo.tsx` | 15-second product demo video |
| `compositions/PERMExplainer.tsx` | 20-second PERM explainer video |
| `compositions/PERMInfographic.tsx` | PERM infographic composition |
| `components/NeoBox.tsx` | Neobrutalist box component |
| `components/AnimatedText.tsx` | Text animation component |
| `components/StageCard.tsx` | PERM stage card component |
| `components/ProgressBar.tsx` | Progress bar component |

### `v2/test-utils/` -- Test Utilities

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `render-utils.tsx` | Custom render with providers |
| `convex.ts` | Convex test environment setup |
| `convex-api-mock.ts` | Convex API mock utilities |
| `deadline-fixtures.ts` | Deadline test data fixtures |
| `dashboard-fixtures.ts` | Dashboard test data fixtures |
| `activity-fixtures.ts` | Activity test data fixtures |
| `ui-fixtures.ts` | UI component test fixtures |
| `timer-utils.ts` | Timer mock utilities |

## Key File Locations

**Entry Points:**
- `v2/src/app/layout.tsx`: Root layout (server component)
- `v2/src/app/(authenticated)/layout.tsx`: Authenticated app shell
- `v2/convex/schema.ts`: Database schema
- `v2/convex/auth.ts`: Auth configuration
- `v2/convex/crons.ts`: Scheduled jobs

**Configuration:**
- `v2/next.config.ts`: Next.js configuration
- `v2/tsconfig.json`: TypeScript configuration
- `v2/vitest.config.ts`: Test configuration
- `v2/eslint.config.mjs`: ESLint configuration
- `v2/convex.json`: Convex project config
- `v2/components.json`: shadcn/ui config

**Core Logic:**
- `v2/convex/lib/perm/index.ts`: PERM business logic entry
- `v2/convex/cases.ts`: Case CRUD operations
- `v2/src/lib/ai/providers.ts`: AI model fallback chain
- `v2/src/app/api/chat/route.ts`: AI chat streaming endpoint

**Testing:**
- `v2/vitest.config.ts`: Test config with 3 projects
- `v2/test-utils/`: Shared fixtures and helpers
- `v2/tests/e2e/`: Playwright E2E tests

## Naming Conventions

**Files:**
- Components: `PascalCase.tsx` (e.g., `CaseCard.tsx`, `DeadlineHeroWidget.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useCaseFormSection.tsx`, `useInactivityTimeout.ts`)
- Some hooks use kebab-case: `use-case-form-submit.ts`, `use-debounce.ts`
- Libraries: `camelCase.ts` (e.g., `errorRecording.ts`, `derivedCalculations.ts`)
- Types: `camelCase.ts` (e.g., `dashboardTypes.ts`, `calendarTypes.ts`)
- Tests: co-located `__tests__/*.test.ts(x)` or `*.test.ts` alongside source
- Convex functions: `camelCase.ts` (e.g., `cases.ts`, `scheduledJobs.ts`)
- Email templates: `PascalCase.tsx` (e.g., `DeadlineReminder.tsx`)
- MDX content: `kebab-case.mdx` (e.g., `tracking-perm-deadlines.mdx`)
- Stories: `ComponentName.stories.tsx`

**Directories:**
- Components: `kebab-case` (e.g., `empty-states/`, `quick-edit/`, `job-description/`)
- Convex modules: `camelCase` (e.g., `perm/`, `rag/`)
- App routes: Next.js conventions (`(group)/`, `[param]/`)
- Test dirs: `__tests__/` (co-located with source)

## Import Patterns and Barrel Exports

**Path aliases** (from `tsconfig.json`):
- `@/` -> `src/`
- `@/../convex/` -> `convex/` (for importing Convex types in frontend)

**Barrel exports used in:**
- `v2/convex/lib/perm/index.ts` -- central PERM logic entry
- `v2/src/lib/perm/index.ts` -- frontend re-exports
- `v2/src/components/content/index.ts` -- content components
- `v2/src/components/home/index.ts` -- home page components
- `v2/src/components/layout/index.ts` -- layout components
- `v2/src/hooks/index.ts` -- hooks barrel
- `v2/src/emails/index.ts` -- email templates
- `v2/test-utils/index.ts` -- test utilities

**Import order convention:**
1. External packages (`react`, `next`, `convex`, `ai`)
2. Internal absolute imports (`@/lib/...`, `@/components/...`)
3. Relative imports (`./`, `../`)
4. Types (separate `import type` statements)

## Module Boundaries

**Frontend NEVER imports directly from `convex/lib/` internals** -- always through:
- `@/lib/perm` (which re-exports from `convex/lib/perm/`)
- Convex API functions via `useQuery()`, `useMutation()`, `useAction()`
- Server-side: `fetchQuery()`, `fetchMutation()`, `fetchAction()` from `convex/nextjs`

**Convex functions have clear scope:**
- `query`: Read-only, real-time subscriptions
- `mutation`: Writes, always in Convex runtime
- `action`: Side effects (API calls), may use `"use node"` for Node.js APIs
- `internal*`: Server-only functions, never exposed to client

**Public pages skip Convex entirely** -- no WebSocket connection for marketing pages.

## Where to Add New Code

**New Feature (full-stack):**
1. Backend logic: `v2/convex/` (new file or extend existing)
2. Backend helpers: `v2/convex/lib/`
3. PERM business rules: `v2/convex/lib/perm/` (calculators, validators)
4. Frontend page: `v2/src/app/(authenticated)/[feature]/page.tsx`
5. Frontend components: `v2/src/components/[feature]/`
6. Frontend hooks: `v2/src/hooks/use[Feature].ts`
7. Tests: co-located `__tests__/` directories

**New Component:**
- UI primitive: `v2/src/components/ui/`
- Feature component: `v2/src/components/[feature]/`
- Page-specific: `v2/src/app/(authenticated)/[page]/components/`

**New Convex Function:**
- CRUD operations: `v2/convex/[resource].ts`
- Internal-only: use `internalQuery`/`internalMutation`/`internalAction`
- Node.js required: add `"use node"` at top of file

**New Email Template:**
- Template: `v2/src/emails/[TemplateName].tsx`
- Sending action: `v2/convex/notificationActions.ts`

**New Content Article:**
- MDX file: `v2/content/[type]/[slug].mdx`
- Images: `v2/public/images/content/` or `v2/public/images/screenshots/`

**Utilities:**
- Frontend shared: `v2/src/lib/utils/`
- Backend shared: `v2/convex/lib/`
- PERM-specific: `v2/convex/lib/perm/`

**Tests:**
- Unit tests: `__tests__/` directory alongside source
- E2E tests: `v2/tests/e2e/`
- Test fixtures: `v2/test-utils/`

## Special Directories

**`v2/convex/_generated/`:**
- Purpose: Auto-generated Convex types and API references
- Generated: Yes (by `npx convex dev`)
- Committed: Yes
- **DO NOT EDIT** -- regenerated on schema/function changes

**`v2/.next/`:**
- Purpose: Next.js build output
- Generated: Yes
- Committed: No (gitignored)

**`v2/coverage/`:**
- Purpose: Test coverage reports
- Generated: Yes (by `pnpm test:coverage`)
- Committed: Yes (for reference)

**`v2/public/`:**
- Purpose: Static assets served directly
- Generated: Partially (sw.js is generated)
- Committed: Yes

**`v2/node_modules/`:**
- Purpose: Dependencies
- Generated: Yes (by `pnpm install`)
- Committed: No (gitignored)

**`v2/scripts/migration/`:**
- Purpose: v1 -> v2 data migration scripts
- Status: Historical -- migration complete
- Contains: `logs/` with migration run logs

**`v2/outreach/`:**
- Purpose: Private launch/outreach documents
- Committed: No (gitignored)

---

*Structure analysis: 2026-02-21*
