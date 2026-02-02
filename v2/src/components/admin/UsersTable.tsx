"use client";

import { useState, useMemo } from "react";
import { Search, Mail, Edit, Trash2, ArrowUpDown, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserEditModal } from "./UserEditModal";
import { UserDeleteConfirmModal } from "./UserDeleteConfirmModal";
import { SendEmailModal } from "./SendEmailModal";
import { ExportButton } from "./ExportButton";

interface UserSummary {
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
}

interface UsersTableProps {
  users: UserSummary[];
}

type SortField = "email" | "name" | "totalCases" | "activeCases" | "lastActivity" | "accountCreated";
type SortDirection = "asc" | "desc";

export function UsersTable({ users }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("lastActivity");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Modal states
  const [editModalUser, setEditModalUser] = useState<UserSummary | null>(null);
  const [deleteModalUser, setDeleteModalUser] = useState<UserSummary | null>(null);
  const [emailModalUser, setEmailModalUser] = useState<UserSummary | null>(null);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;

    const query = searchQuery.toLowerCase();
    return users.filter((user) =>
      user.email.toLowerCase().includes(query) ||
      user.name.toLowerCase().includes(query) ||
      user.userType.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Sort users
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];

    sorted.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortField) {
        case "email":
          aVal = a.email;
          bVal = b.email;
          break;
        case "name":
          aVal = a.name;
          bVal = b.name;
          break;
        case "totalCases":
          aVal = a.totalCases;
          bVal = b.totalCases;
          break;
        case "activeCases":
          aVal = a.activeCases;
          bVal = b.activeCases;
          break;
        case "lastActivity":
          aVal = a.lastActivity;
          bVal = b.lastActivity;
          break;
        case "accountCreated":
          aVal = a.accountCreated;
          bVal = b.accountCreated;
          break;
        default:
          return 0;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return sorted;
  }, [filteredUsers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800 border-green-800 dark:bg-green-900/20 dark:text-green-400",
      pending_deletion: "bg-orange-100 text-orange-800 border-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
      deleted: "bg-red-100 text-red-800 border-red-800 dark:bg-red-900/20 dark:text-red-400",
    };

    const labels = {
      active: "Active",
      pending_deletion: "Pending Deletion",
      deleted: "Deleted",
    };

    return (
      <span className={`border-2 text-xs font-bold px-2 py-0.5 uppercase tracking-wide ${styles[status as keyof typeof styles] || ""}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase tracking-wide"
    >
      {children}
      <ArrowUpDown className="size-3" />
    </button>
  );

  return (
    <>
      <Card>
        <CardHeader className="border-b-2 border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Users ({sortedUsers.length})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <ExportButton users={sortedUsers} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-border bg-muted/50">
                <tr>
                  <th className="text-left p-4 text-xs">
                    <SortButton field="email">Email</SortButton>
                  </th>
                  <th className="text-left p-4 text-xs">
                    <SortButton field="name">Name</SortButton>
                  </th>
                  <th className="text-left p-4 text-xs">Status</th>
                  <th className="text-center p-4 text-xs">
                    <SortButton field="totalCases">Total Cases</SortButton>
                  </th>
                  <th className="text-center p-4 text-xs">
                    <SortButton field="activeCases">Active</SortButton>
                  </th>
                  <th className="text-left p-4 text-xs">
                    <SortButton field="lastActivity">Last Activity</SortButton>
                  </th>
                  <th className="text-right p-4 text-xs font-bold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b-2 border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{user.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.authProviders.join(", ")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {user.userType.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(user.accountStatus)}
                    </td>
                    <td className="p-4 text-center font-semibold">
                      {user.totalCases}
                    </td>
                    <td className="p-4 text-center font-semibold text-primary">
                      {user.activeCases}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{formatDate(user.lastActivity)}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.lastLoginTime ? `Login: ${formatDate(user.lastLoginTime)}` : "Never logged in"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEmailModalUser(user)}
                          title="Send email"
                        >
                          <Mail className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setEditModalUser(user)}
                          title="Edit user"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteModalUser(user)}
                          title="Delete user"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {sortedUsers.length === 0 && (
              <div className="p-12 text-center text-muted-foreground">
                {searchQuery ? "No users found matching your search." : "No users found."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {editModalUser && (
        <UserEditModal
          user={editModalUser}
          onClose={() => setEditModalUser(null)}
        />
      )}

      {deleteModalUser && (
        <UserDeleteConfirmModal
          user={deleteModalUser}
          onClose={() => setDeleteModalUser(null)}
        />
      )}

      {emailModalUser && (
        <SendEmailModal
          user={emailModalUser}
          onClose={() => setEmailModalUser(null)}
        />
      )}
    </>
  );
}
