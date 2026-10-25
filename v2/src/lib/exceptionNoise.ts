/**
 * Browser exceptions that are not ours, recognised by where they were thrown.
 * Used by PostHog's before_send in src/instrumentation-client.ts, and Sentry's
 * beforeSend in src/components/layout/SentryClientInit.tsx.
 *
 * Plain module, pure functions.
 */

type ExceptionList = Array<{ stacktrace?: { frames?: Array<{ function?: string; filename?: string }> } }>;

/**
 * True when an exception came from registering the service worker: the
 * browser's own register(), or Serwist's (minified `s.register`) reading a
 * registration the browser never handed back. That second shape was one
 * Chrome 151 client on Linux, nine times in a minute on Oct 7 2026, and it
 * tripped the new-error-type alert; no page breaks when it happens.
 */
export function fromServiceWorkerRegister(props: Record<string, unknown> | undefined, msg = ""): boolean {
  const list = props?.$exception_list as ExceptionList | undefined;
  const readsRegistration = /reading '(waiting|installing|active)'|evaluating '[^']*\.(waiting|installing|active)'/.test(msg);
  return (list || []).some((e) =>
    (e.stacktrace?.frames || []).some((f) => {
      const fn = f.function || "";
      return /ServiceWorkerContainer\.register|_registerScript/.test(fn) || (readsRegistration && /\.register$/.test(fn));
    }),
  );
}

/**
 * True when an exception names a bridge another app puts into its own
 * in-app browser: a crypto wallet's `window.ethereum`, or the native
 * `window.webkit.messageHandlers` an iPhone app's web view talks through.
 * This site uses neither. Seen Oct 9 2026: the wallet error on 3 iPhone visits
 * overnight (it tripped the new-error-type alert at 3:27 AM EDT), the web-view
 * one once. "Java object is gone" is an Android app's web view (Facebook's, on
 * two visits from Facebook links in October 2026) calling a bridge its app took away.
 */
export function fromInjectedBridge(msg = ""): boolean {
  // An app's script can reach the bridge through `top` or `self` as well as
  // `window` (Oct 17 2026: "top.webkit.messageHandlers.foregroundToBackground",
  // 10 events from one visit).
  return /\b(?:window|top|self|parent)\.ethereum\b|\b(?:window|top|self|parent)\.webkit\.messageHandlers\b|\bJava object is gone\b/.test(
    msg,
  );
}

/**
 * True when every file named is one of this site's page documents, never a
 * script: `https://permtracker.app/<page>`, or Sentry's `app:///<page>`. The
 * site's own code runs from script files under /_next/ (and sw.js); its few
 * inline scripts don't throw.
 */
export function onlyPageDocuments(files: string[]): boolean {
  if (files.length === 0) return false;
  return files.every((file) => {
    if (!/^(?:https?:\/\/[^/]+|app:\/\/)\//.test(file)) return false;
    const path = file.replace(/^(?:https?:\/\/[^/]+|app:\/\/)/, "").replace(/[?#].*$/, "");
    return !path.startsWith("/_next/") && !/\.m?js$/.test(path);
  });
}

/**
 * True when Chrome for iPhone threw inside a script it put into the page itself
 * (its Translate and form helpers). Chrome files such a script's frames under
 * the page's own address, never a script file, and the line and column it gives
 * point at the page's markup, not at any script: past the page's end (4 visits
 * in the month to Oct 16 2026, lines 192 to 495 of a 130-line page), or inside
 * it on plain HTML (Sentry 5E, Oct 25 2026: "Maximum call stack size exceeded."
 * on /signup, every frame on an employer page, lines 193 to 229 of 296, all in
 * attribute text).
 */
export function fromInjectedPageScript(props: Record<string, unknown> | undefined, userAgent = ""): boolean {
  if (!/\bCriOS\//.test(userAgent)) return false;
  const frames = ((props?.$exception_list as ExceptionList | undefined) || []).flatMap((e) => e.stacktrace?.frames || []);
  return onlyPageDocuments(frames.map((f) => f.filename || ""));
}

/** The same rule for a Sentry event (`exception.values[].stacktrace.frames`). */
export function sentryEventFromInjectedPageScript(
  event: { exception?: { values?: ExceptionList } } | undefined,
  userAgent = "",
): boolean {
  if (!/\bCriOS\//.test(userAgent)) return false;
  const frames = (event?.exception?.values || []).flatMap((e) => e.stacktrace?.frames || []);
  return onlyPageDocuments(frames.map((f) => f.filename || ""));
}

/** A browser extension's own script: Chrome's, Firefox's and Safari's (packaged as an app on a Mac). */
const EXTENSION_FILE = /^(?:chrome|moz|safari|safari-web)-extension:\/\/|^file:\/\/.*\.(?:safariextension|appex)\//;

/**
 * True when every frame of an exception is in a browser extension's own file,
 * so nothing of this site's code ran: PayPal Honey's Safari extension threw
 * "UnavailableError" from its own script on two pages on Oct 18 2026, and it
 * tripped the new-error-type alert. An error with even one frame of ours still reports.
 */
export function fromBrowserExtension(props: Record<string, unknown> | undefined): boolean {
  const frames = ((props?.$exception_list as ExceptionList | undefined) || []).flatMap((e) => e.stacktrace?.frames || []);
  return frames.length > 0 && frames.every((f) => EXTENSION_FILE.test(f.filename || ""));
}

/**
 * True when an error's own words name an extension's API or one extension's
 * known variables, for the errors Mobile Safari reports with no stack at all,
 * which `fromBrowserExtension` can't place. The extension messaging API
 * (`runtime.sendMessage`, `runtime.connect`, `chrome.runtime`, `browser.runtime`:
 * 8 visits in the month to Oct 18 2026, "Invalid call to runtime.sendMessage().
 * Tab not found.") is one this site never calls, which exceptionNoise.test.ts
 * holds. `self.smartRules` and `self.curSiteRule` are an iPhone extension's own
 * (2 visits from Oct 14; one tripped the new-error-type alert at 1:27 AM EDT
 * Oct 19); neither name is in this site's source or build.
 */
export function fromExtensionMessage(msg = ""): boolean {
  return /\b(?:runtime\.(?:sendMessage|connect)|(?:chrome|browser)\.runtime)\b|\bself\.(?:smartRules|curSiteRule)\b/.test(msg);
}
