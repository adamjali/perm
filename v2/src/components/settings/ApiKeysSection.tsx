"use client";

// `convex/react` is a CLIENT-ONLY module; declared here rather than inherited.

/**
 * Settings > API keys: make, copy and revoke keys for the PERM Tracker API and
 * AI assistants, and see this month's calls against the plan.
 *
 * A new key is shown once, in this panel, until it's dismissed. Only its hash
 * is stored, so nothing can show it again; losing it means revoking it and
 * making another.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { CopyIcon, KeyIcon, PlugsConnectedIcon } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import { displayKeyId } from "@convex/lib/apiKeyFormat";
import { MCP_URL } from "@/lib/api/openapi";
import { Button } from "@/components/ui/button";
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
  byKey: { keyId: string; today: number; month: number; lastDay: string | null }[];
}


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
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ApiKeysSection() {
  const mine = useQuery(api.apiKeys.mine);
  const create = useAction(api.apiKeys.create);
  const revoke = useMutation(api.apiKeys.revoke);

  const [name, setName] = useState("");
  const [making, setMaking] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<{ keyId: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);

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

  if (mine === undefined) {
    return <Skeleton className="h-72 w-full" />;
  }
  if (mine === null) return null;

  const plan = mine.plan;
  const atLimit = mine.keys.length >= plan.keys;
  const perKey = new Map((usage?.byKey ?? []).map((u) => [u.keyId, u]));

  const make = async () => {
    setMaking(true);
    try {
      const r = await create({ name });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      setNewKey({ key: r.key, name: r.name });
      setName("");
      void loadUsage();
    } catch {
      toast.error("The key wasn't made. Try again in a moment.");
    } finally {
      setMaking(false);
    }
  };

  const doRevoke = async () => {
    if (!confirm) return;
    setRevoking(true);
    try {
      await revoke({ keyId: confirm.keyId });
      toast.success(`Revoked ${confirm.name}. Calls with it stop within a minute.`);
      setConfirm(null);
    } catch {
      toast.error("That didn't revoke. Try again in a moment.");
    } finally {
      setRevoking(false);
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
            <p className="mb-2 text-sm font-bold">Your new key, {newKey.name}. Copy it now: it isn&apos;t shown again.</p>
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
              return (
                <li key={k.keyId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{k.name}</p>{" "}
                    <p className="font-mono text-sm text-muted-foreground">{displayKeyId(k.keyId)}</p>{" "}
                    <p className="text-sm text-muted-foreground">
                      Made {shortDate(k.createdAt)}. {(u?.month ?? 0).toLocaleString("en-US")} calls this month
                      {u?.lastDay ? `, last on ${u.lastDay}` : ""}.
                    </p>
                  </div>{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setConfirm({ keyId: k.keyId, name: k.name })}
                  >
                    Revoke
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {atLimit ? (
          <p className="text-sm text-muted-foreground">
            The {plan.label} plan has {plan.keys === 1 ? "one key" : `${plan.keys} keys`}. Revoke one to make a new one.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void make();
            }}
          >
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Name it, so you know where it&apos;s used
              <Input
                className="mt-1"
                value={name}
                maxLength={60}
                placeholder="My script"
                onChange={(e) => setName(e.target.value)}
              />
            </label>{" "}
            <Button type="submit" className="min-h-[44px]" loading={making}>
              Make a key
            </Button>
          </form>
        )}
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
              Works without a key. With one, an assistant gets your plan&apos;s own limits.
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
            <Button variant="destructive" className="min-h-[44px]" loading={revoking} onClick={() => void doRevoke()}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
