"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAdminAuth } from "@/lib/admin/adminAuth";
import { Shield, AlertCircle } from "lucide-react";
import { AdminStatsGrid } from "@/components/admin/AdminStatsGrid";
import { UsersTable } from "@/components/admin/UsersTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardClient() {
  const { isAdmin, isLoading: authLoading } = useAdminAuth();
  const dashboardData = useQuery(api.admin.getAdminDashboardData);

  // Loading state
  if (authLoading || dashboardData === undefined) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 border-b-4 border-border pb-6">
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
              You do not have permission to access the admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4 border-b-4 border-border pb-6">
        <div className="flex size-12 items-center justify-center border-2 border-border bg-primary shadow-hard">
          <Shield className="size-6 text-black" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-wide">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage users, view system stats, and perform admin actions
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <AdminStatsGrid data={dashboardData} />

      {/* Users Table */}
      <UsersTable users={dashboardData.users} />
    </div>
  );
}
