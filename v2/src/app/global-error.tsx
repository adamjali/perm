"use client";

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the root layout and all pages.
 * This is the last line of defense, it even catches errors
 * that the per-route error.tsx boundaries miss.
 *
 * It replaces the whole document, so the site's stylesheet may not be on the
 * page: everything it needs is drawn here, in the same palette as the server's
 * busy page (scripts/oracle/nginx/errors/503.html). It had been plain system
 * text on grey, which read as a different site (owner, Oct 31 2026). It names
 * what failed in one small line, so a screenshot of it says what to fix.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */

import { useEffect } from "react";
import { isAuthError, isStaleDeploymentError } from "@/components/error/auth-error";
import { claimAutoReload, isReloadCurable, reportCaughtError } from "@/components/error/recovery";
import { failedLine } from "@/components/error/failedLine";

const CSS = `
:root{--bg:#fafafa;--fg:#141414;--card:#fff;--soft:#5e5e5e;--lime:#2ecc40;--edge:#141414}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f0f;--fg:#f2f2f2;--card:#1b1b1b;--soft:#bdbdbd;--edge:#8a8a8a}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.pt-head{background:#141414;color:#fff;border-bottom:2px solid #000;padding:14px 20px;font-weight:700;font-size:1.05rem}
.pt-head a{color:inherit;text-decoration:none}
.pt-head b{color:var(--lime)}
.pt-wrap{flex:1;display:grid;place-items:center;padding:24px 16px}
.pt-card{max-width:34rem;width:100%;background:var(--card);border:2px solid var(--edge);box-shadow:6px 6px 0 var(--edge);padding:28px 24px}
.pt-card h1{margin:0 0 8px;font-size:1.6rem;line-height:1.2}
.pt-card p{margin:0 0 18px;color:var(--soft)}
.pt-row{display:flex;flex-wrap:wrap;gap:12px}
.pt-go{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;background:var(--lime);color:#000;font:inherit;font-weight:700;text-decoration:none;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer}
.pt-alt{background:var(--card);color:var(--fg);border-color:var(--edge);box-shadow:3px 3px 0 var(--edge)}
.pt-go:active{box-shadow:none;transform:translate(2px,2px)}
.pt-go:focus-visible{outline:3px solid var(--lime);outline-offset:2px}
.pt-card .pt-ref{margin:22px 0 0;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--soft);overflow-wrap:anywhere}
@media (prefers-reduced-motion:reduce){.pt-go:active{transform:none}}
`;

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>{`${title} | PERM Tracker`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <header className="pt-head">
          {/* Plain links on this page: the app crashed, so a full load is the point. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load, nothing in memory should survive */}
          <a href="/">
            <b>PERM</b> Tracker
          </a>
        </header>
        <div className="pt-wrap">
          <main className="pt-card">{children}</main>
        </div>
      </body>
    </html>
  );
}

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isExpiredSession = isAuthError(error.message);
  const isStaleDeployment = isStaleDeploymentError(error);

  useEffect(() => {
    // Stale deployment: silently reload to pick up new Server Action hashes,
    // once a minute at most so it can't loop.
    if (isStaleDeployment) {
      if (claimAutoReload()) window.location.reload();
      return;
    }

    if (isExpiredSession) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load: the app has crashed, so nothing held in memory should survive
      window.location.href = "/login?expired=1";
      return;
    }

    const reload = isReloadCurable(error) && claimAutoReload();
    reportCaughtError("GlobalError", error, { autoReloaded: reload });
    if (reload) window.location.reload();
  }, [error, isExpiredSession, isStaleDeployment]);

  if (isStaleDeployment) {
    return (
      <Page title="Updating">
        <h1>Updating to the latest version</h1>{" "}
        <p>The site changed since this page opened. It reloads by itself in a moment.</p>{" "}
        <div className="pt-row">
          <button type="button" className="pt-go" onClick={() => window.location.reload()}>
            Reload now
          </button>
        </div>
      </Page>
    );
  }

  if (isExpiredSession) {
    return (
      <Page title="Signed out">
        <h1>Your session ended</h1>{" "}
        <p>Taking you to the sign-in page.</p>{" "}
        <div className="pt-row">
          <a className="pt-go" href="/login?expired=1">
            Sign in
          </a>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Something went wrong">
      <h1>Something went wrong</h1>{" "}
      <p>This page hit an error and couldn&rsquo;t finish loading. It&rsquo;s been recorded.</p>{" "}
      {/* A full reload, not React's reset(): this screen replaced the whole
          document, and reset re-renders the state it broke on. */}
      <div className="pt-row">
        <button type="button" className="pt-go" onClick={() => window.location.reload()}>
          Try again
        </button>{" "}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load, nothing in memory should survive */}
        <a className="pt-go pt-alt" href="/">
          Go to the homepage
        </a>
      </div>{" "}
      <p className="pt-ref">What failed: {failedLine(error)}</p>
    </Page>
  );
}
