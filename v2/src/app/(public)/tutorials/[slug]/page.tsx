/**
 * Tutorial Detail Page
 */

import { createContentDetailPage } from "@/lib/content/createContentDetailPage";

const { generateStaticParams, generateMetadata, Page } =
  createContentDetailPage("tutorials");

export { generateStaticParams, generateMetadata };
export default Page;
