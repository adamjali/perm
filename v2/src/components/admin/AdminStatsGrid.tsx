"use client";

import { Users, UserCheck, UserX, Clock, FolderOpen, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminStatsGridProps {
  data: {
    totalUsers: number;
    activeUsers: number;
    deletedUsers: number;
    pendingDeletion: number;
    usersWithCases: number;
    totalCasesInSystem: number;
  };
}

export function AdminStatsGrid({ data }: AdminStatsGridProps) {
  const stats = [
    {
      label: "Total Users",
      value: data.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      label: "Active Users",
      value: data.activeUsers,
      icon: UserCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Users with Cases",
      value: data.usersWithCases,
      icon: FolderOpen,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
    {
      label: "Total Cases",
      value: data.totalCasesInSystem,
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      label: "Pending Deletion",
      value: data.pendingDeletion,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-900/20",
    },
    {
      label: "Deleted Users",
      value: data.deletedUsers,
      icon: UserX,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.label}
          className="animate-in fade-in slide-in-from-bottom-4 duration-300"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </CardTitle>
            <div className={`p-2 border-2 border-border ${stat.bgColor} shadow-hard-sm`}>
              <stat.icon className={`size-4 ${stat.color}`} strokeWidth={2.5} />
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
