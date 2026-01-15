# Technology Stack

**Analysis Date:** 2026-01-03

## Languages

**Primary:**
- TypeScript 5 (strict mode) - All application code

**Secondary:**
- JavaScript - Configuration files (eslint.config.mjs, postcss.config.mjs)

## Runtime

**Environment:**
- Node.js (Next.js server runtime)
- Convex Edge Runtime (serverless functions)
- Browser (React 19)

**Package Manager:**
- pnpm (workspace support via pnpm-workspace.yaml)
- Lockfile: pnpm-lock.yaml present

## Frameworks

**Core:**
- Next.js 16.1.0 - Full-stack React framework with App Router
- React 19.2.3 - UI library
- Convex 1.31.2 - Backend-as-a-service (real-time database + functions)

**Testing:**
- Vitest 4.0.16 - Unit/component tests
- @testing-library/react - Component testing utilities
- Playwright 1.57.0 - E2E browser testing
- convex-test - Convex function testing

**Build/Dev:**
- Vite 7.3.0 - Dev server (via Vitest/Storybook)
- TypeScript 5 - Compilation and type checking
- PostCSS 4 - CSS processing pipeline
- Turbopack - Next.js dev server (optional)

## Key Dependencies

**Critical:**
- @convex-dev/auth 0.0.90 - Authentication system
- react-hook-form 7.69.0 - Form state management
- zod 4.2.1 - Schema validation
- date-fns 4.1.0 - Date manipulation
- resend 6.6.0 - Email delivery service

**Infrastructure:**
- @sentry/nextjs 10.32.1 - Error tracking and monitoring
- web-push 3.6.7 - Browser push notifications
- google-auth-library 10.5.0 - Google OAuth client
- @oslojs/crypto 1.0.1 - Token encryption (AES-256-GCM)

**UI:**
- Tailwind CSS 4 - Utility-first CSS (CSS-first config)
- shadcn/ui (Radix primitives) - Component library
- Framer Motion 12.23.26 - Animations
- lucide-react - Icons
- sonner - Toast notifications
- next-themes - Dark/light mode

**Drag & Drop:**
- @dnd-kit/core 6.3.1 - Drag and drop framework
- @dnd-kit/sortable - Sortable lists

**Internationalization:**
- next-intl 4.6.1 - Multilingual support

**Component Development:**
- Storybook 10.1.10 - Component development environment

## Configuration

**Environment:**
- .env.local for local development
- Convex dashboard for production secrets
- Key configs: CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL, JWT_PRIVATE_KEY, AUTH_GOOGLE_*, RESEND_API_KEY, VAPID_*

**Build:**
- tsconfig.json - TypeScript strict mode, path aliases (@/*)
- next.config.ts - Next.js config with Sentry integration
- vitest.config.ts - Test configuration with jsdom + edge-runtime
- eslint.config.mjs - ESLint flat config format
- postcss.config.mjs - PostCSS pipeline for Tailwind

**Path Aliases:**
- @/* → ./src/*
- @/convex → ./convex/ (Vitest)
- @/test-utils → ./test-utils/ (Vitest)

## Platform Requirements

**Development:**
- macOS/Linux/Windows (Node.js required)
- pnpm for package management
- Convex CLI for backend development

**Production:**
- Frontend: Vercel (Next.js hosting)
- Backend: Convex Cloud (serverless)
- Database: PostgreSQL via Convex

---

*Stack analysis: 2026-01-03*
*Update after major dependency changes*
