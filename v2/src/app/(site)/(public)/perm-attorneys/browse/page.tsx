/**
 * The A-Z index for law firms.
 *
 * `/perm-attorneys` links a ranked head of the field; 3,514 firms have a page.
 * This is the door to the rest of them: 27 letter pages, every one of which
 * links every firm DOL names three times or more, so nothing in the corpus is
 * more than two crawlable clicks from its own hub.
 *
 * A static `browse` segment beside the existing `[slug]` one. Next resolves
 * static before dynamic, so this page answers `/perm-attorneys/browse` rather
 * than the slug route treating "browse" as a firm name. Giving it a real page
 * instead of letting it 404 was a deliberate call: it is a genuine index of
 * the letter set, it carries the per-letter counts nothing else shows, and a
 * bare 404 on a path the letter pages all sit under is a dead parent.
 */

import type { Metadata } from "next";

import {
  BrowseIndexBody,
  browseIndexMetadata,
} from "@/components/entities/BrowseBody";

export const metadata: Metadata = {
  ...browseIndexMetadata("attorney"),
  // Spelled out rather than inherited from the helper, because
  // `scripts/audit_page_registration.py` reads the canonical out of the page
  // FILE. A registration gate that cannot see a route's canonical reports the
  // route as unregistered, and the value is identical either way.
  alternates: { canonical: "/perm-attorneys/browse" },
};

// Quarterly data, same window as the hub it belongs to.
export const revalidate = 86400;

export default async function PermAttorneysBrowsePage() {
  return <BrowseIndexBody kind="attorney" />;
}
