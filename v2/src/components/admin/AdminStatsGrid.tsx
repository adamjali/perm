"use client";

import { BriefcaseIcon, ClockIcon, FolderOpenIcon, TrendUpIcon as TrendingUp, UserCheckIcon, UserIcon, UserMinusIcon as UserX, UsersIcon } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminStatsGridProps {
  data: {
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    pendingDeletion: number;
    usersWithCases: number;
    /** Absent from a dashboard built before the audience mark existed. */
    practiceUsers?: number;
    ownCaseUsers?: number;
    totalCasesInSystem: number;
  };
}

export function AdminStatsGrid({ data }: AdminStatsGridProps) {
  const stats = [
    {
      label: "Total users",
      value: data.totalUsers,
      icon: UsersIcon,
      color: "text-data-info-ink",
      bgColor: "bg-data-info/10",
    },
    {
      label: "Active users",
      value: data.activeUsers,
      icon: UserCheckIcon,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      // Attorneys, paralegals, HR and employers: the people the app is for.
      label: "In practice",
      value: data.practiceUsers ?? 0,
      icon: BriefcaseIcon,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Tracking own case",
      value: data.ownCaseUsers ?? 0,
      icon: UserIcon,
      color: "text-data-info-ink",
      bgColor: "bg-data-info/10",
    },
    {
      label: "Users with cases",
      value: data.usersWithCases,
      icon: FolderOpenIcon,
      color: "text-stage-recruitment-ink",
      bgColor: "bg-stage-recruitment/10",
    },
    {
      label: "Total cases",
      value: data.totalCasesInSystem,
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Pending deletion",
      value: data.pendingDeletion,
      icon: ClockIcon,
      color: "text-data-warn-ink",
      bgColor: "bg-data-warn/15",
    },
    {
      label: "Deleted users",
      value: data.deletedUsers,
      icon: UserX,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat) => (
        // No staggered entrance: the delays let each card show, vanish and
        // fade back in (tw-animate's fill mode does not hold the first frame).
        <Card key={stat.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </CardTitle>
            <div className={`p-2 border-2 border-border ${stat.bgColor} shadow-hard-sm`}>
              <stat.icon className={`size-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-heading font-bold ${stat.color}`}>
              {stat.value.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
