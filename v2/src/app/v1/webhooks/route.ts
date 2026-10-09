import { createWebhook, listWebhooks } from "@/lib/api/webhooksApi";

export const dynamic = "force-dynamic";

/** The account's webhook endpoints and watches. */
export const GET = listWebhooks;

/** A new endpoint: {url, events}. Its secret is in the answer, once. */
export const POST = createWebhook;
