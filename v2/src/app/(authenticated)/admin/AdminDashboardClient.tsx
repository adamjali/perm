"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAdminAuth } from "@/lib/admin/adminAuth";
import { ShieldIcon, WarningCircleIcon as AlertCircle } from "@phosphor-icons/react";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { UsersTable } from "@/components/admin/UsersTable";
import { ActivityPanel, DigestPanel, SubscriptionsPanel } from "@/components/admin/SignalsPanel";
import { BudgetPools, DeliveryPanel } from "@/components/admin/DeliveryPanel";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { ScorecardPanel } from "@/components/admin/ScorecardPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";

export default function AdminDashboardClient() {
  const { isAdmin, isLoading: authLoading, isSigningOut } = useAdminAuth();

  // Server-side pagination state
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<string>("lastActivity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const skip = isSigningOut || authLoading || !isAdmin;
  const signals = useQuery(api.adminSignals.getSignals, skip ? "skip" : {});
  const delivery = useQuery(api.adminDelivery.getDelivery, skip ? "skip" : {});

  const dashboardData = useQuery(
    api.admin.getAdminDashboardData,
    isSigningOut || authLoading || !isAdmin ? "skip" : {
      page,
      pageSize: 25,
      sortBy: sortField,
      sortOrder,
      search: debouncedSearch || undefined,
    }
  );

  // Apply server-provided sort preference on initial load
  const [hasAppliedServerSort, setHasAppliedServerSort] = useState(false);
  if (dashboardData && !hasAppliedServerSort) {
    const pref = dashboardData.adminSortPreference;
    if (pref.sortBy !== sortField || pref.sortOrder !== sortOrder) {
      setSortField(pref.sortBy);
      setSortOrder(pref.sortOrder);
    }
    setHasAppliedServerSort(true);
  }

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSortChange = useCallback((field: string, order: "asc" | "desc") => {
    setSortField(field);
    setSortOrder(order);
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);

  // Loading state
  if (authLoading || dashboardData === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 border-b-3 border-border pb-6">
          <Skeleton className="h-12 w-12" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>

        {/* Stats grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>

        {/* Table skeleton */}
        <Skeleton className="h-96" />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-destructive">
              <AlertCircle className="size-6" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You don’t have permission to access the admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b-3 border-border pb-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center border-2 border-border bg-primary shadow-hard">
            <ShieldIcon className="size-6 text-black" />
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-wide">
              Admin Dashboard
            </h1>{" "}
            <p className="text-muted-foreground">
              Users, alerts and email, and the weekly digest
            </p>
          </div>
        </div>
        <Link
          href="/admin/security"
          className="mono flex items-center gap-2 border-2 border-foreground bg-background px-4 py-2 text-sm font-bold uppercase tracking-widest shadow-hard-sm transition-all hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          <ShieldIcon className="h-4 w-4" aria-hidden />
          Security Ops
        </Link>
      </div>

      <AdminTabs
        tabs={[
          {
            id: "overview",
            label: "Overview",
            content: (
              <div className="space-y-8">
                <AdminStatsGrid data={dashboardData} />
                {delivery ? <BudgetPools pools={delivery.pools} /> : <Skeleton className="h-64" />}
                {signals ? <ActivityPanel signals={signals} /> : <Skeleton className="h-48" />}
              </div>
            ),
          },
          {
            id: "alerts",
            label: "Alerts and email",
            badge: delivery && delivery.outbox.queued > 0 ? `${delivery.outbox.queued} waiting` : null,
            content: (
              <div className="space-y-8">
                {delivery ? <DeliveryPanel data={delivery} /> : <Skeleton className="h-96" />}
                {signals ? <SubscriptionsPanel signals={signals} /> : <Skeleton className="h-64" />}
              </div>
            ),
          },
          {
            id: "users",
            label: "Users",
            badge: String(dashboardData.totalCount),
            content: (
              <UsersTable
                users={dashboardData.users}
                totalCount={dashboardData.totalCount}
                totalPages={dashboardData.totalPages}
                page={dashboardData.page}
                onPageChange={handlePageChange}
                sortField={sortField}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                search={search}
                onSearchChange={handleSearchChange}
              />
            ),
          },
          {
            id: "digest",
            label: "Weekly digest",
            content: signals ? <DigestPanel signals={signals} /> : <Skeleton className="h-48" />,
          },
          {
            id: "scorecard",
            label: "Scorecard",
            content: <ScorecardPanel />,
          },
        ]}
      />
    </div>
  );
}
