"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useTransition } from "react";
import { Plus, CheckSquare, Upload, AlertTriangle } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "@/lib/toast";
import { api } from "../../../../convex/_generated/api";
import { usePageContextUpdater } from "@/lib/ai/page-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion, AnimatePresence } from "motion/react";
import { SortableCaseCard } from "@/components/cases/SortableCaseCard";
import { CaseFilterBar } from "@/components/cases/CaseFilterBar";
import { CasePagination } from "@/components/cases/CasePagination";
import { CaseListEmptyState } from "@/components/cases/CaseListEmptyState";
import { SelectionBar } from "@/components/cases/SelectionBar";
import { ImportModal } from "@/components/cases/ImportModal";
import { ViewToggle, type ViewMode } from "@/components/cases/ViewToggle";
import { CaseListView } from "@/components/cases/CaseListView";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { sortCases } from "../../../../convex/lib/caseListHelpers";
import {
  exportFullCasesJSON,
  exportFullCasesCSV,
  type FullCaseData,
} from "@/lib/export";
import type {
  CaseListFilters,
  CaseListSort,
  CaseListSortField,
  SortOrder,
} from "../../../../convex/lib/caseListTypes";
import type { CaseStatus, ProgressStatus } from "../../../../convex/lib/dashboardTypes";

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_STORAGE_KEY = "perm-tracker-page-size";
const VIEW_MODE_STORAGE_KEY = "perm-tracker-view-mode";
const DEFAULT_SORT: CaseListSort = {
  sortBy: "deadline",
  sortOrder: "asc",
};

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

function getStoredPageSize(): number {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const stored = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
        return parsed;
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[CasesPage] localStorage read failed:", error);
    }
  }
  return DEFAULT_PAGE_SIZE;
}

function setStoredPageSize(size: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(size));
  } catch (error) {
    // Handle quota exceeded or other storage errors
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("[CasesPage] localStorage quota exceeded");
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[CasesPage] localStorage write failed:", error);
    }
  }
}

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "card";
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === "list" || stored === "card") {
      return stored;
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[CasesPage] localStorage read failed:", error);
    }
  }
  return "card";
}

function setStoredViewMode(mode: ViewMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("[CasesPage] localStorage quota exceeded");
    } else if (process.env.NODE_ENV === "development") {
      console.warn("[CasesPage] localStorage write failed:", error);
    }
  }
}

// ============================================================================
// URL PARAM PARSING
// ============================================================================

function parseURLFilters(searchParams: URLSearchParams): CaseListFilters {
  const status = searchParams.get("status") as CaseStatus | null;
  const progressStatus = searchParams.get("progress") as ProgressStatus | null;
  const searchQuery = searchParams.get("search");
  const favoritesOnly = searchParams.get("favorites") === "true";
  const duplicatesOnly = searchParams.get("duplicates") === "true";
  // activeOnly defaults to true (Active tab is default), false only when explicitly set
  const activeOnlyParam = searchParams.get("activeOnly");
  const activeOnly = activeOnlyParam === "false" ? false : true;

  return {
    status: status || undefined,
    progressStatus: progressStatus || undefined,
    searchQuery: searchQuery || undefined,
    favoritesOnly: favoritesOnly || undefined,
    duplicatesOnly: duplicatesOnly || undefined,
    activeOnly,
  };
}

function parseURLSort(searchParams: URLSearchParams): CaseListSort {
  const sortBy = searchParams.get("sort") as CaseListSortField | null;
  const sortOrder = searchParams.get("order") as SortOrder | null;

  return {
    sortBy: sortBy || DEFAULT_SORT.sortBy,
    sortOrder: sortOrder || DEFAULT_SORT.sortOrder,
  };
}

