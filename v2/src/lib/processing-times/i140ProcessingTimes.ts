/**
 * I-140 Processing Time Data and Utilities
 *
 * Provides data and functions for estimating I-140 processing times
 * based on service center and petition category.
 *
 * Data is from USCIS processing times as of April 2025.
 */

import { addMonths, format } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

/**
 * I-140 Petition Categories
 */
export type I140Category =
  | "EB-1"
  | "EB-2"
  | "EB-2-NIW"
  | "EB-3"
  | "";

/**
 * USCIS Service Centers
 */
export type ServiceCenter =
  | "Texas"
  | "Nebraska"
  | "California"
  | "Vermont"
  | "";

/**
 * Processing time range in months
 */
export interface ProcessingTimeRange {
  /** 50% of cases processed within this time (months) */
  medianMonths: number;
  /** 93% of cases processed within this time (months) */
  maxMonths: number;
}

/**
 * Estimated completion date range
 */
export interface CompletionDateRange {
  /** Date by which 50% of cases are processed */
  medianDate: Date;
  /** Date by which 93% of cases are processed */
  maxDate: Date;
}

// ============================================================================
// DATA
// ============================================================================

/**
 * Processing time data by category and service center (in months)
 * Data from USCIS processing times as of April 2025
 */
const processingTimeData: Record<
  Exclude<I140Category, "">,
  Record<Exclude<ServiceCenter, "">, ProcessingTimeRange>
> = {
  "EB-1": {
    Texas: { medianMonths: 5, maxMonths: 9 },
    Nebraska: { medianMonths: 4.5, maxMonths: 8.5 },
    California: { medianMonths: 6, maxMonths: 10 },
    Vermont: { medianMonths: 6.5, maxMonths: 11 },
  },
  "EB-2": {
    Texas: { medianMonths: 6, maxMonths: 11 },
    Nebraska: { medianMonths: 5.5, maxMonths: 10 },
    California: { medianMonths: 7, maxMonths: 12 },
    Vermont: { medianMonths: 7.5, maxMonths: 12.5 },
  },
  "EB-2-NIW": {
    Texas: { medianMonths: 7, maxMonths: 12 },
    Nebraska: { medianMonths: 6.5, maxMonths: 11 },
    California: { medianMonths: 8, maxMonths: 13.5 },
    Vermont: { medianMonths: 8.5, maxMonths: 14 },
  },
  "EB-3": {
    Texas: { medianMonths: 7.5, maxMonths: 13 },
    Nebraska: { medianMonths: 6.5, maxMonths: 11 },
    California: { medianMonths: 8.5, maxMonths: 15 },
    Vermont: { medianMonths: 9, maxMonths: 14 },
  },
};

/**
 * Premium processing time in business days
 */
const PREMIUM_PROCESSING_BUSINESS_DAYS = 15;

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get the processing time range for a specific I-140 category and service center
 */
export function getI140ProcessingTime(
  category: I140Category,
  serviceCenter: ServiceCenter,
  isPremiumProcessing: boolean = false
): ProcessingTimeRange | null {
  if (isPremiumProcessing) {
    // Premium processing is 15 business days (approximately 0.75 months)
    return { medianMonths: 0.5, maxMonths: 0.75 };
  }

  if (!category || !serviceCenter) {
    return null;
  }

  const categoryData = processingTimeData[category];
  if (!categoryData) {
    return null;
  }

  return categoryData[serviceCenter] ?? null;
}

/**
 * Get the estimated completion date range for an I-140 petition
 */
export function getI140CompletionDateRange(
  category: I140Category,
  serviceCenter: ServiceCenter,
  filingDate: Date | string,
  isPremiumProcessing: boolean = false
): CompletionDateRange | null {
  const processingTime = getI140ProcessingTime(
    category,
    serviceCenter,
    isPremiumProcessing
  );

  if (!processingTime) {
    return null;
  }

  const filingDateObj =
    typeof filingDate === "string" ? new Date(filingDate + "T00:00:00") : filingDate;

  // Calculate dates
  const medianDate = addMonths(filingDateObj, processingTime.medianMonths);
  const maxDate = addMonths(filingDateObj, processingTime.maxMonths);

  return { medianDate, maxDate };
}

/**
 * Format processing time as a string (e.g., "5-9 months")
 */
export function formatProcessingTimeRange(range: ProcessingTimeRange): string {
  const minMonths = Math.round(range.medianMonths);
  const maxMonths = Math.round(range.maxMonths);

  if (minMonths === maxMonths) {
    return `~${minMonths} month${minMonths !== 1 ? "s" : ""}`;
  }

  return `${minMonths}-${maxMonths} months`;
}

/**
 * Format a single processing time value
 */
export function formatProcessingTime(months: number): string {
  const wholeMonths = Math.floor(months);
  const remainingDays = Math.round((months - wholeMonths) * 30);

  if (remainingDays === 0) {
    return `${wholeMonths} month${wholeMonths !== 1 ? "s" : ""}`;
  } else if (wholeMonths === 0) {
    return `${remainingDays} day${remainingDays !== 1 ? "s" : ""}`;
  } else {
    return `${wholeMonths} month${wholeMonths !== 1 ? "s" : ""} ${remainingDays}d`;
  }
}

/**
 * Format completion date range as a string (e.g., "Mar 2025 - Jun 2025")
 */
export function formatCompletionDateRange(range: CompletionDateRange): string {
  return `${format(range.medianDate, "MMM yyyy")} - ${format(range.maxDate, "MMM yyyy")}`;
}

/**
 * Get all available I-140 categories
 */
export function getAllI140Categories(): I140Category[] {
  return ["EB-1", "EB-2", "EB-2-NIW", "EB-3"];
}

/**
 * Get all available service centers
 */
export function getAllServiceCenters(): ServiceCenter[] {
  return ["Texas", "Nebraska", "California", "Vermont"];
}

/**
 * Get premium processing info
 */
export function getPremiumProcessingInfo(): {
  businessDays: number;
  description: string;
} {
  return {
    businessDays: PREMIUM_PROCESSING_BUSINESS_DAYS,
    description: `Premium Processing guarantees initial review within ${PREMIUM_PROCESSING_BUSINESS_DAYS} business days. Additional fee required.`,
  };
}
