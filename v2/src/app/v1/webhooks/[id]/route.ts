import { deleteWebhook } from "@/lib/api/webhooksApi";

export const dynamic = "force-dynamic";

/** Delete one of the account's endpoints, and its delivery log. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return deleteWebhook(request, (await context.params).id);
}
