/**
 * ImportModal Component
 * Modal dialog for importing cases from JSON files.
 *
 * Features:
 * - Drag & drop file upload
 * - JSON file validation
 * - Preview table with inline editing
 * - Validation error highlighting
 * - Auto-detect format (v2, v1, perm-tracker-new, Firebase)
 * - Legacy format detection and conversion warning
 * - Missing beneficiary notification with count
 * - Expandable conversion notes
 * - Duplicate detection with resolution UI
 * - Import button with loading state
 */

"use client";

import { useState, useCallback } from "react";
import {
  Upload,
  AlertCircle,
  InfoIcon,
  AlertTriangle,
  UserX,
  ChevronDown,
  ChevronUp,
  X,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseCaseImportFile, type ImportResult as ParseResult, BENEFICIARY_PLACEHOLDER } from "@/lib/import";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";
import { cn } from "@/lib/utils";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { toast } from "@/lib/toast";

// ============================================================================
// TYPES
// ============================================================================

interface Duplicate {
  index: number;
  employerName: string;
  beneficiaryIdentifier: string;
  existingCaseId: string;
}

type Resolution = "skip" | "replace";

// Validation warning returned from import mutation
interface ImportValidationWarning {
  caseIndex: number;
  employerName: string;
  beneficiaryIdentifier: string;
  errors: Array<{ ruleId: string; message: string }>;
}

// Result returned from import mutation
interface ImportResult {
  importedCount: number;
  replacedCount: number;
  skippedCount: number;
  validationWarnings: ImportValidationWarning[];
}

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (
    cases: Partial<CaseCardData>[],
    resolutions?: Record<string, Resolution>
  ) => Promise<ImportResult>;
  checkDuplicates?: (
    cases: Array<{ employerName: string; beneficiaryIdentifier: string }>
  ) => Promise<{ duplicates: Duplicate[] }>;
}

// Valid status options for editing
const CASE_STATUS_OPTIONS = [
  { value: "pwd", label: "PWD" },
  { value: "recruitment", label: "Recruitment" },
  { value: "eta_9089", label: "ETA 9089" },
  { value: "i140", label: "I-140" },
  { value: "complete", label: "Complete" },
  { value: "closed", label: "Closed" },
];

