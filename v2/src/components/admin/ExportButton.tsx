"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportUsersToCSV, downloadCSV } from "@/lib/admin/csvExport";
import { toast } from "@/lib/toast";
import type { UserSummary } from "@/lib/admin/types";

interface ExportButtonProps {
  users: UserSummary[];
}

export function ExportButton({ users }: ExportButtonProps) {
  const handleExport = () => {
    try {
      const csvContent = exportUsersToCSV(users);
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `perm-tracker-users-${timestamp}.csv`;

      downloadCSV(csvContent, filename);
      toast.success(`Exported ${users.length} user${users.length !== 1 ? "s" : ""} to CSV`);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      toast.error("Failed to export CSV");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      className="flex items-center gap-2"
    >
      <Download className="size-4" />
      Export CSV
    </Button>
  );
}
