"use client";

/**
 * Security dashboard client, 4-tab view for abuse monitoring.
 *
 * Tabs:
 *   Events, live event stream (rate-limit strikes, system errors)
 *   Blocked IPs, active abuseBlocklist entries + manual override
 *   Flagged Users, suspended user profiles + unsuspend action
 *   Settings, thresholds + admin notification prefs (read-only for now)
 *
 * Neo-brutalist + "ops console" aesthetic: dark mono tables, amber/red
 * alert accents, 2px borders, hard shadows matching the rest of admin.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftIcon, CheckIcon, CircleNotchIcon, GearIcon as SettingsIcon, ProhibitIcon as Ban, PulseIcon as Activity, ShieldIcon, UserMinusIcon as UserX, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useAdminAuth } from "@/lib/admin/adminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type TabId = "events" | "blocked" | "flagged" | "settings";

const TABS: Array<{ id: TabId; label: string; icon: typeof Activity }> = [
  { id: "events", label: "Events", icon: Activity },
  { id: "blocked", label: "Blocked IPs", icon: Ban },
  { id: "flagged", label: "Flagged Users", icon: UserX },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function SecurityDashboardClient() {
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  const [tab, setTab] = useState<TabId>("events");

  const summary = useQuery(
    api.adminSecurity.getSecuritySummary,
    !isAdmin ? "skip" : {},
  );

  if (authLoading) return <DashboardSkeleton />;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <Card className="border-2 border-destructive">
          <CardContent className="py-12 text-center">
            <ShieldIcon className="mx-auto h-12 w-12 text-destructive" />
            <p className="mono mt-4 font-bold uppercase tracking-widest">
              Access denied, admin only
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      {/* This page was reachable from the admin dashboard and had no way back:
          the only exit was the browser button. */}
      <Link
        href="/admin"
        className="mono inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden />
        Admin dashboard
      </Link>

      <header className="flex items-center gap-3">
        <ShieldIcon className="h-8 w-8 text-primary" aria-hidden />
        <div>
          <h1 className="font-heading text-3xl font-black uppercase tracking-tight">
            Security Ops
          </h1>{" "}
          <p className="mono text-sm uppercase tracking-widest text-muted-foreground">
            Abuse monitoring · blocklist · flagged users
          </p>
        </div>
      </header>

      <SummaryCards summary={summary ?? undefined} />

      <nav
        role="tablist"
        aria-label="Security sections"
        className="flex flex-wrap gap-2 border-b-2 border-border pb-0"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={cn(
                "mono flex items-center gap-2 border-2 px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all",
                active
                  ? "translate-y-[-1px] border-foreground bg-primary text-primary-foreground shadow-hard"
                  : "border-border bg-background hover:shadow-hard-sm",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </nav>

      <section>
        {tab === "events" && <EventsTab />}
        {tab === "blocked" && <BlockedIpsTab />}
        {tab === "flagged" && <FlaggedUsersTab />}
        {tab === "settings" && <SettingsTab />}
      </section>
    </div>
  );
}

// ==========================================================================
// SUMMARY CARDS (top — F-pattern, biggest number top-left)
// ==========================================================================

// Derived from the query's return type so the card shape can’t drift from the
// API (e.g. the backend's `generatedAt` field is included automatically).
type SummaryShape = FunctionReturnType<typeof api.adminSecurity.getSecuritySummary>;

type CardAccent = "destructive" | "amber";

/**
 * Accent classes for a summary card, gated on whether its value crosses an
 * alert threshold. Lifted out of the JSX to keep the card-render path flat.
 */
function cardAccentClass(accent: CardAccent, value: number | undefined): string {
  const alert =
    accent === "destructive"
      ? typeof value === "number" && value > 0
      : typeof value === "number" && value > 10;
  if (!alert) return "border-border";
  return accent === "destructive"
    ? "border-destructive bg-destructive/5"
    : "border-data-warn bg-data-warn";
}

