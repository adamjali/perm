/**
 * Blog Post Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("blog");

export { generateStaticParams, generateMetadata };
export default Page;
