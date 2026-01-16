# Technology Stack

**Analysis Date:** 2026-01-16

## Languages

**Primary:**
- TypeScript 5.x - All source code (frontend and backend)

**Secondary:**
- HTML/CSS - Email templates and static markup

## Runtime

**Environment:**
- Node.js 20+ (inferred from ES2017 target, ESM support)
- Convex Edge Runtime - Backend function execution

**Package Manager:**
- pnpm 10.27.0 (pinned via packageManager field)
- Lockfile: `v2/pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- Next.js 16.1.0 - React framework with App Router
- React 19.2.3 - UI library
- Convex 1.31.4 - Backend-as-a-service (database, functions, auth)

**Testing:**
- Vitest 4.0.16 - Unit and component testing
- Playwright 1.57.0 - End-to-end testing
- Testing Library (React) 16.3.1 - Component testing utilities
- convex-test 0.0.41 - Convex function testing
- vitest-axe 0.1.0 - Accessibility testing

**Build/Dev:**
- Turbopack - Next.js bundler (development)
- Webpack - Next.js bundler (production builds)
- Vite 7.3.0 - Test runner bundler
- Storybook 10.1.10 - Component development and documentation

## Key Dependencies

**Critical:**
- `@convex-dev/auth` 0.0.90 - Authentication via Convex
- `@convex-dev/rag` 0.6.1 - RAG knowledge base for chatbot
- `ai` 5.x - Vercel AI SDK for chat/streaming
- `resend` 6.6.0 - Email delivery
- `web-push` 3.6.7 - Web push notifications

**UI:**
- Tailwind CSS 4.x - Utility-first styling
- Radix UI - Headless accessible components
- Framer Motion / Motion 12.23.26 - Animations
- Lucide React 0.562.0 - Icon library
- class-variance-authority 0.7.1 - Component variants
- sonner 2.0.7 - Toast notifications
- react-big-calendar 1.19.4 - Calendar component

**Data/Forms:**
- Zod 4.2.1 - Schema validation
- React Hook Form 7.69.0 - Form state management
- date-fns 4.1.0 - Date utilities

**AI Providers:**
- `@ai-sdk/google` 2.0.52 - Google Gemini
- `@ai-sdk/openai` 2.0.89 - OpenAI-compatible APIs
- `@openrouter/ai-sdk-provider` 1.5.4 - OpenRouter multi-provider
- `ai-fallback` 1.0.8 - Multi-provider fallback handling

**Infrastructure:**
- `@sentry/nextjs` 10.32.1 - Error tracking
- `@serwist/next` 9.5.0 - PWA service worker
- `@vercel/speed-insights` 1.3.1 - Performance monitoring
- `google-auth-library` 10.5.0 - Google OAuth/Calendar
- `next-intl` 4.6.1 - Internationalization (prepared)
- `next-themes` 0.4.6 - Dark mode support

## Configuration

**Environment:**
- `.env.local` - Local development secrets
- `.env.example` - Template for required variables
- Convex Dashboard - Production environment variables

**Key configs required:**
```bash
# Convex (auto-set by npx convex dev)
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Authentication
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# AI Providers (chat functionality)
GOOGLE_GENERATIVE_AI_API_KEY=
OPENROUTER_API_KEY=
GROQ_API_KEY=
CEREBRAS_API_KEY=
MISTRAL_API_KEY=

# Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
CALENDAR_TOKEN_ENCRYPTION_KEY=

# Web Search
TAVILY_API_KEY=
BRAVE_API_KEY=

# Email
RESEND_API_KEY=

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Error Tracking
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

**Build:**
- `v2/next.config.ts` - Next.js configuration (Sentry, Serwist, next-intl)
- `v2/tsconfig.json` - TypeScript strict mode configuration
- `v2/vitest.config.ts` - Three-project test configuration
- `v2/playwright.config.ts` - E2E test configuration
- `v2/postcss.config.mjs` - Tailwind PostCSS integration
- `v2/eslint.config.mjs` - ESLint 9 flat config

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm 10.x
- Two terminals required: `npx convex dev` + `pnpm dev`
- Convex CLI installed

**Production:**
- Vercel - Frontend hosting (auto-deploy from main)
- Convex Cloud - Backend hosting (auto-sync from main)
- Resend - Email infrastructure
- Sentry - Error monitoring
- Google Cloud Console - OAuth credentials

## Test Infrastructure

**Test Projects (Vitest):**
| Project | Environment | Includes |
|---------|-------------|----------|
| `unit` | happy-dom | `src/lib/**`, `src/hooks/**`, `convex/lib/perm/**` |
| `components` | happy-dom | `src/components/**`, `src/app/**`, `src/emails/**` |
| `convex` | edge-runtime | `convex/*.test.ts`, `convex/__tests__/**` |

**Coverage Thresholds:**
- Branches: 70%
- Functions: 75%
- Lines: 75%
- Statements: 75%

**Test Commands:**
```bash
pnpm test         # Watch mode (development)
pnpm test:fast    # Unit tests only (~30s)
pnpm test:run     # Full suite (~9 min, 3600+ tests)
pnpm test:e2e     # Playwright E2E
```

---

*Stack analysis: 2026-01-16*
