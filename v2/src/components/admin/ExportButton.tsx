"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportUsersToCSV, downloadCSV } from "@/lib/admin/csvExport";
import { toast } from "@/lib/toast";

interface ExportButtonProps {
  users: Array<{
    userId: string;
    email: string;
    name: string;
    emailVerified: boolean;
    verificationMethod: string;
    authProviders: string[];
    accountCreated: number;
    lastLoginTime: number | null;
    totalLogins: number;
    totalCases: number;
    activeCases: number;
    deletedCases: number;
    lastCaseUpdate: number | null;
    userType: string;
    firmName: string | null;
    accountStatus: string;
    deletedAt: number | null;
    termsAccepted: number | null;
    termsVersion: string | null;
    lastActivity: number;
  }>;
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
