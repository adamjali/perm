/**
 * Sentry Client-Side Configuration
 *
 * INTENTIONALLY EMPTY — Sentry is initialized manually in SentryClientInit.tsx
 * to prevent the 287KB SDK from loading on public pages.
 *
 * The @sentry/nextjs webpack plugin auto-injects this file as an entry point.
 * By keeping it empty, public pages have zero Sentry client-side overhead.
 *
 * Sentry initialization happens in:
 * - src/components/layout/SentryClientInit.tsx (client-side, authenticated pages)
 * - sentry.server.config.ts (server-side, all pages)
 * - sentry.edge.config.ts (edge runtime)
 */
