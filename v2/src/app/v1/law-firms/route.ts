import { entitySearchRoute } from "@/lib/api/entityRoutes";

export const dynamic = "force-dynamic";

/** Search by name: ?q=...&limit=25 (at most 100). */
export const GET = entitySearchRoute("attorney");