function parseURLPage(searchParams: URLSearchParams): number {
  const page = searchParams.get("page");
  return page ? Math.max(1, parseInt(page, 10)) : 1;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CasesPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ============================================================================
  // URL STATE
  // ============================================================================

  const [filters, setFilters] = useState<CaseListFilters>(() =>
    parseURLFilters(searchParams)
  );
  const [sort, setSort] = useState<CaseListSort>(() =>
    parseURLSort(searchParams)
  );
  const [currentPage, setCurrentPage] = useState(() =>
    parseURLPage(searchParams)
  );
  const [pageSize, setPageSize] = useState(() => getStoredPageSize());
  const [viewMode, setViewMode] = useState<ViewMode>(() => getStoredViewMode());

  // ============================================================================
  // VIEW MODE HANDLER
  // ============================================================================

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    setStoredViewMode(mode);
  }, []);

  // ============================================================================
  // SELECTION MODE STATE
  // ============================================================================

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());

  // ============================================================================
  // IMPORT MODAL STATE
  // ============================================================================

  const [importModalOpen, setImportModalOpen] = useState(false);

  // ============================================================================
  // BULK OPERATION STATE
  // ============================================================================

  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: "delete" | "archive" | "reopen" | null;
    count: number;
  }>({
    open: false,
    type: null,
    count: 0,
  });

  // ============================================================================
  // SINGLE CASE CONFIRMATION STATE
  // ============================================================================

  const [singleCaseConfirm, setSingleCaseConfirm] = useState<{
    open: boolean;
    type: "delete" | "archive" | null;
    caseId: string | null;
    caseName: string;
  }>({
    open: false,
    type: null,
    caseId: null,
    caseName: "",
  });
  const [singleCaseLoading, setSingleCaseLoading] = useState(false);

  // ============================================================================
  // LOADING STATES
  // ============================================================================

  const { isNavigating: isAddingCase, navigateTo: navigateToAddCase } = useNavigationLoading();

  // Track initial load to prevent skeleton flash on filter changes
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ============================================================================
  // DRAG AND DROP STATE
  // ============================================================================

  // Custom order state (local reordering before save)
  const [localOrder, setLocalOrder] = useState<string[]>([]);
  const [_isDragging, setIsDragging] = useState(false);

  // Convex queries and mutations
  const customOrderData = useQuery(api.userCaseOrder.getCaseOrder);
  const saveCaseOrderMutation = useMutation(api.userCaseOrder.saveCaseOrder);
  const importCasesMutation = useMutation(api.cases.importCases);
  const bulkRemoveMutation = useMutation(api.cases.bulkRemove);
  const bulkUpdateStatusMutation = useMutation(api.cases.bulkUpdateStatus);
  const bulkUpdateCalendarSyncMutation = useMutation(api.cases.bulkUpdateCalendarSync);
  const removeMutation = useMutation(api.cases.remove);
  const updateMutation = useMutation(api.cases.update);
  const isCalendarConnected = useQuery(api.googleAuth.isGoogleCalendarConnected) ?? false;
  const convex = useConvex();

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ============================================================================
  // SYNC URL PARAMS ON MOUNT (only update if values actually changed)
  // ============================================================================

  useEffect(() => {
    const urlFilters = parseURLFilters(searchParams);
    const urlSort = parseURLSort(searchParams);
    const urlPage = parseURLPage(searchParams);

    // Only update state if values actually differ (prevents unnecessary re-renders)
    setFilters((prev) => {
      if (
        prev.status === urlFilters.status &&
        prev.progressStatus === urlFilters.progressStatus &&
        prev.searchQuery === urlFilters.searchQuery &&
        prev.favoritesOnly === urlFilters.favoritesOnly &&
        prev.duplicatesOnly === urlFilters.duplicatesOnly &&
        prev.activeOnly === urlFilters.activeOnly
      ) {
        return prev; // No change, return same reference
      }
      return urlFilters;
    });

    setSort((prev) => {
      if (prev.sortBy === urlSort.sortBy && prev.sortOrder === urlSort.sortOrder) {
        return prev;
      }
      return urlSort;
    });

    setCurrentPage((prev) => (prev === urlPage ? prev : urlPage));
  }, [searchParams]);

  // ============================================================================
  // UPDATE URL PARAMS
  // ============================================================================

  const updateURL = useCallback(
    (newFilters: CaseListFilters, newSort: CaseListSort, newPage: number) => {
      const params = new URLSearchParams();

      if (newFilters.status) params.set("status", newFilters.status);
      if (newFilters.progressStatus) params.set("progress", newFilters.progressStatus);
      if (newFilters.searchQuery) params.set("search", newFilters.searchQuery);
      if (newFilters.favoritesOnly) params.set("favorites", "true");
      if (newFilters.duplicatesOnly) params.set("duplicates", "true");
      // Only add activeOnly to URL when false (All tab) - true is the default
      if (newFilters.activeOnly === false) params.set("activeOnly", "false");
      if (newSort.sortBy !== DEFAULT_SORT.sortBy) params.set("sort", newSort.sortBy);
      if (newSort.sortOrder !== DEFAULT_SORT.sortOrder) params.set("order", newSort.sortOrder);
      if (newPage > 1) params.set("page", newPage.toString());

      const newURL = params.toString() ? `?${params.toString()}` : "/cases";
      router.push(newURL, { scroll: false });
    },
    [router]
  );

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleFiltersChange = useCallback(
    (newFilters: CaseListFilters) => {
      // Use transition to keep old content visible while loading new results
      startTransition(() => {
        setFilters(newFilters);
        setCurrentPage(1); // Reset to page 1 on filter change
        setLocalOrder([]); // Clear drag order when changing filters
        updateURL(newFilters, sort, 1);
      });
    },
    [sort, updateURL]
  );

  const handleSortChange = useCallback(
    (newSort: CaseListSort) => {
      setSort(newSort);
      setCurrentPage(1); // Reset to page 1 on sort change
      setLocalOrder([]); // Clear drag order when changing sort
      updateURL(filters, newSort, 1);
    },
    [filters, updateURL]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      updateURL(filters, sort, page);
    },
    [filters, sort, updateURL]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setStoredPageSize(size); // Persist to localStorage
      setCurrentPage(1); // Reset to page 1 on page size change
      updateURL(filters, sort, 1);
    },
    [filters, sort, updateURL]
  );

  // ============================================================================
  // DATA FETCHING (Server-side filtering, sorting, and pagination)
  // ============================================================================

  // Send all parameters to server - server handles everything
  const caseListDataRaw = useQuery(api.cases.listFiltered, {
    status: filters.status,
    progressStatus: filters.progressStatus,
    searchQuery: filters.searchQuery,
    favoritesOnly: filters.favoritesOnly,
    duplicatesOnly: filters.duplicatesOnly,
    activeOnly: filters.activeOnly,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
    page: currentPage,
    pageSize: pageSize,
  });

  // Cache the last successful result to prevent skeleton flash during re-fetches
  const [cachedCaseListData, setCachedCaseListData] = useState(caseListDataRaw);

  // Update cache when new data arrives
  useEffect(() => {
    if (caseListDataRaw !== undefined) {
      setCachedCaseListData(caseListDataRaw);
      setHasInitiallyLoaded(true);
    }
  }, [caseListDataRaw]);

  // Use cached data when query is loading (prevents skeleton flash)
  const caseListData = caseListDataRaw ?? (hasInitiallyLoaded ? cachedCaseListData : undefined);
  const isRefetching = caseListDataRaw === undefined && hasInitiallyLoaded;

  // Apply client-side ordering when user has dragged (localOrder) or using custom sort
  const processedCases = useMemo(() => {
    if (!caseListData) return [];

    const cases = [...caseListData.cases];

    // If user just dragged (localOrder set), apply that order immediately
    // This keeps the visual reorder without switching sort modes
    if (localOrder.length > 0) {
      const orderMap = new Map(localOrder.map((id, index) => [id, index]));
      cases.sort((a, b) => {
        const aIndex = orderMap.get(a._id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b._id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== Number.MAX_SAFE_INTEGER && bIndex !== Number.MAX_SAFE_INTEGER) {
          return aIndex - bIndex;
        }
        if (aIndex !== Number.MAX_SAFE_INTEGER) return -1;
        if (bIndex !== Number.MAX_SAFE_INTEGER) return 1;
        return 0; // Keep server order for items not in localOrder
      });
      return cases;
    }

    // If custom sort mode, apply saved custom order
    if (sort.sortBy === "custom" && customOrderData?.caseIds?.length) {
      const orderMap = new Map(customOrderData.caseIds.map((id, index) => [id, index]));
      cases.sort((a, b) => {
        const aIndex = orderMap.get(a._id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = orderMap.get(b._id) ?? Number.MAX_SAFE_INTEGER;
        if (aIndex !== Number.MAX_SAFE_INTEGER && bIndex !== Number.MAX_SAFE_INTEGER) {
          return aIndex - bIndex;
        }
        if (aIndex !== Number.MAX_SAFE_INTEGER) return -1;
        if (bIndex !== Number.MAX_SAFE_INTEGER) return 1;
        // Fallback for new cases not in custom order
        const baseSortBy = customOrderData.baseSortMethod || "deadline";
        const baseSortOrder = customOrderData.baseSortOrder || "asc";
        return sortCases([a, b], baseSortBy, baseSortOrder)[0] === a ? -1 : 1;
      });
      return cases;
    }

    // Otherwise, server already sorted correctly
    return cases;
  }, [caseListData, sort.sortBy, localOrder, customOrderData]);

  // Check if any selected cases are closed (enables Re-open button)
  const hasClosedCases = useMemo(() => {
    if (selectedCaseIds.size === 0) return false;
    return processedCases.some(
      (c) => selectedCaseIds.has(c._id) && c.caseStatus === "closed"
    );
  }, [selectedCaseIds, processedCases]);

  // ============================================================================
  // PAGE CONTEXT (for chat AI awareness)
  // ============================================================================

  const { setPageData } = usePageContextUpdater();

  // Update page context when visible cases or selection changes
  useEffect(() => {
    setPageData({
      visibleCaseIds: processedCases.map((c) => c._id),
      selectedCaseIds: Array.from(selectedCaseIds),
      filters: {
        status: filters.status || undefined,
        progressStatus: filters.progressStatus || undefined,
        searchText: filters.searchQuery || undefined,
        favoritesOnly: filters.favoritesOnly || undefined,
      },
      pagination: {
        page: currentPage,
        pageSize: pageSize,
        totalCount: caseListData?.pagination?.totalCount,
      },
    });
  }, [
    processedCases,
    selectedCaseIds,
    filters,
    currentPage,
    pageSize,
    caseListData?.pagination?.totalCount,
    setPageData,
  ]);

  // ============================================================================
  // DRAG HANDLERS
  // ============================================================================

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setIsDragging(false);
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      // Get current case IDs from processed cases
      const currentIds = processedCases.map((c) => c._id);
      const activeId = active.id as string;
      const overId = over.id as string;
      const oldIndex = currentIds.findIndex((id) => id === activeId);
      const newIndex = currentIds.findIndex((id) => id === overId);

      // Reorder locally - this will immediately update the display
      const newOrder = arrayMove(currentIds, oldIndex, newIndex);
      setLocalOrder(newOrder);

      // Save to Convex (auto-save) - save current sort as base for custom order
      try {
        await saveCaseOrderMutation({
          caseIds: newOrder,
          filters: {
            status: filters.status,
            progressStatus: filters.progressStatus,
            searchQuery: filters.searchQuery,
            favoritesOnly: filters.favoritesOnly,
          },
          baseSortMethod: sort.sortBy === "custom" || sort.sortBy === "favorites" ? "deadline" : sort.sortBy,
          baseSortOrder: sort.sortOrder,
        });

        // DON'T switch to custom sort - keep current view, just show reordered
        // The localOrder will override the display order
        toast.success("Order saved");
      } catch (error) {
        console.error("Failed to save custom order:", error);
        toast.error("Failed to save order");
        setLocalOrder([]); // Reset on error
      }
    },
    [
      processedCases,
      saveCaseOrderMutation,
      filters,
      sort,
    ]
  );

  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    // Clear selections when exiting selection mode
    if (selectionMode) {
      setSelectedCaseIds(new Set());
    }
  }, [selectionMode]);

  const handleSelectCase = useCallback((id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(async () => {
    try {
      // Fetch ALL case IDs matching current filters (not just current page)
      const allIds = await convex.query(api.cases.listFilteredIds, {
        status: filters.status,
        progressStatus: filters.progressStatus,
        searchQuery: filters.searchQuery,
        favoritesOnly: filters.favoritesOnly,
        duplicatesOnly: filters.duplicatesOnly,
        activeOnly: filters.activeOnly,
      });
      setSelectedCaseIds(new Set(allIds));
    } catch (error) {
      console.error("Failed to fetch all case IDs:", error);
      // Fallback to current page if query fails
      const currentPageIds = processedCases.map((c) => c._id);
      setSelectedCaseIds(new Set(currentPageIds));
      toast.error("Could not select all cases. Selected current page only.");
    }
  }, [convex, filters, processedCases]);

  const handleDeselectAll = useCallback(() => {
    setSelectedCaseIds(new Set());
  }, []);

  const handleExportCSV = useCallback(async () => {
    if (selectedCaseIds.size === 0) {
      toast.error("No cases selected for export");
      return;
    }

    setExportLoading(true);
    try {
      // Fetch full case data for selected IDs
      const ids = Array.from(selectedCaseIds) as import("../../../../convex/_generated/dataModel").Id<"cases">[];
      const fullCases = await convex.query(api.cases.listByIds, { ids });

      if (fullCases.length === 0) {
        toast.error("Failed to load case data for export");
        return;
      }

      exportFullCasesCSV(fullCases as FullCaseData[]);
      toast.success(`Exported ${fullCases.length} cases as CSV`);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      const message = error instanceof Error ? error.message : "Failed to export CSV";
      toast.error(message);
    } finally {
      setExportLoading(false);
    }
  }, [selectedCaseIds, convex]);

  const handleExportJSON = useCallback(async () => {
    if (selectedCaseIds.size === 0) {
      toast.error("No cases selected for export");
      return;
    }

    setExportLoading(true);
    try {
      // Fetch full case data for selected IDs
      const ids = Array.from(selectedCaseIds) as import("../../../../convex/_generated/dataModel").Id<"cases">[];
      const fullCases = await convex.query(api.cases.listByIds, { ids });

      if (fullCases.length === 0) {
        toast.error("Failed to load case data for export");
        return;
      }

      exportFullCasesJSON(fullCases as FullCaseData[]);
      toast.success(`Exported ${fullCases.length} cases as JSON`);
    } catch (error) {
      console.error("Failed to export JSON:", error);
      const message = error instanceof Error ? error.message : "Failed to export JSON";
      toast.error(message);
    } finally {
      setExportLoading(false);
    }
  }, [selectedCaseIds, convex]);

  const handleBulkDelete = useCallback(() => {
    setConfirmDialog({
      open: true,
      type: "delete",
      count: selectedCaseIds.size,
    });
  }, [selectedCaseIds.size]);

  const handleBulkArchive = useCallback(() => {
    setConfirmDialog({
      open: true,
      type: "archive",
      count: selectedCaseIds.size,
    });
  }, [selectedCaseIds.size]);

  const handleBulkReopen = useCallback(() => {
    setConfirmDialog({
      open: true,
      type: "reopen",
      count: selectedCaseIds.size,
    });
  }, [selectedCaseIds.size]);

  const handleBulkCalendarSync = useCallback(
    async (enable: boolean) => {
      if (selectedCaseIds.size === 0) return;

      setBulkOperationLoading(true);
      const ids = Array.from(selectedCaseIds) as import("../../../../convex/_generated/dataModel").Id<"cases">[];

      try {
        const result = await bulkUpdateCalendarSyncMutation({
          ids,
          calendarSyncEnabled: enable,
        });

        const action = enable ? "synced" : "unsynced";
        if (result.successCount > 0) {
          toast.success(
            `${result.successCount} case${result.successCount !== 1 ? "s" : ""} ${action}`
          );
        }
        if (result.failedCount > 0) {
          toast.error(
            `Failed to ${enable ? "sync" : "unsync"} ${result.failedCount} case${result.failedCount !== 1 ? "s" : ""}`
          );
        }

        // Clear selection after successful operation
        setSelectedCaseIds(new Set());
        setSelectionMode(false);
      } catch (error) {
        console.error("Bulk calendar sync failed:", error);
        toast.error(`Failed to ${enable ? "sync" : "unsync"} cases`);
      } finally {
        setBulkOperationLoading(false);
      }
    },
    [selectedCaseIds, bulkUpdateCalendarSyncMutation]
  );

  const handleConfirmBulkAction = useCallback(async () => {
    if (!confirmDialog.type) return;

    setBulkOperationLoading(true);
    const ids = Array.from(selectedCaseIds) as import("../../../../convex/_generated/dataModel").Id<"cases">[];

    try {
      if (confirmDialog.type === "delete") {
        const result = await bulkRemoveMutation({ ids });
        if (result.successCount > 0) {
          toast.success(`Deleted ${result.successCount} case${result.successCount !== 1 ? "s" : ""}`);
        }
        if (result.failedCount > 0) {
          toast.error(`Failed to delete ${result.failedCount} case${result.failedCount !== 1 ? "s" : ""}`);
        }
      } else if (confirmDialog.type === "archive") {
        const result = await bulkUpdateStatusMutation({ ids, status: "closed" });
        if (result.successCount > 0) {
          toast.success(`Archived ${result.successCount} case${result.successCount !== 1 ? "s" : ""}`);
        }
        if (result.failedCount > 0) {
          toast.error(`Failed to archive ${result.failedCount} case${result.failedCount !== 1 ? "s" : ""}`);
        }
      } else if (confirmDialog.type === "reopen") {
        // Re-open sets status back to 'pwd' (initial stage)
        const result = await bulkUpdateStatusMutation({ ids, status: "pwd" });
        if (result.successCount > 0) {
          toast.success(`Re-opened ${result.successCount} case${result.successCount !== 1 ? "s" : ""}`);
        }
        if (result.failedCount > 0) {
          toast.error(`Failed to re-open ${result.failedCount} case${result.failedCount !== 1 ? "s" : ""}`);
        }
      }

      // Clear selection and close dialog
      setSelectedCaseIds(new Set());
      setConfirmDialog({ open: false, type: null, count: 0 });
    } catch (error) {
      console.error("Bulk operation failed:", error);
      toast.error("Bulk operation failed");
    } finally {
      setBulkOperationLoading(false);
    }
  }, [confirmDialog.type, selectedCaseIds, bulkRemoveMutation, bulkUpdateStatusMutation]);

  const handleCancelConfirmDialog = useCallback(() => {
    setConfirmDialog({ open: false, type: null, count: 0 });
  }, []);

  // ============================================================================
  // SINGLE CASE DELETE/ARCHIVE HANDLERS
  // ============================================================================

  const handleSingleCaseDeleteRequest = useCallback((caseId: string, caseName: string) => {
    setSingleCaseConfirm({
      open: true,
      type: "delete",
      caseId,
      caseName,
    });
  }, []);

  const handleSingleCaseArchiveRequest = useCallback((caseId: string, caseName: string) => {
    setSingleCaseConfirm({
      open: true,
      type: "archive",
      caseId,
      caseName,
    });
  }, []);

  const handleConfirmSingleCaseAction = useCallback(async () => {
    if (!singleCaseConfirm.type || !singleCaseConfirm.caseId) return;

    setSingleCaseLoading(true);
    const caseId = singleCaseConfirm.caseId as import("../../../../convex/_generated/dataModel").Id<"cases">;

    try {
      if (singleCaseConfirm.type === "delete") {
        await removeMutation({ id: caseId });
        toast.success("Case deleted successfully");
      } else if (singleCaseConfirm.type === "archive") {
        await updateMutation({ id: caseId, caseStatus: "closed" });
        toast.success("Case archived successfully");
      }

      // Close dialog
      setSingleCaseConfirm({ open: false, type: null, caseId: null, caseName: "" });
    } catch (error) {
      console.error("Single case operation failed:", error);
      toast.error(
        singleCaseConfirm.type === "delete"
          ? "Failed to delete case. Please try again."
          : "Failed to archive case. Please try again."
      );
    } finally {
      setSingleCaseLoading(false);
    }
  }, [singleCaseConfirm, removeMutation, updateMutation]);

  const handleCancelSingleCaseConfirm = useCallback(() => {
    setSingleCaseConfirm({ open: false, type: null, caseId: null, caseName: "" });
  }, []);

  const handleAddCase = useCallback(() => {
    navigateToAddCase("/cases/new");
  }, [navigateToAddCase]);

  // Check for duplicates before import
  const handleCheckDuplicates = useCallback(
    async (cases: Array<{ employerName: string; beneficiaryIdentifier: string }>) => {
      const result = await convex.query(api.cases.checkDuplicates, { cases });
      return result;
    },
    [convex]
  );

  const handleImport = useCallback(
    async (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cases: Record<string, any>[],
      resolutions?: Record<string, "skip" | "replace">
    ) => {
      try {
        // Pass through ALL fields from the parsed import data
        // The import parser already normalizes field names to camelCase
        const casesToImport = cases.map((c) => {
          // Extract required fields
          const employerName = c.employerName as string;
          const beneficiaryIdentifier = c.beneficiaryIdentifier as string;

          // Handle dates that may be in a nested 'dates' object OR at top level
          const dates = c.dates as Record<string, string> | undefined;

          return {
            // Required fields
            employerName,
            beneficiaryIdentifier,
            // Core fields
            positionTitle: c.positionTitle as string | undefined,
            caseStatus: c.caseStatus as "pwd" | "recruitment" | "eta9089" | "i140" | "closed" | undefined,
            progressStatus: c.progressStatus as "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe" | undefined,
            priorityLevel: c.priorityLevel as "low" | "normal" | "high" | "urgent" | undefined,
            isFavorite: c.isFavorite as boolean | undefined,
            isPinned: c.isPinned as boolean | undefined,
            isProfessionalOccupation: c.isProfessionalOccupation as boolean | undefined,
            calendarSyncEnabled: c.calendarSyncEnabled as boolean | undefined,
            showOnTimeline: c.showOnTimeline as boolean | undefined,
            // PWD dates
            pwdFilingDate: dates?.pwdFiled ?? c.pwdFilingDate,
            pwdDeterminationDate: dates?.pwdDetermined ?? c.pwdDeterminationDate,
            pwdExpirationDate: dates?.pwdExpires ?? c.pwdExpirationDate,
            pwdCaseNumber: c.pwdCaseNumber,
            // Recruitment - Job Order
            jobOrderStartDate: dates?.recruitmentStart ?? c.jobOrderStartDate,
            jobOrderEndDate: dates?.recruitmentEnd ?? c.jobOrderEndDate,
            jobOrderState: c.jobOrderState,
            // Recruitment - Sunday Ads
            sundayAdFirstDate: c.sundayAdFirstDate,
            sundayAdSecondDate: c.sundayAdSecondDate,
            sundayAdNewspaper: c.sundayAdNewspaper,
            // Recruitment - Notice of Filing
            noticeOfFilingStartDate: c.noticeOfFilingStartDate,
            noticeOfFilingEndDate: c.noticeOfFilingEndDate,
            // Recruitment - Additional Methods
            additionalRecruitmentStartDate: c.additionalRecruitmentStartDate,
            additionalRecruitmentEndDate: c.additionalRecruitmentEndDate,
            additionalRecruitmentMethods: c.additionalRecruitmentMethods,
            recruitmentApplicantsCount: c.recruitmentApplicantsCount,
            recruitmentSummaryCustom: c.recruitmentSummaryCustom,
            // ETA 9089
            eta9089FilingDate: dates?.etaFiled ?? c.eta9089FilingDate,
            eta9089CertificationDate: dates?.etaCertified ?? c.eta9089CertificationDate,
            eta9089ExpirationDate: dates?.etaExpires ?? c.eta9089ExpirationDate,
            eta9089CaseNumber: c.eta9089CaseNumber,
            // I-140
            i140FilingDate: dates?.i140Filed ?? c.i140FilingDate,
            i140ReceiptDate: c.i140ReceiptDate,
            i140ReceiptNumber: c.i140ReceiptNumber,
            i140ApprovalDate: dates?.i140Approved ?? c.i140ApprovalDate,
            i140DenialDate: c.i140DenialDate,
            // RFI/RFE arrays
            rfiEntries: c.rfiEntries,
            rfeEntries: c.rfeEntries,
            // Notes
            notes: c.notes,
            // Text fields
            caseNumber: c.caseNumber,
            internalCaseNumber: c.internalCaseNumber,
            employerFein: c.employerFein,
            jobTitle: c.jobTitle,
            socCode: c.socCode,
            socTitle: c.socTitle,
          };
        });

        const result = await importCasesMutation({ cases: casesToImport, resolutions });

        // Build success message
        const parts: string[] = [];
        if (result.importedCount > 0) {
          parts.push(`${result.importedCount} imported`);
        }
        if (result.replacedCount > 0) {
          parts.push(`${result.replacedCount} replaced`);
        }
        if (result.skippedCount > 0) {
          parts.push(`${result.skippedCount} skipped`);
        }

        // Show toast without validation warning count (modal will handle that)
        toast.success(`Import complete: ${parts.join(", ")}`);

        // Return result so ImportModal can display validation warnings
        return {
          importedCount: result.importedCount,
          replacedCount: result.replacedCount,
          skippedCount: result.skippedCount,
          validationWarnings: result.validationWarnings,
        };
      } catch (error) {
        console.error("Import failed:", error);
        toast.error("Failed to import cases");
        throw error;
      }
    },
    [importCasesMutation]
  );

  // ============================================================================
  // PAGINATION (from server response)
  // ============================================================================

  const totalCount = caseListData?.pagination.totalCount ?? 0;
  const totalPages = caseListData?.pagination.totalPages ?? 1;
  // Server already paginated - processedCases IS the current page
  const paginatedCases = processedCases;

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (caseListData === undefined) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div
          className="flex items-center justify-between animate-in fade-in fill-mode-forwards"
          style={{ animationDuration: "0.2s" }}
        >
          <div>
            <Skeleton variant="line" className="w-32 h-10 mb-2" />
            <Skeleton variant="line" className="w-48 h-6" />
          </div>
          <Skeleton variant="block" className="w-32 h-10" />
        </div>

        {/* Filter Bar Skeleton */}
        <div
          className="animate-in fade-in slide-in-from-bottom-2 fill-mode-forwards"
          style={{ animationDelay: "50ms", animationDuration: "0.3s" }}
        >
          <Skeleton variant="block" className="h-40" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards"
              style={{
                animationDelay: `${100 + i * 50}ms`,
                animationDuration: "0.3s",
              }}
            >
              <Skeleton variant="block" className="h-64 mt-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // EMPTY STATES
  // ============================================================================

  // No cases at all (new user) - check if no filters are set and no results
  const hasNoFilters = !filters.status && !filters.progressStatus && !filters.searchQuery && !filters.favoritesOnly && !filters.duplicatesOnly;
  if (caseListData.cases.length === 0 && hasNoFilters) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold">Cases</h1>
            <p className="text-muted-foreground mt-1">0 total cases</p>
          </div>
          <Button
            onClick={handleAddCase}
            loading={isAddingCase}
            loadingText="Adding..."
          >
            <Plus className="size-4 mr-2" />
            Add Case
          </Button>
        </div>

        <CaseListEmptyState
          type="new-user"
          onAddCase={handleAddCase}
        />
      </div>
    );
  }

  // No cases match filters
  if (processedCases.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold">Cases</h1>
            <p className="text-muted-foreground mt-1">
              No cases match your filters
            </p>
          </div>
          <Button
            onClick={handleAddCase}
            loading={isAddingCase}
            loadingText="Adding..."
          >
            <Plus className="size-4 mr-2" />
            Add Case
          </Button>
        </div>

        {/* Filter Bar */}
        <CaseFilterBar
          filters={filters}
          sort={sort}
          onFiltersChange={handleFiltersChange}
          onSortChange={handleSortChange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />

        <CaseListEmptyState
          type="no-results"
          onClearFilters={() => {
            setFilters({});
            setSort(DEFAULT_SORT);
            setCurrentPage(1);
            updateURL({}, DEFAULT_SORT, 1);
          }}
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div data-tour="cases-list" className="space-y-6">
      {/* Page Header - responsive: stacks on mobile, horizontal on desktop */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold">Cases</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount} {totalCount === 1 ? "case" : "cases"}
            </p>
          </div>
          <ViewToggle view={viewMode} onChange={handleViewModeChange} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="default"
            onClick={handleToggleSelectionMode}
            aria-label={selectionMode ? "Exit selection mode" : "Enter selection mode"}
          >
            <CheckSquare className="size-5 mr-2" />
            {selectionMode ? "Exit Selection" : "Select Cases"}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => setImportModalOpen(true)}
            aria-label="Import cases from JSON"
          >
            <Upload className="size-5 mr-2" />
            Import
          </Button>
          <Button
            size="lg"
            onClick={handleAddCase}
            loading={isAddingCase}
            loadingText="Adding..."
          >
            <Plus className="size-5 mr-2" />
            Add Case
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <CaseFilterBar
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* Case Cards/List View */}
      <div
        className="transition-opacity duration-200"
        style={{ opacity: isRefetching || isPending ? 0.6 : 1 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {viewMode === "card" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={paginatedCases.map((c) => c._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedCases.map((caseData, index) => (
                      <SortableCaseCard
                        key={caseData._id}
                        case={caseData}
                        index={index}
                        selectionMode={selectionMode}
                        isSelected={selectedCaseIds.has(caseData._id)}
                        onSelect={handleSelectCase}
                        onDeleteRequest={handleSingleCaseDeleteRequest}
                        onArchiveRequest={handleSingleCaseArchiveRequest}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <CaseListView
                cases={paginatedCases}
                sortBy={sort.sortBy}
                selectionMode={selectionMode}
                selectedCaseIds={selectedCaseIds}
                onSelect={handleSelectCase}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <CasePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Selection Bar (fixed at bottom) */}
      {selectionMode && (
        <SelectionBar
          selectedCount={selectedCaseIds.size}
          totalCount={totalCount}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onBulkDelete={handleBulkDelete}
          onBulkArchive={handleBulkArchive}
          onBulkReopen={handleBulkReopen}
          onCancel={handleToggleSelectionMode}
          hasClosedCases={hasClosedCases}
          isLoading={bulkOperationLoading || exportLoading}
          onBulkCalendarSync={handleBulkCalendarSync}
          isCalendarConnected={isCalendarConnected}
        />
      )}

      {/* Import Modal */}
      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onImport={handleImport}
        checkDuplicates={handleCheckDuplicates}
      />

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && handleCancelConfirmDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`size-5 ${confirmDialog.type === "delete" ? "text-destructive" : "text-primary"}`} />
              {confirmDialog.type === "delete" && "Delete Cases"}
              {confirmDialog.type === "archive" && "Archive Cases"}
              {confirmDialog.type === "reopen" && "Re-open Cases"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === "delete" && (
                <>
                  Are you sure you want to delete {confirmDialog.count} case{confirmDialog.count !== 1 ? "s" : ""}?
                  This action can be undone by an administrator.
                </>
              )}
              {confirmDialog.type === "archive" && (
                <>
                  Are you sure you want to archive {confirmDialog.count} case{confirmDialog.count !== 1 ? "s" : ""}?
                  Archived cases can be re-opened later.
                </>
              )}
              {confirmDialog.type === "reopen" && (
                <>
                  Are you sure you want to re-open {confirmDialog.count} case{confirmDialog.count !== 1 ? "s" : ""}?
                  Cases will be set back to PWD stage.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelConfirmDialog}
              disabled={bulkOperationLoading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmDialog.type === "delete" ? "destructive" : "default"}
              onClick={handleConfirmBulkAction}
              loading={bulkOperationLoading}
              loadingText={
                confirmDialog.type === "delete" ? "Deleting..." :
                confirmDialog.type === "archive" ? "Archiving..." : "Re-opening..."
              }
            >
              {confirmDialog.type === "delete" && "Delete"}
              {confirmDialog.type === "archive" && "Archive"}
              {confirmDialog.type === "reopen" && "Re-open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Case Confirmation Dialog */}
      <Dialog open={singleCaseConfirm.open} onOpenChange={(open) => !open && handleCancelSingleCaseConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={`size-5 ${singleCaseConfirm.type === "delete" ? "text-destructive" : "text-primary"}`} />
              {singleCaseConfirm.type === "delete" ? "Delete Case" : "Archive Case"}
            </DialogTitle>
            <DialogDescription>
              {singleCaseConfirm.type === "delete" ? (
                <>
                  Are you sure you want to delete &quot;{singleCaseConfirm.caseName}&quot;?
                  This action can be undone by an administrator.
                </>
              ) : (
                <>
                  Are you sure you want to archive &quot;{singleCaseConfirm.caseName}&quot;?
                  Archived cases can be re-opened later.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelSingleCaseConfirm}
              disabled={singleCaseLoading}
            >
              Cancel
            </Button>
            <Button
              variant={singleCaseConfirm.type === "delete" ? "destructive" : "default"}
              onClick={handleConfirmSingleCaseAction}
              loading={singleCaseLoading}
              loadingText={singleCaseConfirm.type === "delete" ? "Deleting..." : "Archiving..."}
            >
              {singleCaseConfirm.type === "delete" ? "Delete" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
