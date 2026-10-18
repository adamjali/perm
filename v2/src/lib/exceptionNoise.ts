/**
 * Browser exceptions that are not ours, recognised by where they were thrown.
 * Used by PostHog's before_send in src/instrumentation-client.ts.
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
 * True when Chrome for iPhone threw inside a script it put into the page itself
 * (its Translate and form helpers). Chrome files such a script's frames under
 * the page's own address, never a script file, and at lines past the page's end:
 * seen on 4 visits in the month to Oct 16 2026 ("La", "Maximum call stack size
 * exceeded."), at lines 192 to 495 of a page 130 lines long. This site's code
 * runs from script files under /_next/; its few inline scripts don't throw.
 */
export function fromInjectedPageScript(props: Record<string, unknown> | undefined, userAgent = ""): boolean {
  if (!/\bCriOS\//.test(userAgent)) return false;
  const frames = ((props?.$exception_list as ExceptionList | undefined) || []).flatMap((e) => e.stacktrace?.frames || []);
  if (frames.length === 0) return false;
  return frames.every((f) => {
    const file = f.filename || "";
    if (!/^https?:\/\//.test(file)) return false;
    const path = file.replace(/^https?:\/\/[^/]+/, "").replace(/[?#].*$/, "");
    return !path.startsWith("/_next/") && !/\.m?js$/.test(path);
  });
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
