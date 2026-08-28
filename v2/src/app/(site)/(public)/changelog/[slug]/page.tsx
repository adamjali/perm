/**
 * Changelog entry detail page.
 *
 * These entries existed as content for months with no route to reach them,
 * so every link and every crawler hit a 404 on real, published writing. The
 * factory already handled the type; only the route was missing.
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("changelog");

export { generateStaticParams, generateMetadata };

// The slug set is complete at build time (MDX ships with the repo), so a slug
// outside it is answered with a real 404 status and no render. Without this a
// junk slug streams a 200 whose body says "not found" - a soft 404.
export const dynamicParams = false;
export default Page;
