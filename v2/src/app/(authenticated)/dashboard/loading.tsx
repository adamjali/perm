import { DashboardSkeleton } from "@/components/dashboard/DashboardShell";

/**
 * The dashboard's loading state is the dashboard's own skeleton, the same
 * components its widgets render while their data loads. See DashboardShell.
 */
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}
