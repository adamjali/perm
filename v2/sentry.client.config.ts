/**
 * Sentry Client-Side Configuration
 *
 * INTENTIONALLY EMPTY — Sentry is initialized lazily via SentryClientInit component
 * in auth/authenticated layouts only. This prevents the Sentry SDK (~287KB) from
 * being bundled into public pages (home, blog, demo, etc.).
 *
 * @see src/components/layout/SentryClientInit.tsx
 */