const PROGRESS_STATUS_OPTIONS = [
  { value: "working", label: "Working" },
  { value: "waiting_intake", label: "Waiting Intake" },
  { value: "filed", label: "Filed" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ImportModal({
  open,
  onOpenChange,
  onImport,
  checkDuplicates,
}: ImportModalProps) {
  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Duplicate resolution state
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [showDuplicateStep, setShowDuplicateStep] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Post-import validation warnings state
  const [showSuccessStep, setShowSuccessStep] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportResult | null>(null);

  // Expandable warnings state
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  // Cases display state
  const [showAllCases, setShowAllCases] = useState(false);

  // Inline editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingCase, setEditingCase] = useState<Partial<CaseCardData> | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ============================================================================
  // FILE HANDLERS
  // ============================================================================

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.endsWith(".json")) {
      return;
    }

    setIsParsing(true);
    setDuplicates([]);
    setResolutions({});
    setShowDuplicateStep(false);
    setShowAllWarnings(false);
    setShowAllCases(false);
    setEditingIndex(null);
    setEditingCase(null);

    try {
      const result = await parseCaseImportFile(file);
      setParseResult(result);
    } catch (error) {
      console.error("[ImportModal] Failed to parse file:", error);
      const message = error instanceof Error ? error.message : "Unknown error parsing file";
      toast.error(`Failed to parse file: ${message}`);
      setParseResult(null);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ============================================================================
  // INLINE EDITING HANDLERS
  // ============================================================================

  const handleStartEdit = useCallback(
    (index: number) => {
      if (!parseResult) return;
      const caseData = parseResult.valid[index];
      if (!caseData) return;
      setEditingIndex(index);
      setEditingCase({ ...caseData });
    },
    [parseResult]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingCase(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingIndex === null || !editingCase || !parseResult) return;

    setIsSavingEdit(true);

    // Simulate a brief delay for UX feedback
    setTimeout(() => {
      // Update the case in the import result
      const updatedValid = [...parseResult.valid];
      updatedValid[editingIndex] = editingCase as Partial<CaseCardData>;

      setParseResult({
        ...parseResult,
        valid: updatedValid,
        // Recalculate casesNeedingBeneficiary
        casesNeedingBeneficiary: updatedValid.filter(
          (c) => c.beneficiaryIdentifier === BENEFICIARY_PLACEHOLDER
        ).length,
      });

      setEditingIndex(null);
      setEditingCase(null);
      setIsSavingEdit(false);

      toast.success("Case updated");
    }, 300);
  }, [editingIndex, editingCase, parseResult]);

  const handleEditFieldChange = useCallback(
    (field: keyof Partial<CaseCardData>, value: string) => {
      if (!editingCase) return;
      setEditingCase((prev) => (prev ? { ...prev, [field]: value } : null));
    },
    [editingCase]
  );

  // ============================================================================
  // DUPLICATE RESOLUTION HANDLERS
  // ============================================================================

  const handleResolutionChange = useCallback(
    (index: number, resolution: Resolution) => {
      setResolutions((prev) => ({
        ...prev,
        [String(index)]: resolution,
      }));
    },
    []
  );

  const handleApplyToAll = useCallback(
    (resolution: Resolution) => {
      const newResolutions: Record<string, Resolution> = {};
      for (const dup of duplicates) {
        newResolutions[String(dup.index)] = resolution;
      }
      setResolutions(newResolutions);
    },
    [duplicates]
  );

  // ============================================================================
  // IMPORT HANDLERS
  // ============================================================================

  const handleCheckDuplicatesAndImport = async () => {
    if (!parseResult || parseResult.errors.length > 0) {
      return;
    }

    // Check for duplicates if function is provided
    if (checkDuplicates) {
      setIsCheckingDuplicates(true);
      try {
        const casesToCheck = parseResult.valid.map((c) => ({
          employerName: c.employerName!,
          beneficiaryIdentifier: c.beneficiaryIdentifier!,
        }));
        const result = await checkDuplicates(casesToCheck);

        if (result.duplicates.length > 0) {
          setDuplicates(result.duplicates);
          // Set default resolution to "skip" for all duplicates
          const defaultResolutions: Record<string, Resolution> = {};
          for (const dup of result.duplicates) {
            defaultResolutions[String(dup.index)] = "skip";
          }
          setResolutions(defaultResolutions);
          setShowDuplicateStep(true);
          return;
        }
      } finally {
        setIsCheckingDuplicates(false);
      }
    }

    // No duplicates, proceed with import
    await handleFinalImport();
  };

  const handleFinalImport = async () => {
    if (!parseResult) return;

    setIsImporting(true);
    try {
      const result = await onImport(parseResult.valid, resolutions);

      // If there are validation warnings, show success step to display them
      if (result.validationWarnings && result.validationWarnings.length > 0) {
        setImportSummary(result);
        setShowDuplicateStep(false);
        setShowSuccessStep(true);
      } else {
        // No warnings, close immediately
        handleCancel();
      }
    } catch (error) {
      console.error("[ImportModal] Import failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error occurred";
      toast.error(`Import failed: ${message}. Please try again.`);
      // Keep modal open for retry - do NOT call handleCancel()
    } finally {
      setIsImporting(false);
    }
  };

  const handleBackToPreview = useCallback(() => {
    setShowDuplicateStep(false);
    setDuplicates([]);
    setResolutions({});
  }, []);

  const resetState = useCallback(() => {
    setParseResult(null);
    setDuplicates([]);
    setResolutions({});
    setShowDuplicateStep(false);
    setShowSuccessStep(false);
    setImportSummary(null);
    setShowAllWarnings(false);
    setShowAllCases(false);
    setEditingIndex(null);
    setEditingCase(null);
  }, []);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  // Handle modal close from any source (clicking outside, escape key, etc.)
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange(newOpen);
      if (!newOpen) {
        resetState();
      }
    },
    [onOpenChange, resetState]
  );

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getFormatBadge = () => {
    if (!parseResult) return null;
    const formatLabels: Record<string, { label: string; color: string }> = {
      v2: {
        label: "v2",
        color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      },
      v1: {
        label: "v1 (Legacy)",
        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      },
      "perm-tracker-new": {
        label: "Firebase",
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      },
      "firebase-object": {
        label: "Firebase (Object)",
        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      },
      unknown: {
        label: "Unknown",
        color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      },
    };
    const format = formatLabels[parseResult.detectedFormat] ?? formatLabels.unknown;
    return (
      <span
        className={cn("px-2 py-1 text-xs font-medium rounded", format?.color ?? "bg-gray-100 text-gray-800")}
      >
        {format?.label ?? "Unknown"}
      </span>
    );
  };

  const getRowError = (rowIndex: number) => {
    return parseResult?.errors.find((err) => err.row === rowIndex);
  };

  const getResolutionSummary = () => {
    let skipCount = 0;
    let replaceCount = 0;
    for (const resolution of Object.values(resolutions)) {
      if (resolution === "skip") skipCount++;
      else if (resolution === "replace") replaceCount++;
    }
    return { skipCount, replaceCount };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {showSuccessStep
              ? "Import Complete"
              : showDuplicateStep
                ? "Resolve Duplicates"
                : "Import Cases"}
          </DialogTitle>
          <DialogDescription>
            {showSuccessStep
              ? "Your cases have been imported. Review any validation warnings below."
              : showDuplicateStep
                ? "Choose how to handle duplicate cases found in your import."
                : "Upload a JSON file to import cases into your database."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* STEP 1: File Upload & Preview */}
          {!showDuplicateStep && !showSuccessStep && (
            <>
              {/* File Dropzone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-none p-8 text-center transition-all duration-200",
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30",
                  isParsing && "opacity-70 pointer-events-none"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    // Reset input so same file can be re-selected
                    e.target.value = "";
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Select file"
                  disabled={isParsing}
                />

                {isParsing ? (
                  <div className="py-4">
                    <Loader2 className="mx-auto h-12 w-12 mb-4 text-primary animate-spin" />
                    <p className="text-lg font-medium mb-2">Parsing file...</p>
                    <p className="text-sm text-muted-foreground">Validating case data</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">Drag & drop your JSON file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">Accepts .json files only</p>
                  </>
                )}
              </div>

              {/* Format Detection & Warnings */}
              {parseResult && (
                <div className="space-y-3">
                  {/* Format Detection Badge */}
                  <div className="flex items-center gap-3 p-3 border-2 border-border bg-muted/30">
                    <span className="text-sm font-medium text-muted-foreground">Detected Format:</span>
                    {getFormatBadge()}
                    {parseResult.isLegacyFormat && (
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        (auto-converted to v2)
                      </span>
                    )}
                  </div>

                  {/* Legacy Format Warning */}
                  {parseResult.isLegacyFormat && (
                    <div className="flex items-start gap-3 p-4 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                      <InfoIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-900 dark:text-amber-100">
                          Legacy Format Detected
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                          This file appears to be from an older version. Field names will be
                          automatically converted to the new format.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Beneficiary Warning Banner */}
                  {parseResult.casesNeedingBeneficiary > 0 && (
                    <div className="flex items-start gap-3 p-4 border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
                      <UserX className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-orange-900 dark:text-orange-100">
                          {parseResult.casesNeedingBeneficiary} Case
                          {parseResult.casesNeedingBeneficiary !== 1 ? "s" : ""} Need Beneficiary Info
                        </p>
                        <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                          These cases were imported from a legacy format without beneficiary identifiers. They
                          have been marked with{" "}
                          <code className="bg-orange-200 dark:bg-orange-800/50 px-1 rounded font-mono text-xs">
                            {BENEFICIARY_PLACEHOLDER}
                          </code>{" "}
                          and will need manual updates after import.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Conversion Warnings (Status mappings, etc.) */}
                  {parseResult.warnings.length > 0 && (
                    <div className="border-2 border-border">
                      {/* Header - always clickable */}
                      <div
                        className={cn(
                          "flex items-center justify-between p-3 bg-muted/50",
                          "cursor-pointer select-none",
                          "hover:bg-muted transition-colors duration-150"
                        )}
                        onClick={() => setShowAllWarnings(!showAllWarnings)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setShowAllWarnings(!showAllWarnings);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <InfoIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {parseResult.warnings.length} Conversion Note
                            {parseResult.warnings.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="text-xs">{showAllWarnings ? "Collapse" : "Expand"}</span>
                          {showAllWarnings ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>

                      {/* Preview when collapsed - shows first 3 items */}
                      {!showAllWarnings && (
                        <div className="border-t border-border p-3 space-y-2">
                          {parseResult.warnings.slice(0, 3).map((warning, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "flex items-start gap-2 p-2 rounded text-xs",
                                "bg-muted/30"
                              )}
                            >
                              <span className="text-muted-foreground/60 font-mono shrink-0 min-w-[80px]">
                                {warning.employerName
                                  ? `"${warning.employerName.slice(0, 12)}${warning.employerName.length > 12 ? "…" : ""}"`
                                  : `Row ${warning.row + 1}`}
                                :
                              </span>
                              <span className="text-foreground">{warning.message}</span>
                            </div>
                          ))}
                          {parseResult.warnings.length > 3 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAllWarnings(true);
                              }}
                              className={cn(
                                "w-full py-2 text-xs font-medium rounded",
                                "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                                "transition-colors duration-150",
                                "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                              )}
                            >
                              + {parseResult.warnings.length - 3} more note
                              {parseResult.warnings.length - 3 !== 1 ? "s" : ""}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expanded view - scrollable */}
                      {showAllWarnings && (
                        <div className="border-t border-border p-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                          <ul className="space-y-2">
                            {parseResult.warnings.map((warning, idx) => (
                              <li
                                key={idx}
                                className={cn(
                                  "flex items-start gap-2 p-2 rounded text-xs",
                                  "bg-muted/30 hover:bg-muted/60 transition-colors duration-150"
                                )}
                              >
                                <span className="text-muted-foreground/60 font-mono shrink-0 min-w-[80px]">
                                  {warning.employerName
                                    ? `"${warning.employerName.slice(0, 12)}${warning.employerName.length > 12 ? "…" : ""}"`
                                    : `Row ${warning.row + 1}`}
                                  :
                                </span>
                                <span className="text-foreground">{warning.message}</span>
                                {warning.originalValue && (
                                  <span className="text-muted-foreground/50 ml-auto shrink-0">
                                    (was: &ldquo;{warning.originalValue}&rdquo;)
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              {parseResult && (
                <>
                  {/* Summary */}
                  <div className="flex items-center justify-between p-4 border-2 border-border bg-muted/50">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">
                        {parseResult.valid.length} case{parseResult.valid.length !== 1 ? "s" : ""} ready to
                        import
                      </span>
                      {parseResult.errors.length > 0 && (
                        <span className="text-destructive font-medium">
                          {parseResult.errors.length} error
                          {parseResult.errors.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">Click a row to edit</span>
                  </div>

                  {/* Table with scrollable container */}
                  <div className="border-2 border-border">
                    <div
                      className={cn(
                        "overflow-x-auto",
                        showAllCases && "max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
                      )}
                    >
                      <table className="w-full min-w-[700px]">
                        <thead className="sticky top-0 z-10">
                          <tr className="border-b-2 border-border bg-muted">
                            <th className="px-3 py-3 text-left text-sm font-semibold w-[25%]">Employer</th>
                            <th className="px-3 py-3 text-left text-sm font-semibold w-[25%]">Beneficiary</th>
                            <th className="px-3 py-3 text-left text-sm font-semibold w-[35%]">Status</th>
                            <th className="px-3 py-3 text-left text-sm font-semibold w-[15%]">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const allRows = [...parseResult.valid, ...parseResult.errors.map((err) => ({ row: err.row }))];
                            const rowsToShow = showAllCases ? allRows : allRows.slice(0, 10);

                            return rowsToShow.map((item, index) => {
                              const error = getRowError(index);
                              const caseData = "employerName" in item ? item : null;
                              const isError = error !== undefined;
                              const isEditing = editingIndex === index;

                              return (
                                <tr
                                  key={index}
                                  className={cn(
                                    "group border-b border-border transition-all duration-150",
                                    isError && "bg-red-50 dark:bg-red-950/20 border-red-500",
                                    isEditing && "bg-primary/5 dark:bg-primary/10 ring-1 ring-primary/50",
                                    !isError &&
                                      !isEditing &&
                                      "hover:bg-primary/5 dark:hover:bg-primary/10 cursor-pointer hover:shadow-sm"
                                  )}
                                  onClick={() => !isError && !isEditing && handleStartEdit(index)}
                                  role={!isError && !isEditing ? "button" : undefined}
                                  tabIndex={!isError && !isEditing ? 0 : undefined}
                                  onKeyDown={(e) => {
                                    if (!isError && !isEditing && (e.key === "Enter" || e.key === " ")) {
                                      handleStartEdit(index);
                                    }
                                  }}
                                >
                                  <td
                                    className="px-3 py-3 text-sm truncate max-w-[150px]"
                                    title={caseData?.employerName}
                                  >
                                    {caseData?.employerName || (
                                      <span className="text-muted-foreground italic">—</span>
                                    )}
                                  </td>
                                  <td
                                    className="px-3 py-3 text-sm truncate max-w-[150px]"
                                    title={caseData?.beneficiaryIdentifier}
                                  >
                                    {caseData?.beneficiaryIdentifier === BENEFICIARY_PLACEHOLDER ? (
                                      <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium">
                                        <UserX className="h-3 w-3" />
                                        <span className="font-mono text-xs bg-orange-100 dark:bg-orange-900/30 px-1 rounded">
                                          {BENEFICIARY_PLACEHOLDER}
                                        </span>
                                      </span>
                                    ) : caseData?.beneficiaryIdentifier ? (
                                      caseData.beneficiaryIdentifier
                                    ) : (
                                      <span className="text-muted-foreground italic">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-sm">
                                    {caseData?.caseStatus ? (
                                      <div className="flex flex-wrap items-center gap-1">
                                        <CaseStageBadge stage={caseData.caseStatus} />
                                        {caseData.progressStatus && (
                                          <ProgressStatusBadge status={caseData.progressStatus} />
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground italic">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                      <span>
                                        {caseData?.dates?.pwdFiled ||
                                        (caseData as Record<string, unknown>)?.pwdFilingDate ? (
                                          <span className="mono text-xs whitespace-nowrap">
                                            {caseData?.dates?.pwdFiled ||
                                              String((caseData as Record<string, unknown>)?.pwdFilingDate || "")}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground italic">—</span>
                                        )}
                                      </span>
                                      {!isError && !isEditing && (
                                        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0" />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Show all / Collapse toggle */}
                    {(parseResult.valid.length + parseResult.errors.length) > 10 && (
                      <button
                        type="button"
                        onClick={() => setShowAllCases(!showAllCases)}
                        className={cn(
                          "w-full px-4 py-3 bg-muted border-t-2 border-border text-sm",
                          "flex items-center justify-center gap-2",
                          "hover:bg-muted/80 transition-colors duration-150",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                        )}
                      >
                        {showAllCases ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            <span>Show less</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            <span>
                              Show all {parseResult.valid.length + parseResult.errors.length} cases
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Inline Edit Panel */}
                  {editingIndex !== null && editingCase && (
                    <div className="border-2 border-primary bg-primary/5 dark:bg-primary/10 p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">
                          Editing Row {editingIndex + 1}:{" "}
                          <span className="font-normal text-muted-foreground">
                            {editingCase.employerName || "Untitled Case"}
                          </span>
                        </h4>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleCancelEdit}
                          disabled={isSavingEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Employer Name */}
                        <div className="space-y-2">
                          <Label htmlFor="edit-employer" className="text-xs font-medium">
                            Employer Name
                          </Label>
                          <Input
                            id="edit-employer"
                            value={editingCase.employerName || ""}
                            onChange={(e) => handleEditFieldChange("employerName", e.target.value)}
                            disabled={isSavingEdit}
                            className="h-9"
                          />
                        </div>

                        {/* Beneficiary Identifier */}
                        <div className="space-y-2">
                          <Label htmlFor="edit-beneficiary" className="text-xs font-medium">
                            Beneficiary Identifier
                          </Label>
                          <Input
                            id="edit-beneficiary"
                            value={editingCase.beneficiaryIdentifier || ""}
                            onChange={(e) => handleEditFieldChange("beneficiaryIdentifier", e.target.value)}
                            disabled={isSavingEdit}
                            className={cn(
                              "h-9",
                              editingCase.beneficiaryIdentifier === BENEFICIARY_PLACEHOLDER &&
                                "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
                            )}
                          />
                        </div>

                        {/* Case Status */}
                        <div className="space-y-2">
                          <Label htmlFor="edit-case-status" className="text-xs font-medium">
                            Case Status
                          </Label>
                          <select
                            id="edit-case-status"
                            value={editingCase.caseStatus || "pwd"}
                            onChange={(e) => handleEditFieldChange("caseStatus", e.target.value)}
                            disabled={isSavingEdit}
                            className={cn(
                              "h-9 w-full rounded-md border border-input bg-background px-3 py-1",
                              "text-sm ring-offset-background",
                              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                              "transition-colors duration-150",
                              "hover:border-primary/50"
                            )}
                          >
                            {CASE_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Progress Status */}
                        <div className="space-y-2">
                          <Label htmlFor="edit-progress-status" className="text-xs font-medium">
                            Progress Status
                          </Label>
                          <select
                            id="edit-progress-status"
                            value={editingCase.progressStatus || "working"}
                            onChange={(e) => handleEditFieldChange("progressStatus", e.target.value)}
                            disabled={isSavingEdit}
                            className={cn(
                              "h-9 w-full rounded-md border border-input bg-background px-3 py-1",
                              "text-sm ring-offset-background",
                              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                              "transition-colors duration-150",
                              "hover:border-primary/50"
                            )}
                          >
                            {PROGRESS_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSavingEdit}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit}>
                          {isSavingEdit ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Error Details */}
                  {parseResult.errors.length > 0 && (
                    <div className="border-2 border-red-500 bg-red-50 dark:bg-red-950/20 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-red-900 dark:text-red-100 mb-2">Validation Errors</p>
                          <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                            {parseResult.errors.slice(0, 5).map((error, index) => (
                              <li key={index}>
                                Row {error.row + 1}: {error.field} - {error.message}
                              </li>
                            ))}
                            {parseResult.errors.length > 5 && (
                              <li className="text-red-700 dark:text-red-300">
                                + {parseResult.errors.length - 5} more errors
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* STEP 2: Duplicate Resolution */}
          {showDuplicateStep && (
            <>
              {/* Duplicate Warning */}
              <div className="flex items-start gap-3 p-4 border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    {duplicates.length} Duplicate{duplicates.length !== 1 ? "s" : ""} Found
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                    These cases already exist in your database. Choose to skip them or replace the existing ones.
                  </p>
                </div>
              </div>

              {/* Apply to All Buttons */}
              <div className="flex items-center gap-4 p-4 border-2 border-border bg-muted/50">
                <span className="text-sm font-medium">Apply to all:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyToAll("skip")}
                  className="hover:bg-muted transition-colors duration-150"
                >
                  Skip All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleApplyToAll("replace")}
                  className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive transition-colors duration-150"
                >
                  Replace All
                </Button>
              </div>

              {/* Duplicate List */}
              <div className="border-2 border-border overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted">
                      <th className="px-3 py-3 text-left text-sm font-semibold w-[30%]">Employer</th>
                      <th className="px-3 py-3 text-left text-sm font-semibold w-[30%]">Beneficiary</th>
                      <th className="px-3 py-3 text-left text-sm font-semibold w-[40%]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duplicates.map((dup) => (
                      <tr
                        key={dup.index}
                        className="border-b border-border hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="px-3 py-3 text-sm truncate max-w-[150px]" title={dup.employerName}>
                          {dup.employerName}
                        </td>
                        <td
                          className="px-3 py-3 text-sm truncate max-w-[150px]"
                          title={dup.beneficiaryIdentifier}
                        >
                          {dup.beneficiaryIdentifier}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant={resolutions[String(dup.index)] === "skip" ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleResolutionChange(dup.index, "skip")}
                              className="transition-all duration-150"
                            >
                              Skip
                            </Button>
                            <Button
                              variant={resolutions[String(dup.index)] === "replace" ? "destructive" : "outline"}
                              size="sm"
                              onClick={() => handleResolutionChange(dup.index, "replace")}
                              className={cn(
                                "transition-all duration-150",
                                resolutions[String(dup.index)] !== "replace" &&
                                  "hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                              )}
                            >
                              Replace
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resolution Summary */}
              {(() => {
                const { skipCount, replaceCount } = getResolutionSummary();
                const nonDuplicateCount = (parseResult?.valid.length ?? 0) - duplicates.length;
                return (
                  <div className="p-4 border-2 border-border bg-muted/50 text-sm">
                    <p>
                      <strong>{nonDuplicateCount}</strong> new case{nonDuplicateCount !== 1 ? "s" : ""} will be
                      imported.
                    </p>
                    {replaceCount > 0 && (
                      <p className="text-destructive">
                        <strong>{replaceCount}</strong> existing case{replaceCount !== 1 ? "s" : ""} will be
                        replaced.
                      </p>
                    )}
                    {skipCount > 0 && (
                      <p className="text-muted-foreground">
                        <strong>{skipCount}</strong> duplicate{skipCount !== 1 ? "s" : ""} will be skipped.
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}

          {/* STEP 3: Success with Validation Warnings */}
          {showSuccessStep && importSummary && (
            <>
              {/* Import Summary */}
              <div className="flex items-start gap-3 p-4 border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Import Successful
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    {importSummary.importedCount > 0 && (
                      <span>{importSummary.importedCount} case{importSummary.importedCount !== 1 ? "s" : ""} imported</span>
                    )}
                    {importSummary.importedCount > 0 && importSummary.replacedCount > 0 && ", "}
                    {importSummary.replacedCount > 0 && (
                      <span>{importSummary.replacedCount} replaced</span>
                    )}
                    {(importSummary.importedCount > 0 || importSummary.replacedCount > 0) && importSummary.skippedCount > 0 && ", "}
                    {importSummary.skippedCount > 0 && (
                      <span>{importSummary.skippedCount} skipped</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Validation Warnings */}
              {importSummary.validationWarnings.length > 0 && (
                <div className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                  <div className="flex items-start gap-3 p-4 border-b border-amber-400 dark:border-amber-600">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        {importSummary.validationWarnings.length} Case{importSummary.validationWarnings.length !== 1 ? "s" : ""} with Validation Issues
                      </p>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                        These cases were imported but have data that doesn&apos;t meet PERM regulatory requirements.
                        Review and update them to ensure compliance.
                      </p>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-300 dark:scrollbar-thumb-amber-700 scrollbar-track-transparent">
                    {importSummary.validationWarnings.map((warning, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "p-3 border-b border-amber-200 dark:border-amber-800 last:border-b-0",
                          "hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors duration-150"
                        )}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <span className="font-medium text-sm text-amber-900 dark:text-amber-100">
                            {warning.employerName}
                          </span>
                          <span className="text-xs text-amber-700 dark:text-amber-300">
                            / {warning.beneficiaryIdentifier}
                          </span>
                        </div>
                        <ul className="space-y-1 ml-2">
                          {warning.errors.map((error, errIdx) => (
                            <li
                              key={errIdx}
                              className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200"
                            >
                              <span className="font-mono text-amber-600 dark:text-amber-400 flex-shrink-0">
                                [{error.ruleId}]
                              </span>
                              <span>{error.message}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          {showSuccessStep ? (
            <Button onClick={handleCancel}>
              Close
            </Button>
          ) : showDuplicateStep ? (
            <>
              <Button variant="outline" onClick={handleBackToPreview} disabled={isImporting}>
                Back
              </Button>
              <Button onClick={handleFinalImport} loading={isImporting} loadingText="Importing...">
                Confirm Import
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel} disabled={isImporting || isCheckingDuplicates}>
                Cancel
              </Button>
              <Button
                onClick={handleCheckDuplicatesAndImport}
                disabled={
                  !parseResult ||
                  parseResult.valid.length === 0 ||
                  parseResult.errors.length > 0 ||
                  editingIndex !== null
                }
                loading={isImporting || isCheckingDuplicates}
                loadingText={isCheckingDuplicates ? "Checking..." : "Importing..."}
              >
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
