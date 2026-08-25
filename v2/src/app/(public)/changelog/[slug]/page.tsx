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
export default Page;
