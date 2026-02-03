"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Search, Mail, Trash2, ArrowUpDown, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type SortField = keyof UserSummary;
type SortDirection = "asc" | "desc";
type EditableField = "name" | "userType";

const PAGE_SIZE = 25;

const formatTimestamp = (ts: number | null): string => {
  if (!ts) return "\u2014";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDate = (ts: number | null): string => {
  if (!ts) return "\u2014";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Truncated text cell with tooltip on overflow
function TruncatedCell({ children, maxWidth = 180 }: { children: string; maxWidth?: number }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="block truncate"
            style={{ maxWidth }}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-all">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Column definitions with all 20 fields
const COLUMNS: {
  key: SortField;
  label: string;
  editable?: EditableField;
  render: (user: UserSummary) => React.ReactNode;
  className?: string;
}[] = [
  {
    key: "name",
    label: "Name",
    editable: "name",
    render: (u) => u.name || "(no name)",
    className: "min-w-[140px] max-w-[200px]",
  },
  {
    key: "email",
    label: "Email",
    render: (u) => <TruncatedCell maxWidth={220}>{u.email}</TruncatedCell>,
    className: "min-w-[180px] max-w-[240px]",
  },
  {
    key: "accountStatus",
    label: "Status",
    render: (u) => <StatusBadge status={u.accountStatus} />,
    className: "min-w-[100px]",
  },
  {
    key: "userType",
    label: "Type",
    editable: "userType",
    render: (u) => u.userType.replace(/_/g, " "),
    className: "min-w-[110px]",
  },
  {
    key: "emailVerified",
    label: "Verified",
    render: (u) => (
      <span className={u.emailVerified ? "text-green-600 dark:text-green-400" : "text-red-500"}>
        {u.emailVerified ? "Yes" : "No"}
      </span>
    ),
    className: "min-w-[80px]",
  },
  {
    key: "verificationMethod",
    label: "Auth Method",
    render: (u) => <TruncatedCell maxWidth={120}>{u.verificationMethod.replace(/_/g, " ")}</TruncatedCell>,
    className: "min-w-[110px] max-w-[140px]",
  },
  {
    key: "authProviders" as SortField,
    label: "Providers",
    render: (u) => <TruncatedCell maxWidth={100}>{u.authProviders.join(", ") || "none"}</TruncatedCell>,
    className: "min-w-[90px] max-w-[120px]",
  },
  {
    key: "totalCases",
    label: "Total Cases",
    render: (u) => u.totalCases,
    className: "min-w-[90px] text-center",
  },
  {
    key: "activeCases",
    label: "Active",
    render: (u) => <span className="text-primary font-bold">{u.activeCases}</span>,
    className: "min-w-[70px] text-center",
  },
  {
    key: "deletedCases",
    label: "Deleted",
    render: (u) => u.deletedCases,
    className: "min-w-[70px] text-center",
  },
  {
    key: "totalLogins",
    label: "Logins",
    render: (u) => u.totalLogins,
    className: "min-w-[70px] text-center",
  },
  {
    key: "firmName" as SortField,
    label: "Firm",
    render: (u) => <TruncatedCell maxWidth={140}>{u.firmName || "\u2014"}</TruncatedCell>,
    className: "min-w-[100px] max-w-[160px]",
  },
  {
    key: "termsVersion" as SortField,
    label: "Terms Ver",
    render: (u) => u.termsVersion || "\u2014",
    className: "min-w-[80px]",
  },
  {
    key: "termsAccepted" as SortField,
    label: "Terms Accepted",
    render: (u) => formatDate(u.termsAccepted),
    className: "min-w-[120px]",
  },
  {
    key: "accountCreated",
    label: "Created",
    render: (u) => formatTimestamp(u.accountCreated),
    className: "min-w-[150px]",
  },
  {
    key: "lastLoginTime" as SortField,
    label: "Last Login",
    render: (u) => formatTimestamp(u.lastLoginTime),
    className: "min-w-[150px]",
  },
  {
    key: "lastActivity",
    label: "Last Activity",
    render: (u) => formatTimestamp(u.lastActivity),
    className: "min-w-[150px]",
  },
  {
    key: "lastCaseUpdate" as SortField,
    label: "Last Case Update",
    render: (u) => formatTimestamp(u.lastCaseUpdate),
    className: "min-w-[150px]",
  },
  {
    key: "deletedAt" as SortField,
    label: "Deleted At",
    render: (u) => formatTimestamp(u.deletedAt),
    className: "min-w-[150px]",
  },
  {
    key: "userId" as SortField,
    label: "User ID",
    render: (u) => (
      <TruncatedCell maxWidth={180}>
        {u.userId}
      </TruncatedCell>
    ),
    className: "min-w-[140px] max-w-[200px] font-mono text-xs text-muted-foreground",
  },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800 border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:border-green-400",
    pending_deletion: "bg-orange-100 text-orange-800 border-orange-800 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-400",
    deleted: "bg-red-100 text-red-800 border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:border-red-400",
  };

  const labels: Record<string, string> = {
    active: "Active",
    pending_deletion: "Pending",
    deleted: "Deleted",
  };

  return (
    <span className={`border-2 text-xs font-bold px-2 py-0.5 uppercase tracking-wide whitespace-nowrap ${styles[status] || "bg-gray-100 text-gray-800 border-gray-800 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-400"}`}>
      {labels[status] || status}
    </span>
  );
}

function InlineEdit({
  value,
  field,
  userId,
  onSave,
}: {
  value: string;
  field: EditableField;
  userId: string;
  onSave: (userId: string, field: EditableField, value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  // Sync external value changes (real-time updates from Convex)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(userId, field, editValue);
      setIsEditing(false);
    } catch {
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full text-left px-1 py-0.5 -mx-1 hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/30 transition-all cursor-text rounded-sm truncate block max-w-[180px]"
        title="Click to edit"
      >
        {field === "userType" ? value.replace(/_/g, " ") : value || "(empty)"}
      </button>
    );
  }

  if (field === "userType") {
    return (
      <div className="flex items-center gap-1">
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isSaving}
          className="h-8 border-2 border-primary bg-background px-2 text-sm outline-none"
        >
          <option value="individual">individual</option>
          <option value="firm_admin">firm admin</option>
          <option value="firm_member">firm member</option>
          <option value="(no profile)">(no profile)</option>
        </select>
        <button onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 p-0.5">
          <Check className="size-3.5" />
        </button>
        <button onClick={handleCancel} disabled={isSaving} className="text-red-500 hover:text-red-700 p-0.5">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        disabled={isSaving}
        className="h-8 w-full border-2 border-primary bg-background px-2 text-sm outline-none"
      />
      <button onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 p-0.5 flex-shrink-0">
        <Check className="size-3.5" />
      </button>
      <button onClick={handleCancel} disabled={isSaving} className="text-red-500 hover:text-red-700 p-0.5 flex-shrink-0">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

const SORT_STORAGE_KEY = "admin-users-sort";

function loadSavedSort(): { field: SortField; direction: SortDirection } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.field && parsed.direction) return parsed;
    }
  } catch { /* ignore */ }
  return { field: "lastActivity", direction: "desc" };
}

