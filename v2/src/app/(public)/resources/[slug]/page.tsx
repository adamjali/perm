/**
 * Resource Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("resources");

export { generateStaticParams, generateMetadata };
export default Page;
