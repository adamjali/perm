import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

// Create bundle analyzer wrapper
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

// Create next-intl plugin pointing to our i18n config
const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

// Create Serwist plugin with strict caching rules
// CRITICAL: Only cache static assets (images, fonts)
// NEVER cache HTML/JS/CSS to prevent stale deployment bugs
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Disable in development to avoid caching issues during dev
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Fix workspace root detection with parent lockfiles
  turbopack: {
    root: process.cwd(),
  },
};

// Apply next-intl plugin first, then Serwist
const configWithIntl = withNextIntl(nextConfig);
const configWithSerwist = withSerwist(configWithIntl);

// Sentry configuration options
const sentryOptions = {
  // Suppress source map upload logs during build
  silent: true,

  // Organization and project settings (from env vars)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps for better stack traces
  // Only upload in production builds with auth token
  ...(process.env.SENTRY_AUTH_TOKEN && {
    widenClientFileUpload: true,
    sourcemaps: {
      disable: false,
    },
  }),

  // Automatically tree-shake Sentry logger in production
  disableLogger: true,

  // Hide source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically instrument API routes and server components
  automaticVercelMonitors: true,
};

// Only wrap with Sentry if DSN is configured
const hasSentryDsn =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Apply bundle analyzer as the outermost wrapper
const finalConfig = hasSentryDsn
  ? withSentryConfig(configWithSerwist, sentryOptions)
  : configWithSerwist;

export default withBundleAnalyzer(finalConfig);
