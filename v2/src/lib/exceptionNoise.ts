/**
 * Browser exceptions that are not ours, recognised by where they were thrown.
 * Used by PostHog's before_send in src/instrumentation-client.ts.
 *
 * Plain module, pure functions.
 */

type ExceptionList = Array<{ stacktrace?: { frames?: Array<{ function?: string }> } }>;

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
