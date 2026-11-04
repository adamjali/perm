/**
 * The browser errors Sentry is told to drop (SentryClientInit). Sentry tests each entry against an event's
 * message, its exception's message, and "Type: message", and drops the event on any match; a string entry
 * matches ANYWHERE inside one (`includes`, @sentry/core utils/string.js). Bare words such as "Failed to
 * fetch" or "Rejected" therefore also dropped any error of ours that merely contained them, so every entry
 * here is a pattern anchored to the exact words a browser or library prints (Nov 4 2026 audit).
 * sentryIgnore.test.ts holds each one to messages it must drop and messages it must keep.
 */
export const CLIENT_IGNORE_ERRORS: RegExp[] = [
  /^ResizeObserver loop limit exceeded$/,
  /^ResizeObserver loop completed with undelivered notifications\.?$/,
  // A request the visitor's connection didn't finish, in each browser's own words: Chrome (with the host
  // since Chrome 136), Firefox, Safari, React Native's polyfill, and Chrome's response cut off mid-read
  // (Sentry 56, on /login: nginx logged every request that minute as 200, Oct 28 2026). PostHog still
  // counts them, and the error screen reloads.
  /^Failed to fetch( \(.+\))?$/,
  /^NetworkError when attempting to fetch resource\.?$/,
  /^NetworkError: /,
  /^Load failed( \(.+\))?$/,
  /^Network request failed$/,
  /(^|: )network error$/i,
  /^AbortError: /,
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  // convex/lib/auth.ts's own refusal for a session that ended while the page was open. Production masks a
  // plain Error as "Server Error", so this matches only the development build's wording.
  /^(Uncaught )?(Error: )?not authenticated$/m,
  // A profile read in the moment between sign-up and its profile row (onboarding retries it).
  /(^|: )User profile not found$/m,
  // A page from an older deployment asking for a Server Action the live build doesn't have.
  /^Failed to find Server Action/,
  /^UnrecognizedActionError/,
  // A browser extension reading the page's structured data (not app code).
  /@context.*toLowerCase/,
  // A browser extension changing the page under React: its reconciler then fails.
  /insertBefore.*not a child/,
  /removeChild.*not a child/,
  // A build file that didn't download (the error screen reloads, /api/client-error records it).
  /^ChunkLoadError: /,
  /^Loading (CSS )?chunk \S+ failed/,
  // The browser refusing the service worker's registration mid-navigation (Serwist registers and forgets).
  /^Rejected$/,
  /Failed to register a ServiceWorker/,
  /Operation has been aborted/,
  // PostHog's session recorder's own bugs (not our code).
  /bufferBelongsToIframe/,
  /Called on script loaded before session recording is available/,
  // React hydration mismatches from extensions writing into the page before React starts.
  /Minified React error #418/,
  /Minified React error #423/,
  /Minified React error #425/,
  // A wallet extension's injected provider (Sentry 3N).
  /MetaMask/,
  // Safari refusing to fetch the service worker script (Sentry 49); registration is retried.
  /sw\.js load failed/,
];
