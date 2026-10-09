"use client";

// `convex/react` is a CLIENT-ONLY module; declared here rather than inherited.

/**
 * Settings > API keys: make, copy, rotate and revoke keys for the PERM Tracker
 * API and AI assistants, and see this month's calls against the plan.
 *
 * A new key is shown once, in this panel, until it's dismissed. Only its hash
 * is stored, so nothing can show it again; losing it means rotating it (the
 * old key keeps working for 24 hours) or revoking it and making another.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CopyIcon, KeyIcon, PlugsConnectedIcon } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import { displayKeyId } from "@convex/lib/apiKeyFormat";
import { DEFAULT_SCOPES, GRANTABLE_SCOPES, SCOPE_LABELS, type ApiScope } from "@convex/lib/apiPlans";
import { MCP_URL } from "@/lib/api/openapi";
import { checkedLabel } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { SettingsCard } from "./SettingsCard";

interface Usage {
  today: number;
  month: number;
  byKey: { keyId: string; today: number; month: number; lastDay: string | null; lastAt: number | null }[];
}

const LIFETIMES: { label: string; days: number | null }[] = [
  { label: "Until I revoke it", days: null },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold">{label}</span>{" "}
        <span className="font-mono tabular-nums">
          {used.toLocaleString("en-US")} of {limit.toLocaleString("en-US")}
        </span>
      </div>
      <div
        className="h-3 border-2 border-border bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
      >
        <div className={share >= 1 ? "h-full bg-destructive" : "h-full bg-primary"} style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
}

type KeyRow = NonNullable<FunctionReturnType<typeof api.apiKeys.mine>>["keys"][number];

/** What a key is doing right now, by this browser's clock. */
function keyState(k: KeyRow, now: number): "working" | "rotating" | "stopped" | "expired" {
  if (k.expiresAt !== null && k.expiresAt <= now) return "expired";
  if (k.graceUntil !== null) return k.graceUntil > now ? "rotating" : "stopped";
  return "working";
}

