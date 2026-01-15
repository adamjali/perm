
"use client";

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TimelineGrid } from "@/components/timeline/TimelineGrid";
import { TimelineControls } from "@/components/timeline/TimelineControls";
import { TimelineLegend } from "@/components/timeline/TimelineLegend";
import { CaseSelectionModal, type CaseForSelection } from "@/components/timeline/CaseSelectionModal";

export function TimelinePageClient() {
  const router = useRouter();

  // State for case selector modal
  const [caseSelectorOpen, setCaseSelectorOpen] = useState(false);

  // State for single case filter (preview mode)
  const [filteredCaseId, setFilteredCaseId] = useState<string | null>(null);

  // State for zoom level (50-200%, default 100)
  const [zoomLevel, setZoomLevel] = useState(100);

  // Query preferences and cases
  const preferences = useQuery(api.timeline.getPreferences);
  const timeRange = preferences?.timeRange ?? 6;
  const cases = useQuery(api.timeline.getCasesForTimeline, { timeRange });

  // Query ALL cases for the selection modal (unfiltered)
  const allCasesRaw = useQuery(api.cases.list, {});

  // Mutation to update preferences
  const updatePreferences = useMutation(api.timeline.updatePreferences);

  // Transform raw cases to CaseForSelection format
  const allCasesForSelection: CaseForSelection[] = useMemo(() => {
    if (!allCasesRaw) return [];
    return allCasesRaw.map((c) => ({
      _id: c._id,
      employerName: c.employerName,
      positionTitle: c.positionTitle,
      caseStatus: c.caseStatus,
      progressStatus: c.progressStatus,
      createdAt: c.createdAt,
    }));
  }, [allCasesRaw]);

  // Get selected IDs from preferences (or all active if undefined/null)
  const selectedIds: Set<string> = useMemo(() => {
    if (!preferences) return new Set<string>();
    if (preferences.selectedCaseIds === null || preferences.selectedCaseIds === undefined) {
      // null/undefined means "all active cases" - return IDs of all non-closed cases
      return new Set(
        allCasesForSelection
          .filter((c) => c.caseStatus !== "closed")
          .map((c) => c._id)
      );
    }
    // Explicit selection
    return new Set(preferences.selectedCaseIds.map((id) => String(id)));
  }, [preferences, allCasesForSelection]);

  // Handle time range change
  const handleTimeRangeChange = useCallback(
    async (newTimeRange: 3 | 6 | 12 | 24) => {
      await updatePreferences({ timeRange: newTimeRange });
    },
    [updatePreferences]
  );

  // Handle opening case selector
  const openCaseSelector = useCallback(() => {
    setCaseSelectorOpen(true);
  }, []);

  // Handle closing case selector
  const closeCaseSelector = useCallback(() => {
    setCaseSelectorOpen(false);
  }, []);

  // Handle saving case selection
  const handleSaveSelection = useCallback(
    async (newSelectedIds: string[]) => {
      // If all active cases are selected, save as undefined (null) to mean "all"
      const activeCaseIds = allCasesForSelection
        .filter((c) => c.caseStatus !== "closed")
        .map((c) => c._id);

      const isAllActiveSelected =
        newSelectedIds.length === activeCaseIds.length &&
        activeCaseIds.every((id) => newSelectedIds.includes(id));

      // Empty array or all active cases selected = save as null (show all active)
      if (newSelectedIds.length === 0 || isAllActiveSelected) {
        await updatePreferences({ selectedCaseIds: null });
      } else {
        await updatePreferences({
          selectedCaseIds: newSelectedIds as Id<"cases">[],
        });
      }
      setCaseSelectorOpen(false);
    },
    [updatePreferences, allCasesForSelection]
  );

  // Calculate whether there's an explicit selection (not "all active")
  const hasActiveSelection = useMemo(() => {
    if (!preferences) return false;
    // If selectedCaseIds is null or undefined, it means "all active" = no active filter
    // If it's an array, there's an explicit selection
    return (
      preferences.selectedCaseIds !== null &&
      preferences.selectedCaseIds !== undefined &&
      preferences.selectedCaseIds.length > 0
    );
  }, [preferences]);

  // Total available case count for selection (all non-closed cases)
  const totalCaseCount = useMemo(() => {
    return allCasesForSelection.filter((c) => c.caseStatus !== "closed").length;
  }, [allCasesForSelection]);

  // Filter cases to single case if in preview mode
  const displayedCases = useMemo(() => {
    if (!cases) return [];
    if (filteredCaseId) {
      return cases.filter((c) => c.id === filteredCaseId);
    }
    return cases;
  }, [cases, filteredCaseId]);

  // Handle clicking on case name (navigate to detail)
  const handleCaseNameClick = useCallback(
    (caseId: string) => {
      router.push(`/cases/${caseId}`);
    },
    [router]
  );

  // Handle clicking on row (filter to single case)
  const handleRowClick = useCallback((caseId: string) => {
    setFilteredCaseId(caseId);
  }, []);

  // Handle clearing the filter (back to all cases)
  const handleClearFilter = useCallback(() => {
    setFilteredCaseId(null);
  }, []);

  // Handle zoom level change
  const handleZoomChange = useCallback((newZoom: number) => {
    setZoomLevel(newZoom);
  }, []);

  // Calculate effective time range based on zoom
  // 100% = base time range, 50% = double time span, 200% = half time span
  const effectiveTimeRange = useMemo(() => {
    // Base time range in months
    const baseRange = timeRange;
    // Adjust based on zoom: zoom 200% = half the months visible (more detail)
    // zoom 50% = double the months visible (more overview)
    const adjustedRange = Math.round(baseRange * (100 / zoomLevel));
    // Clamp to reasonable bounds (1-48 months)
    return Math.max(1, Math.min(48, adjustedRange));
  }, [timeRange, zoomLevel]);

  // Calculate row height based on case count
  // Min: 48px, Max: 80px
  const rowHeight = useMemo(() => {
    const count = displayedCases.length;
    if (count <= 3) return 80; // Few cases, expand rows
    if (count <= 6) return 64; // Medium count
    if (count <= 10) return 56; // More cases
    return 48; // Many cases, compress rows
  }, [displayedCases.length]);

  // Redirect to login if not authenticated
  if (preferences === null) {
    router.push("/login");
    return null;
  }

  // Loading state
  if (preferences === undefined || cases === undefined) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton variant="line" className="w-32 h-10 mb-2" />
            <Skeleton variant="line" className="w-48 h-6" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton variant="block" className="w-32 h-10" />
            <Skeleton variant="block" className="w-32 h-10" />
          </div>
        </div>

        {/* Grid Skeleton */}
        <Skeleton variant="block" className="h-[400px]" />

        {/* Legend Skeleton */}
        <Skeleton variant="block" className="h-16" />
      </div>
    );
  }

  // Empty state
  if (cases.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold">Timeline</h1>
            <p className="text-muted-foreground mt-1">
              Visualize your case progress
            </p>
          </div>
          <TimelineControls
            timeRange={timeRange}
            onTimeRangeChange={handleTimeRangeChange}
            onOpenCaseSelector={openCaseSelector}
            caseCount={0}
            totalCaseCount={totalCaseCount}
            hasActiveSelection={hasActiveSelection}
          />
        </div>

        {/* Empty state message */}
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed border-border rounded-lg bg-muted/20">
          <div className="text-center max-w-md">
            <h2 className="font-heading text-xl font-semibold mb-2">
              No Cases to Display
            </h2>
            <p className="text-muted-foreground mb-4">
              Add cases to see them visualized on the timeline. Each case will
              show its stages and milestones across time.
            </p>
            <button
              onClick={() => router.push("/cases/new")}
              className="inline-flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-md shadow-brutal-sm hover:shadow-brutal-hover transition-shadow"
            >
              Add Your First Case
            </button>
          </div>
        </div>

        {/* Legend */}
        <TimelineLegend />

        {/* Case Selection Modal */}
        <CaseSelectionModal
          isOpen={caseSelectorOpen}
          onClose={closeCaseSelector}
          allCases={allCasesForSelection}
          selectedIds={selectedIds}
          onSelectionChange={handleSaveSelection}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with controls - TimelineControls handles responsive layout */}
      <div className="mb-4 sm:mb-6">
        <TimelineControls
          timeRange={timeRange}
          onTimeRangeChange={handleTimeRangeChange}
          onOpenCaseSelector={openCaseSelector}
          caseCount={cases.length}
          totalCaseCount={totalCaseCount}
          hasActiveSelection={hasActiveSelection}
          zoomLevel={zoomLevel}
          onZoomChange={handleZoomChange}
        />
        <div className="flex items-center gap-3 mt-2">
          {/* Back to All Cases button (shown when filtered to single case) */}
          {filteredCaseId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilter}
              className="border-2 border-border shadow-hard hover:shadow-hard-lg transition-all"
              data-testid="back-to-all-cases"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to All Cases
            </Button>
          )}
          <p className="text-muted-foreground text-sm">
            {filteredCaseId
              ? `Viewing 1 of ${cases.length} cases`
              : `${cases.length} ${cases.length === 1 ? "case" : "cases"} displayed`}
          </p>
        </div>
      </div>

      {/* Main timeline grid */}
      <div className="flex-1 overflow-auto min-h-[400px] border-2 border-border rounded-lg bg-card">
        <TimelineGrid
          cases={displayedCases}
          timeRange={effectiveTimeRange}
          rowHeight={rowHeight}
          onCaseNameClick={handleCaseNameClick}
          onRowClick={handleRowClick}
        />
      </div>

      {/* Legend */}
      <div className="mt-6">
        <TimelineLegend />
      </div>

      {/* Case Selection Modal */}
      <CaseSelectionModal
        isOpen={caseSelectorOpen}
        onClose={closeCaseSelector}
        allCases={allCasesForSelection}
        selectedIds={selectedIds}
        onSelectionChange={handleSaveSelection}
      />
    </div>
  );
}