export function UsersTable({ users }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const saved = loadSavedSort();
  const [sortField, setSortField] = useState<SortField>(saved.field);
  const [sortDirection, setSortDirection] = useState<SortDirection>(saved.direction);
  const [currentPage, setCurrentPage] = useState(0);

  // Modal states
  const [deleteModalUser, setDeleteModalUser] = useState<UserSummary | null>(null);
  const [emailModalUser, setEmailModalUser] = useState<UserSummary | null>(null);

  const updateUser = useMutation(api.admin.updateUserAdmin);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  // Inline save handler
  const handleInlineSave = useCallback(
    async (userId: string, field: EditableField, value: string) => {
      try {
        const args: Record<string, unknown> = { userId };
        if (field === "name") args.fullName = value;
        if (field === "userType") args.userType = value;

        await updateUser(args as any);
        toast.success(`Updated ${field}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update");
        throw error;
      }
    },
    [updateUser]
  );

  // Filter
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.userType.toLowerCase().includes(q) ||
        u.accountStatus.toLowerCase().includes(q) ||
        (u.firmName?.toLowerCase().includes(q) ?? false) ||
        u.userId.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  // Sort
  const sortedUsers = useMemo(() => {
    const sorted = [...filteredUsers];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null && bVal === null) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortDirection === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // arrays (authProviders)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        return sortDirection === "asc"
          ? aVal.join(",").localeCompare(bVal.join(","))
          : bVal.join(",").localeCompare(aVal.join(","));
      }

      return 0;
    });
    return sorted;
  }, [filteredUsers, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedUsers = sortedUsers.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const showPagination = sortedUsers.length > PAGE_SIZE;

  const handleSort = (field: SortField) => {
    let newDirection: SortDirection;
    if (sortField === field) {
      newDirection = sortDirection === "asc" ? "desc" : "asc";
      setSortDirection(newDirection);
    } else {
      newDirection = "desc";
      setSortField(field);
      setSortDirection(newDirection);
    }
    setCurrentPage(0);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ field, direction: newDirection }));
    } catch { /* private browsing */ }
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b-2 border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="font-heading text-xl font-bold uppercase tracking-wide">
              Users ({filteredUsers.length}{filteredUsers.length !== users.length ? ` of ${users.length}` : ""})
            </CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 sm:min-w-[300px]">
                <Input
                  placeholder="Search email, name, type, status, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/60 pointer-events-none" />
              </div>
              <ExportButton users={sortedUsers} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b-2 border-border bg-muted/50 sticky top-0 z-10">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`p-3 text-left text-xs whitespace-nowrap ${col.className || ""}`}
                    >
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-primary transition-colors font-bold uppercase tracking-wide"
                      >
                        {col.label}
                        <ArrowUpDown
                          className={`size-3 ${sortField === col.key ? "text-primary" : "opacity-30"}`}
                        />
                      </button>
                    </th>
                  ))}
                  <th className="p-3 text-right text-xs font-bold uppercase tracking-wide sticky right-0 bg-muted/50 min-w-[90px] border-l-2 border-border">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    {COLUMNS.map((col) => (
                      <td key={col.key} className={`p-3 text-sm ${col.className || ""}`}>
                        {col.editable ? (
                          <InlineEdit
                            value={String(user[col.editable])}
                            field={col.editable}
                            userId={user.userId}
                            onSave={handleInlineSave}
                          />
                        ) : (
                          col.render(user)
                        )}
                      </td>
                    ))}
                    <td className="p-3 sticky right-0 bg-card border-l-2 border-border">
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
                {searchQuery ? (
                  <div>
                    <p className="font-bold">No users found</p>
                    <p className="text-sm mt-1">Try a different search term</p>
                  </div>
                ) : (
                  "No users found."
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className="flex items-center justify-between border-t-2 border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Showing {safePage * PAGE_SIZE + 1}\u2013{Math.min((safePage + 1) * PAGE_SIZE, sortedUsers.length)} of {sortedUsers.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setCurrentPage(0)}
                  disabled={safePage === 0}
                  title="First page"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  title="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="px-3 text-sm font-bold tabular-nums">
                  {safePage + 1} / {totalPages}
                </span>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  title="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  onClick={() => setCurrentPage(totalPages - 1)}
                  disabled={safePage >= totalPages - 1}
                  title="Last page"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
