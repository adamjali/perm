"use client";

// `convex/react` is a CLIENT-ONLY module; declared here rather than inherited.

/**
 * Settings > API keys > Webhooks: the account's endpoints, what they watch,
 * and the last 30 deliveries, with a resend button on each.
 *
 * An endpoint's signing secret is shown once, in this panel, when it's made;
 * it's stored encrypted and nothing can show it again. A paused endpoint
 * (24 hours of failed deliveries) keeps its events until it's resumed.
 */

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { BinocularsIcon, CopyIcon, WebhooksLogoIcon } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEvent } from "@convex/lib/webhookSign";
import { checkedLabel } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/lib/toast";
import { SettingsCard } from "./SettingsCard";

const STATUS_WORDS: Record<string, string> = {
  pending: "Waiting to send",
  delivered: "Delivered",
  failed: "Failed for 24 hours",
  held: "Held while paused",
};

function errorText(e: unknown, fallback: string): string {
  const data = (e as { data?: unknown })?.data;
  return typeof data === "string" ? data : fallback;
}

export default function WebhooksSection() {
  const mine = useQuery(api.webhooks.mine);
  const createEndpoint = useAction(api.webhooks.createEndpoint);
  const addWatch = useAction(api.webhooks.addWatch);
  const removeWatch = useMutation(api.webhooks.removeWatch);
  const deleteEndpoint = useMutation(api.webhooks.deleteEndpoint);
  const resumeEndpoint = useMutation(api.webhooks.resumeEndpoint);
  const sendTest = useMutation(api.webhooks.sendTest);
  const resend = useMutation(api.webhooks.resend);

  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["case.status_changed"]);
  const [making, setMaking] = useState(false);
  const [secret, setSecret] = useState<{ url: string; secret: string } | null>(null);
  const [watchKind, setWatchKind] = useState<"case" | "employer">("case");
  const [watchTarget, setWatchTarget] = useState("");
  const [watching, setWatching] = useState(false);

  if (mine === undefined) return <Skeleton className="h-64 w-full" />;
  if (mine === null) return null;

  const atEndpointLimit = mine.endpoints.length >= mine.endpointsAllowed;
  const atWatchLimit = mine.watches.length >= mine.watchesAllowed;
  const urlById = new Map(mine.endpoints.map((e) => [e.id, e.url]));

  const run = async (what: () => Promise<unknown>, done: string, failed: string) => {
    try {
      await what();
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e, failed));
    }
  };

  const make = async () => {
    setMaking(true);
    try {
      const r = await createEndpoint({ url, events });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setSecret({ url, secret: r.secret });
      setUrl("");
    } catch {
      toast.error("The endpoint wasn't added. Try again in a moment.");
    } finally {
      setMaking(false);
    }
  };

  const watch = async () => {
    setWatching(true);
    try {
      const r = await addWatch({ kind: watchKind, target: watchTarget });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(r.already ? "That's already watched." : "Watching it.");
      setWatchTarget("");
    } catch {
      toast.error("That wasn't added. Try again in a moment.");
    } finally {
      setWatching(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Secret copied.");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <SettingsCard
        icon={WebhooksLogoIcon}
        title="Webhooks"
        description={`Signed calls to your server when something changes. ${mine.planLabel} plan: ${mine.endpointsAllowed} endpoints.`}
      >
        {secret && (
          <div className="mb-6 border-2 border-border bg-primary/15 p-4" role="status">
            <p className="mb-2 text-sm font-bold">
              The signing secret for {secret.url}. Copy it now: it isn&apos;t shown again.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all border-2 border-border bg-background px-3 py-2 font-mono text-sm">
                {secret.secret}
              </code>{" "}
              <Button variant="outline" className="min-h-[44px]" onClick={() => copy(secret.secret)}>
                <CopyIcon aria-hidden="true" className="size-4" /> Copy
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 min-h-[44px]" onClick={() => setSecret(null)}>
              I&apos;ve saved it
            </Button>
          </div>
        )}

        {mine.endpoints.length > 0 && (
          <ul className="mb-6 divide-y-2 divide-border border-y-2 border-border">
            {mine.endpoints.map((e) => (
              <li key={e.id} className="space-y-2 py-3">
                <p className="break-all font-mono text-sm font-semibold">{e.url}</p>{" "}
                <p className="text-sm text-muted-foreground">
                  {e.events.map((x) => (x in WEBHOOK_EVENT_LABELS ? WEBHOOK_EVENT_LABELS[x as WebhookEvent] : x)).join("; ")}.{" "}
                  Secret ends {e.secretHint}.
                  {e.lastDeliveryAt ? ` Last delivered ${checkedLabel(e.lastDeliveryAt)}.` : ""}
                </p>{" "}
                {e.pausedAt !== null && (
                  <p className="border-2 border-border bg-muted px-3 py-2 text-sm">
                    Paused {checkedLabel(e.pausedAt)}. {e.pauseReason ?? ""} Events since then are kept until you resume it.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {e.pausedAt !== null && (
                    <Button
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => void run(() => resumeEndpoint({ endpointId: e.id }), "Resumed. What waited is on its way.", "That didn't resume.")}
                    >
                      Resume
                    </Button>
                  )}{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => void run(() => sendTest({ endpointId: e.id }), "A test event is on its way.", "That test wasn't sent.")}
                  >
                    Send a test event
                  </Button>{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => void run(() => deleteEndpoint({ endpointId: e.id }), "Endpoint deleted.", "That didn't delete.")}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {atEndpointLimit ? (
          <p className="text-sm text-muted-foreground">
            The {mine.planLabel} plan has {mine.endpointsAllowed} endpoints. Delete one to add another.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              void make();
            }}
          >
            <label className="block text-sm font-semibold">
              Your endpoint&apos;s address (https)
              <Input
                className="mt-1"
                type="url"
                value={url}
                maxLength={2048}
                placeholder="https://example.com/hooks/perm"
                onChange={(ev) => setUrl(ev.target.value)}
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Send it</legend>
              <div className="grid grid-cols-1 gap-2 [&>*]:min-w-0">
                {WEBHOOK_EVENTS.map((x) => (
                  <label key={x} className="flex min-h-[44px] items-center gap-3 text-sm">
                    <Checkbox
                      checked={events.includes(x)}
                      onCheckedChange={(on) => setEvents((cur) => (on === true ? [...new Set([...cur, x])] : cur.filter((y) => y !== x)))}
                    />{" "}
                    <span>
                      {WEBHOOK_EVENT_LABELS[x]} <span className="font-mono text-muted-foreground">({x})</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" className="min-h-[44px]" loading={making} disabled={events.length === 0 || url.trim() === ""}>
              Add the endpoint
            </Button>
          </form>
        )}
      </SettingsCard>

      <SettingsCard
        icon={BinocularsIcon}
        title="What your webhooks watch"
        description={`Case numbers and employers for case.status_changed and employer.moved. ${mine.planLabel} plan: ${mine.watchesAllowed} watches.`}
      >
        {mine.watches.length > 0 && (
          <ul className="mb-6 divide-y-2 divide-border border-y-2 border-border">
            {mine.watches.map((w) => (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold">{w.target}</p>{" "}
                  <p className="text-sm text-muted-foreground">
                    {w.kind === "case" ? (w.lastSeenStatus ? `Now ${w.lastSeenStatus}.` : "Checked at the next sweep.") : "An employer."}
                  </p>
                </div>{" "}
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px]"
                  onClick={() => void run(() => removeWatch({ watchId: w.id }), "No longer watched.", "That didn't remove.")}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {atWatchLimit ? (
          <p className="text-sm text-muted-foreground">
            The {mine.planLabel} plan watches {mine.watchesAllowed}. Remove one to add another.
          </p>
        ) : (
          <form
            className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end [&>*]:min-w-0"
            onSubmit={(ev) => {
              ev.preventDefault();
              void watch();
            }}
          >
            <label className="block text-sm font-semibold">
              Watch
              <select
                className="mt-1 h-11 w-full border-2 border-border bg-background px-3 text-base md:text-sm"
                value={watchKind}
                onChange={(ev) => setWatchKind(ev.target.value === "employer" ? "employer" : "case")}
              >
                <option value="case">A case</option>
                <option value="employer">An employer</option>
              </select>
            </label>{" "}
            <label className="block text-sm font-semibold">
              {watchKind === "case" ? "Case number" : "Employer page (the end of its address)"}
              <Input
                className="mt-1"
                value={watchTarget}
                maxLength={130}
                placeholder={watchKind === "case" ? "G-100-26045-123456" : "google-llc"}
                onChange={(ev) => setWatchTarget(ev.target.value)}
              />
            </label>{" "}
            <Button type="submit" className="min-h-[44px]" loading={watching} disabled={watchTarget.trim() === ""}>
              Watch it
            </Button>
          </form>
        )}
      </SettingsCard>

      {mine.deliveries.length > 0 && (
        <SettingsCard icon={WebhooksLogoIcon} title="Recent deliveries" description="The last 30, newest first. Kept for 30 days.">
          <ul className="divide-y-2 divide-border border-y-2 border-border">
            {mine.deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">
                    <span className="font-mono">{d.type}</span>
                    {" to "}
                    <span className="break-all">{urlById.get(d.endpointId) ?? "a deleted endpoint"}</span>
                  </p>{" "}
                  <p className="text-muted-foreground">
                    {STATUS_WORDS[d.status] ?? d.status}
                    {d.lastStatusCode !== null ? `, answered ${d.lastStatusCode}` : ""}
                    {d.status !== "delivered" && d.lastError ? ` (${d.lastError})` : ""}. {d.attempts}{" "}
                    {d.attempts === 1 ? "attempt" : "attempts"}, queued {checkedLabel(d.createdAt)}
                    {d.status === "pending" && d.attempts > 0 ? `, next try ${checkedLabel(d.nextAttemptAt)}` : ""}.
                  </p>
                </div>{" "}
                {(d.status === "delivered" || d.status === "failed") && urlById.has(d.endpointId) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => void run(() => resend({ deliveryId: d.id }), "Sent again.", "That wasn't resent.")}
                  >
                    Resend
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
    </div>
  );
}
