/**
 * The extension's manifest, built from the site table so the pages the
 * content script runs on can't drift from the selectors that read them.
 *
 * Permissions are the fewest that work, because store review weighs each:
 * `storage` (a session cache of answers), `activeTab` and `scripting` (read a
 * posting on any other site, only when the toolbar button is clicked). The one
 * host permission is permtracker.app, for the lookup. The job sites appear
 * only as content-script matches.
 */
import { SITES } from "./extract";

export const EXTENSION_VERSION = "1.0.0";
export const EXTENSION_NAME = "PERM Tracker: Visa Sponsor Check";
/** The store's short description: at most 132 characters. */
export const EXTENSION_SUMMARY =
  "See an employer's green card (PERM) and H-1B sponsorship record from U.S. Department of Labor files, right on the job posting.";

export const ICON_SIZES = [16, 32, 48, 128] as const;

export function buildManifest(): Record<string, unknown> {
  const icons = Object.fromEntries(ICON_SIZES.map((n) => [String(n), `icons/icon-${n}.png`]));
  return {
    manifest_version: 3,
    name: EXTENSION_NAME,
    short_name: "PERM Tracker",
    version: EXTENSION_VERSION,
    description: EXTENSION_SUMMARY,
    homepage_url: "https://permtracker.app/extension",
    minimum_chrome_version: "116",
    icons,
    action: { default_title: "Check this employer's visa sponsorship record", default_icon: icons },
    background: { service_worker: "background.js" },
    content_scripts: [
      {
        matches: SITES.flatMap((s) => s.matches),
        js: ["content.js"],
        run_at: "document_idle",
      },
    ],
    permissions: ["storage", "activeTab", "scripting"],
    host_permissions: ["https://permtracker.app/*"],
  };
}
