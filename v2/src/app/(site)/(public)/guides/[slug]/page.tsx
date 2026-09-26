/**
 * Guide Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("guides");

export { generateStaticParams, generateMetadata };

// The slug set is complete at build time (MDX ships with the repo), so a slug
// outside it is answered with a real 404 status and no render. Without this a
// junk slug streams a 200 whose body says "not found" - a soft 404.
export const dynamicParams = false;

// Daily, because a guide can carry live figures (<OnHoldNow />): a count read
// at build time would be as old as the last deploy. Every guide shares the
// window; ~40 pages regenerated once a day is a few write units.
export const revalidate = 86400;
export default Page;