function SummaryCards({ summary }: { summary?: SummaryShape }) {
  const cards = [
    { label: "Blocked IPs", value: summary?.activeBlockedIps, accent: "destructive" as const, icon: Ban },
    { label: "Rate-limit Strikes 24h", value: summary?.strikeHitsLast24h, accent: "amber" as const, icon: AlertTriangle },
    { label: "System Errors 24h", value: summary?.systemErrorsLast24h, accent: "amber" as const, icon: AlertTriangle },
    { label: "Flagged Users", value: summary?.flaggedUsers, accent: "destructive" as const, icon: UserX },
  ];
  return (
    <div className="grid [&>*]:min-w-0 grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card
            key={c.label}
            className={cn("border-2 shadow-hard", cardAccentClass(c.accent, c.value))}
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between">
                <p className="mono text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
                <Icon className="h-4 w-4 opacity-60" aria-hidden />
              </div>
              <p className="font-heading text-3xl font-black">
                {typeof c.value === "number" ? c.value.toLocaleString() : "-"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ==========================================================================
// EVENTS TAB
// ==========================================================================

type SecurityEvent = FunctionReturnType<typeof api.adminSecurity.listRecentEvents>[number];

/** Actor column value, narrowed per discriminated event kind. */
function actorFor(event: SecurityEvent): string {
  switch (event.kind) {
    case "strike":
      return event.ip;
    case "rate_limit":
      return event.actor;
    default:
      return "-";
  }
}

function EventsTab() {
  const events = useQuery(api.adminSecurity.listRecentEvents, { limit: 200 });
  if (!events) return <TableSkeleton rows={8} />;
  if (events.length === 0) {
    return (
      <Card className="border-2">
        <CardContent className="py-12 text-center">
          <CheckIcon className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <p className="mono mt-2 text-sm uppercase tracking-widest text-muted-foreground">
            No recent security events
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-2 shadow-hard">
      <CardHeader className="border-b-2 border-border">
        <CardTitle className="mono text-sm uppercase tracking-widest">
          Recent Events
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="mono border-b-2 border-border bg-muted/40 text-sm uppercase tracking-widest">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Kind</th>
                <th className="px-3 py-2 text-left">Endpoint</th>
                <th className="px-3 py-2 text-left">Actor</th>
                <th className="px-3 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="mono">
              {events.map((e) => (
                <tr
                  key={e.id}
                  className={cn(
                    "border-b border-border hover:bg-muted/30",
                    e.severity === "error" && "bg-destructive/5",
 e.severity === "warning" && "bg-data-warn",
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-muted-foreground">
                    {new Date(e.at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block border-2 px-1.5 py-0.5 text-sm font-bold uppercase tracking-widest",
 e.kind === "strike" && "border-data-warn text-data-warn-ink",
                        e.kind === "rate_limit" && "border-border",
                        e.kind === "error" && "border-destructive text-destructive",
                      )}
                    >
                      {e.kind}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-sm">{e.endpoint}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-sm">
                    {actorFor(e)}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-sm text-muted-foreground">
                    {e.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ==========================================================================
// BLOCKED IPS TAB
// ==========================================================================

function BlockedIpsTab() {
  const blocks = useQuery(api.abuseBlocklist.listActiveBlocks, {});
  const blockIp = useMutation(api.abuseBlocklist.adminBlockIp);
  const unblockIp = useMutation(api.abuseBlocklist.adminUnblockIp);

  const [newIp, setNewIp] = useState("");
  const [newReason, setNewReason] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  async function handleBlock() {
    if (!newIp.trim()) return;
    setPending("add");
    try {
      await blockIp({ ip: newIp.trim(), reason: newReason.trim() || "manual" });
      toast.success(`Blocked ${newIp}`);
      setNewIp("");
      setNewReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block");
    } finally {
      setPending(null);
    }
  }

  async function handleUnblock(ip: string) {
    setPending(ip);
    try {
      await unblockIp({ ip });
      toast.success(`Unblocked ${ip}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unblock");
    } finally {
      setPending(null);
    }
  }

  if (!blocks) return <TableSkeleton rows={6} />;

  return (
    <div className="space-y-4">
      <Card className="border-2 shadow-hard">
        <CardHeader className="border-b-2 border-border">
          <CardTitle className="mono text-sm uppercase tracking-widest">
            Manual Block
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="IP address"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              className="mono"
              disabled={pending === "add"}
            />
            <Input
              placeholder="Reason (e.g. manual-review)"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="mono"
              disabled={pending === "add"}
            />
            <Button
              onClick={handleBlock}
              disabled={!newIp.trim() || pending === "add"}
              className="sm:min-w-[120px]"
            >
              {pending === "add" ? (
                <CircleNotchIcon className="h-4 w-4 animate-spin" />
              ) : (
                "BLOCK"
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Defaults to 24h. Blocks expire automatically; hourly cron cleans them up.
          </p>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-hard">
        <CardHeader className="border-b-2 border-border">
          <CardTitle className="mono text-sm uppercase tracking-widest">
            Active Blocks ({blocks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {blocks.length === 0 ? (
            <div className="py-12 text-center">
              <CheckIcon className="mx-auto h-8 w-8 text-primary" aria-hidden />
              <p className="mono mt-2 text-sm uppercase tracking-widest text-muted-foreground">
                No active blocks
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="mono border-b-2 border-border bg-muted/40 text-sm uppercase tracking-widest">
                <tr>
                  <th className="px-3 py-2 text-left">IP</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-left">Added</th>
                  <th className="px-3 py-2 text-left">Expires</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="mono">
                {blocks.map((b) => (
                  <tr key={b._id} className="border-b border-border">
                    <td className="px-3 py-2 text-sm">{b.ip}</td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">{b.reason}</td>
                    <td className="px-3 py-2 text-sm">{new Date(b.addedAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm">{new Date(b.expiresAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm">
                      <span
                        className={cn(
                          "border-2 px-1.5 py-0.5 text-sm font-bold uppercase tracking-widest",
                          b.manualOverride
                            ? "border-primary text-primary"
                            : "border-data-warn text-data-warn-ink",
                        )}
                      >
                        {b.manualOverride ? "manual" : "auto"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnblock(b.ip)}
                        disabled={pending === b.ip}
                      >
                        {pending === b.ip ? (
                          <CircleNotchIcon className="h-3 w-3 animate-spin" />
                        ) : (
                          "UNBLOCK"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================================================
// FLAGGED USERS TAB
// ==========================================================================

function FlaggedUsersTab() {
  const flagged = useQuery(api.adminSecurity.listFlaggedUsers, {});
  const unsuspend = useMutation(api.adminSecurity.adminUnsuspendUser);
  const [pending, setPending] = useState<string | null>(null);

  async function handleUnsuspend(userId: string) {
    setPending(userId);
    try {
      await unsuspend({ userId: userId as Id<"users"> });
      toast.success("User unsuspended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(null);
    }
  }

  if (!flagged) return <TableSkeleton rows={4} />;
  if (flagged.length === 0) {
    return (
      <Card className="border-2">
        <CardContent className="py-12 text-center">
          <CheckIcon className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <p className="mono mt-2 text-sm uppercase tracking-widest text-muted-foreground">
            No flagged users
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 shadow-hard">
      <CardHeader className="border-b-2 border-border">
        <CardTitle className="mono text-sm uppercase tracking-widest">
          Flagged / Suspended Users ({flagged.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="mono border-b-2 border-border bg-muted/40 text-sm uppercase tracking-widest">
            <tr>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Suspended At</th>
              <th className="px-3 py-2 text-left">Until</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="mono">
            {flagged.map((u) => (
              <tr key={u.profileId} className="border-b border-border bg-destructive/5">
                <td className="px-3 py-2 text-sm">{u.email ?? "-"}</td>
                <td className="px-3 py-2 text-sm">
                  {u.suspendedAt ? new Date(u.suspendedAt).toLocaleString() : "-"}
                </td>
                <td className="px-3 py-2 text-sm">
                  {u.suspendedUntil ? new Date(u.suspendedUntil).toLocaleString() : "-"}
                </td>
                <td className="px-3 py-2 text-sm text-muted-foreground">
                  {u.suspendedReason ?? "-"}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnsuspend(u.userId)}
                    disabled={pending === u.userId}
                  >
                    {pending === u.userId ? (
                      <CircleNotchIcon className="h-3 w-3 animate-spin" />
                    ) : (
                      "UNSUSPEND"
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ==========================================================================
// SETTINGS TAB (read-only for now; v1 surfaces current thresholds from code)
// ==========================================================================

function SettingsTab() {
  const rows = [
    ["/api/auth POST, per-IP", "500/hr"],
    ["/api/chat POST, per-IP", "120/min"],
    ["Auto-block after", "3 rate-limit rejections in 15 minutes"],
    ["Auto-block duration", "24 hours"],
    ["Per-email, login", "20 per 15 min"],
    ["Per-email, OTP verify", "10 per 15 min"],
    ["Per-email, password reset", "5 per hour"],
    ["Per-user, queryCases (chat tool)", "not rate-limited (auto-cached query)"],
    ["Per-user, cases.create / .update", "60/min/user (burst 10)"],
    ["Per-user, knowledge.searchKnowledge", "20/min/user (burst 5)"],
  ];
  return (
    <Card className="border-2 shadow-hard">
      <CardHeader className="border-b-2 border-border">
        <CardTitle className="mono text-sm uppercase tracking-widest">
          Rate Limit Thresholds (code-defined)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody className="mono">
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <td className="px-3 py-2 text-sm text-muted-foreground">{k}</td>
                <td className="px-3 py-2 text-sm font-bold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="p-4 text-sm text-muted-foreground">
          Edit these by modifying convex/authRateLimit.ts (per-IP, per-email) and
          convex/rateLimitConfig.ts (per-user) then deploying. A future release will
          make these editable from this page.
        </p>
      </CardContent>
    </Card>
  );
}

// ==========================================================================
// LOADING STATES
// ==========================================================================

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <Skeleton className="h-8 w-64" />
      <div className="grid [&>*]:min-w-0 grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="border-2 shadow-hard">
      <CardHeader className="border-b-2 border-border">
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
