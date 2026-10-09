import { addWatch, listWebhooks } from "@/lib/api/webhooksApi";

export const dynamic = "force-dynamic";

/** The account's watches, with its endpoints. */
export const GET = listWebhooks;

/** Watch a case ({caseNumber}) or an employer ({employer}, its page's slug). */
export const POST = addWatch;
