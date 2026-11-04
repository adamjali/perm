import { redactDeep, redactEmails } from "@convex/lib/redactEmails";

/**
 * No email address leaves the browser for Sentry (Nov 4 2026): the backend already replaces each with a short
 * label (convex/lib/sentry.ts), and the browser had still sent the signed-in person's address and name as the
 * Sentry user, plus any address inside a message. The user keeps its id only, and every address in the
 * event's message, exception values, breadcrumbs, request address and extra data becomes the same label
 * (`email#` and six hex digits), so one person's errors still group together.
 */
interface EventLike {
  message?: string;
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
  request?: { url?: string };
  extra?: Record<string, unknown>;
  user?: Record<string, unknown>;
}

export async function redactBrowserEvent<E extends EventLike>(event: E): Promise<E> {
  if (event.user) event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  if (typeof event.message === "string") event.message = await redactEmails(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = await redactEmails(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (typeof b.message === "string") b.message = await redactEmails(b.message);
    if (b.data) b.data = (await redactDeep(b.data)) as Record<string, unknown>;
  }
  if (event.request?.url) event.request.url = await redactEmails(event.request.url);
  if (event.extra) event.extra = (await redactDeep(event.extra)) as Record<string, unknown>;
  return event;
}
