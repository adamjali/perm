/**
 * Guide Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("guides");

export { generateStaticParams, generateMetadata };
export default Page;
