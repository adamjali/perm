/**
 * Blog Post Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("blog");

export { generateStaticParams, generateMetadata };

// The slug set is complete at build time (MDX ships with the repo), so a slug
// outside it is answered with a real 404 status and no render. Without this a
// junk slug streams a 200 whose body says "not found" - a soft 404.
export const dynamicParams = false;
export default Page;
