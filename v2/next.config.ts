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
  poweredByHeader: false,
  // React Compiler disabled — causes ReferenceError with both Turbopack and Webpack:
  // Turbopack: _ref, _caseData_isProfessionalOccupation (variable scoping)
  // Webpack: int (motion-dom export mangling via Babel)
  // Re-enable when SWC plugin ships: https://github.com/vercel/next.js/issues/78163
  // reactCompiler: true,

  // Serve AVIF (30% smaller than WebP) with WebP fallback
  images: {
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    // Inline critical CSS to eliminate render-blocking stylesheets
    inlineCss: true,
    // Tree-shake barrel exports for these packages
    // motion/react removed — its dep motion-dom has ESM export bugs with Webpack
    // zod removed — optimizePackageImports breaks ZodNumber.int() (ReferenceError: int is not defined)
    optimizePackageImports: ["lucide-react", "date-fns"],
  },

  // Disable Webpack ModuleConcatenationPlugin on client bundles
  // Scope hoisting breaks motion-dom's "int" export (ReferenceError: int is not defined)
  webpack: (config, { isServer }) => {
    if (!isServer && config.optimization) {
      config.optimization.concatenateModules = false;
    }
    return config;
  },

  async redirects() {
    return [
      // Fix GSC 404s: old .html URLs → clean routes
      { source: "/demo.html", destination: "/demo", permanent: true },
      { source: "/register.html", destination: "/signup", permanent: true },
      { source: "/terms.html", destination: "/terms", permanent: true },
      { source: "/privacy.html", destination: "/privacy", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
    ];
  },

  // Security headers (SOC 2 CC6/CC9)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://browser.sentry-cdn.com https://*.senja.io",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud https://va.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live wss://vercel.live https://*.sentry.io https://browser.sentry-cdn.com https://*.senja.io https://senja.io https://fonts.googleapis.com https://fonts.gstatic.com",
              "media-src 'self' blob: data:",
              "frame-src 'self' https://app.supademo.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
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

  // Strip unused Sentry modules (~137KB savings)
  bundleSizeOptimizations: {
    excludeTracing: true,
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
};

// Only wrap with Sentry if DSN is configured
const hasSentryDsn =
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

// Apply bundle analyzer as the outermost wrapper
const finalConfig = hasSentryDsn
  ? withSentryConfig(configWithSerwist, sentryOptions)
  : configWithSerwist;

export default withBundleAnalyzer(finalConfig);
