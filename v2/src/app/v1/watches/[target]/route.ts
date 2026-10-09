import { removeWatch } from "@/lib/api/webhooksApi";

export const dynamic = "force-dynamic";

/** Stop watching a case number, or an employer with ?kind=employer. */
export async function DELETE(request: Request, context: { params: Promise<{ target: string }> }): Promise<Response> {
  return removeWatch(request, (await context.params).target);
}