export default function ApiKeysSection() {
  const mine = useQuery(api.apiKeys.mine);
  const create = useAction(api.apiKeys.create);
  const rotateKey = useAction(api.apiKeys.rotate);
  const revoke = useMutation(api.apiKeys.revoke);

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([...DEFAULT_SCOPES]);
  const [lifetime, setLifetime] = useState<number | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [making, setMaking] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string; sandbox: boolean; rotated: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ keyId: string; name: string } | null>(null);
  const [rotating, setRotating] = useState<{ keyId: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/developer/usage", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setUsage((await res.json()) as Usage);
      setUsageFailed(false);
    } catch {
      setUsageFailed(true);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  // A rotation's 24 hours and a key's lifetime end by the clock, so the list
  // re-reads it each minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (mine === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }
  if (mine === null) return null;

  const plan = mine.plan;
  const holding = (sb: boolean) =>
    mine.keys.filter((k) => k.sandbox === sb && keyState(k, now) === "working").length;
  const atLimit = sandbox ? holding(true) >= plan.sandboxKeys : holding(false) >= plan.keys;
  const anyRotating = mine.keys.some((k) => keyState(k, now) === "rotating");
  const perKey = new Map((usage?.byKey ?? []).map((u) => [u.keyId, u]));

  const toggleScope = (s: ApiScope, on: boolean) =>
    setScopes((cur) => (on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s || x === "read")));

  const make = async () => {
    setMaking(true);
    try {
      const r = await create({ name, scopes, sandbox, ...(lifetime !== null ? { expiresInDays: lifetime } : {}) });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setNewKey({ key: r.key, name: r.name, sandbox: r.sandbox, rotated: false });
      setName("");
      void loadUsage();
    } catch {
      toast.error("The key wasn't made. Try again in a moment.");
    } finally {
      setMaking(false);
    }
  };

  const doRotate = async () => {
    if (!rotating) return;
    setBusy(true);
    try {
      const r = await rotateKey({ keyId: rotating.keyId });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setNewKey({ key: r.key, name: r.name, sandbox: r.sandbox, rotated: true });
      setRotating(null);
    } catch {
      toast.error("That didn't rotate. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await revoke({ keyId: confirm.keyId });
      toast.success(`Revoked ${confirm.name}. Calls with it stop within a minute.`);
      setConfirm(null);
    } catch {
      toast.error("That didn't revoke. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, what: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied.`);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsCard
        icon={KeyIcon}
        title="API keys"
        description={`For the PERM Tracker API and AI assistants. ${plan.label} plan: ${plan.perMinute} calls a minute, ${plan.perDay.toLocaleString("en-US")} a day.`}
      >
        {!mine.paywall && (
          <p className="mb-4 border-2 border-border bg-muted px-3 py-2 text-sm">
            Paid features are free for now: every account gets the Plus plan&apos;s limits, exports, live DOL lookups and
            webhooks until billing opens. Your account is on {mine.accountPlan === "plus" ? "Plus" : "Free"}.
          </p>
        )}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <Meter label="Calls today" used={usage?.today ?? 0} limit={plan.perDay} />
          <Meter label="Calls this month" used={usage?.month ?? 0} limit={plan.perMonth} />
        </div>
        {usageFailed && (
          <p className="-mt-3 mb-6 text-sm text-muted-foreground">
            Usage couldn&apos;t be read just now, so these show zero. Your keys still work.
          </p>
        )}

        {newKey && (
          <div className="mb-6 border-2 border-border bg-primary/15 p-4" role="status">
            <p className="mb-2 text-sm font-bold">
              Your new {newKey.sandbox ? "sandbox " : ""}key, {newKey.name}. Copy it now: it isn&apos;t shown again.
              {newKey.rotated ? " The old key keeps working for 24 hours, then stops." : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 break-all border-2 border-border bg-background px-3 py-2 font-mono text-sm">
                {newKey.key}
              </code>{" "}
              <Button variant="outline" className="min-h-[44px]" onClick={() => copy(newKey.key, "Key")}>
                <CopyIcon aria-hidden="true" className="size-4" /> Copy
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 min-h-[44px]" onClick={() => setNewKey(null)}>
              I&apos;ve saved it
            </Button>
          </div>
        )}

        {mine.keys.length > 0 && (
          <ul className="mb-6 divide-y-2 divide-border border-y-2 border-border">
            {mine.keys.map((k) => {
              const u = perKey.get(k.keyId);
              const state = keyState(k, now);
              const last = u?.lastAt ? checkedLabel(u.lastAt) : u?.lastDay ? u.lastDay : null;
              return (
                <li key={k.keyId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {k.name}
                      {k.sandbox ? " (sandbox)" : ""}
                    </p>{" "}
                    <p className="font-mono text-sm text-muted-foreground">{displayKeyId(k.keyId, k.sandbox)}</p>{" "}
                    <p className="text-sm text-muted-foreground">
                      Can: {k.scopes.map((s) => (s in SCOPE_LABELS ? SCOPE_LABELS[s as ApiScope] : s)).join(", ")}.
                    </p>{" "}
                    <p className="text-sm text-muted-foreground">
                      Made {shortDate(k.createdAt)}.{" "}
                      {state === "expired" && k.expiresAt !== null
                        ? `Expired ${shortDate(k.expiresAt)}. `
                        : k.expiresAt !== null
                          ? `Expires ${shortDate(k.expiresAt)}. `
                          : ""}
                      {state === "rotating" && k.graceUntil !== null
                        ? `Rotated: keeps working until ${checkedLabel(k.graceUntil)}. `
                        : ""}
                      {state === "stopped" ? "Rotated: stopped working. " : ""}
                      {(u?.month ?? 0).toLocaleString("en-US")} calls this month
                      {last ? `, last used ${last}` : ""}.
                    </p>
                  </div>{" "}
                  <div className="flex flex-wrap gap-2">
                    {state === "working" && !anyRotating && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-[44px]"
                        onClick={() => setRotating({ keyId: k.keyId, name: k.name })}
                      >
                        Rotate
                      </Button>
                    )}{" "}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px]"
                      onClick={() => setConfirm({ keyId: k.keyId, name: k.name })}
                    >
                      {state === "working" || state === "rotating" ? "Revoke" : "Remove"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void make();
          }}
        >
          <label className="block min-w-0 text-sm font-semibold">
            Name it, so you know where it&apos;s used
            <Input
              className="mt-1"
              value={name}
              maxLength={60}
              placeholder="My script"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">What it can do</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 [&>*]:min-w-0">
              {GRANTABLE_SCOPES.map((s) => (
                <label key={s} className="flex min-h-[44px] items-center gap-3 text-sm">
                  <Checkbox
                    checked={scopes.includes(s)}
                    disabled={s === "read"}
                    onCheckedChange={(v) => toggleScope(s, v === true)}
                  />{" "}
                  {SCOPE_LABELS[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <label className="block text-sm font-semibold">
              How long it lasts
              <select
                className="mt-1 h-11 w-full min-w-0 border-2 border-border bg-background px-3 text-base md:text-sm"
                value={lifetime === null ? "" : String(lifetime)}
                onChange={(e) => setLifetime(e.target.value === "" ? null : Number(e.target.value))}
              >
                {LIFETIMES.map((l) => (
                  <option key={l.label} value={l.days === null ? "" : String(l.days)}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>{" "}
            <label className="flex min-h-[44px] items-center gap-3 self-end text-sm">
              <Checkbox checked={sandbox} onCheckedChange={(v) => setSandbox(v === true)} />{" "}
              Sandbox key: fixed sample data, nothing counted
            </label>
          </div>
          {atLimit ? (
            <p className="text-sm text-muted-foreground">
              {sandbox
                ? `The ${plan.label} plan has ${plan.sandboxKeys} sandbox keys. Revoke one to make a new one.`
                : `The ${plan.label} plan has ${plan.keys === 1 ? "one key" : `${plan.keys} keys`}. Revoke or rotate one to make a new one.`}
            </p>
          ) : (
            <Button type="submit" className="min-h-[44px]" loading={making}>
              Make a {sandbox ? "sandbox " : ""}key
            </Button>
          )}
        </form>
      </SettingsCard>

      <SettingsCard
        icon={PlugsConnectedIcon}
        title="Connect it"
        description="Send the key in a header, never in the address."
      >
        <div className="space-y-4 text-sm">
          <div>
            <p className="mb-1 font-semibold">From a script</p>
            <code className="block overflow-x-auto border-2 border-border bg-muted px-3 py-2 font-mono text-sm whitespace-pre">
              {`curl -H "Authorization: Bearer YOUR_KEY" \\\n  https://permtracker.app/v1/queue`}
            </code>
          </div>
          <div>
            <p className="mb-1 font-semibold">In an AI assistant</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="border-2 border-border bg-muted px-3 py-2 font-mono text-sm">{MCP_URL}</code>{" "}
              <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => copy(MCP_URL, "Address")}>
                <CopyIcon aria-hidden="true" className="size-4" /> Copy
              </Button>
            </div>
            <p className="mt-1 text-muted-foreground">
              Works without a key. With a live key, an assistant gets your plan&apos;s own limits.
            </p>
          </div>
          <p>
            <Link href="/developers" className="font-bold underline underline-offset-4 hover:text-primary">
              Every endpoint, with examples
            </Link>
            {" · "}
            <Link href="/api-terms" className="font-bold underline underline-offset-4 hover:text-primary">
              API terms
            </Link>
          </p>
        </div>
      </SettingsCard>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {confirm?.name}?</DialogTitle>
            <DialogDescription>
              Anything using it stops working within a minute. This can&apos;t be undone; you can make a new key after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
            <Button variant="destructive" className="min-h-[44px]" loading={busy} onClick={() => void doRevoke()}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rotating !== null} onOpenChange={(open) => !open && setRotating(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rotate {rotating?.name}?</DialogTitle>
            <DialogDescription>
              You&apos;ll get a new key with the same name and abilities, shown once. The old key keeps working for 24
              hours, so you can switch over, then it stops.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-[44px]" onClick={() => setRotating(null)}>
              Not now
            </Button>
            <Button className="min-h-[44px]" loading={busy} onClick={() => void doRotate()}>
              Rotate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
