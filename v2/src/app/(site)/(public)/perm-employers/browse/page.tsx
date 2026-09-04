/**
 * The A-Z index for employers.
 *
 * `/perm-employers` links 54 sponsors; 16,309 have a page. This is the door to
 * the rest of them: 27 letter pages, every one of which links every employer
 * DOL names three times or more, so nothing in the corpus is more than two
 * crawlable clicks from its own hub.
 *
 * A static `browse` segment beside the existing `[slug]` one. Next resolves
 * static before dynamic, so this page answers `/perm-employers/browse` rather
 * than the slug route treating "browse" as a sponsor name. Giving it a real
 * page instead of letting it 404 was a deliberate call: it is a genuine index
 * of the letter set, it carries the per-letter counts nothing else shows, and
 * a bare 404 on a path the letter pages all sit under is a dead parent.
 */

import type { Metadata } from "next";

import {
  BrowseIndexBody,
  browseIndexMetadata,
} from "@/components/entities/BrowseBody";

export const metadata: Metadata = {
  ...browseIndexMetadata("employer"),
  // Spelled out rather than inherited from the helper, because
  // `scripts/audit_page_registration.py` reads the canonical out of the page
  // FILE. A registration gate that cannot see a route's canonical reports the
  // route as unregistered, and the value is identical either way.
  alternates: { canonical: "/perm-employers/browse" },
};

// Quarterly data, same window as the hub it belongs to.
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

export default async function PermEmployersBrowsePage() {
  return <BrowseIndexBody kind="employer" />;
}
