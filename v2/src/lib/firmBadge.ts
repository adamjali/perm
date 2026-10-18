import type { BadgeSpec, BadgeTheme } from "@/lib/badge";
import { entityHref } from "@/lib/entityPayload";

/**
 * A law firm's badge for its own site: a link to its page here, with the
 * word "Verified" only when the firm proved it is the firm (a verified claim,
 * convex/firmClaims.ts). Any other firm with a page gets "PERM record", which
 * is true of every firm we hold; a name we don't hold gets nothing.
 *
 * /badge/firm/<slug>.svg (dark) and /badge/firm/<slug>.light.svg.
 */

const FILE_RE = /^([a-z0-9][a-z0-9-]{0,119})(?:\.(dark|light))?\.svg$/;

export function parseFirmBadgeFile(file: string): { slug: string; theme: BadgeTheme } | null {
  const m = FILE_RE.exec(file);
  if (!m || !m[1]) return null;
  return { slug: m[1], theme: m[2] === "light" ? "light" : "dark" };
}

export function firmPagePath(slug: string): string {
  return entityHref("attorney", slug);
}

export function firmBadgeSpec(name: string, slug: string, verified: boolean): BadgeSpec {
  return {
    kind: `firm-${slug}`,
    label: "PERM Tracker",
    value: verified ? "Verified firm" : "PERM record",
    href: firmPagePath(slug),
    alt: verified ? `${name}: verified on PERM Tracker` : `${name}: PERM record on PERM Tracker`,
    asOf: null,
    source: "PERM Tracker",
  };
}

/** The HTML a firm pastes into its site: the badge, linking to its page here. */
export function firmBadgeSnippet(siteUrl: string, slug: string, name: string, theme: BadgeTheme = "dark"): string {
  const base = siteUrl.replace(/\/$/, "");
  const file = theme === "light" ? `${slug}.light.svg` : `${slug}.svg`;
  const alt = `${name} on PERM Tracker`.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<a href="${base}${firmPagePath(slug)}"><img src="${base}/badge/firm/${file}" alt="${alt}" height="20"></a>`;
}
