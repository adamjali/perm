import { entityBySlugRoute } from "@/lib/api/entityRoutes";

export const dynamic = "force-dynamic";

/** One by the name in its page's address, as search returns it. */
export const GET = entityBySlugRoute("occupation");
