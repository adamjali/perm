/**
 * Case List Types Tests
 * Test type guards, factory functions, and runtime validation for case list types.
 */

import { describe, it, expect } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  CASE_LIST_SORT_FIELDS,
  SORT_ORDERS,
  type CaseListFilters,
  type CaseListSort,
  type CaseListResponse,
  isCaseListSortField,
  isSortOrder,
  createCaseListPagination,
  createCaseCardData,
} from "./caseListTypes";

// ============================================================================
// TYPE GUARD TESTS
// ============================================================================

describe("Type Guards", () => {
  describe("isCaseListSortField", () => {
    it("returns true for valid sort fields", () => {
      expect(isCaseListSortField("deadline")).toBe(true);
      expect(isCaseListSortField("updated")).toBe(true);
      expect(isCaseListSortField("employer")).toBe(true);
      expect(isCaseListSortField("status")).toBe(true);
      expect(isCaseListSortField("pwdFiled")).toBe(true);
      expect(isCaseListSortField("etaFiled")).toBe(true);
      expect(isCaseListSortField("i140Filed")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isCaseListSortField("invalid")).toBe(false);
      expect(isCaseListSortField("")).toBe(false);
      expect(isCaseListSortField(null)).toBe(false);
      expect(isCaseListSortField(undefined)).toBe(false);
      expect(isCaseListSortField(123)).toBe(false);
      expect(isCaseListSortField({})).toBe(false);
    });
  });

  describe("isSortOrder", () => {
    it("returns true for valid sort orders", () => {
      expect(isSortOrder("asc")).toBe(true);
      expect(isSortOrder("desc")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isSortOrder("ascending")).toBe(false);
      expect(isSortOrder("descending")).toBe(false);
      expect(isSortOrder("")).toBe(false);
      expect(isSortOrder(null)).toBe(false);
      expect(isSortOrder(undefined)).toBe(false);
      expect(isSortOrder(123)).toBe(false);
    });
  });
});

// ============================================================================
// FACTORY FUNCTION TESTS
// ============================================================================

describe("Factory Functions", () => {
  describe("createCaseListPagination", () => {
    it("creates valid pagination with all fields", () => {
      const pagination = createCaseListPagination({
        page: 2,
        pageSize: 25,
        totalCount: 100,
      });

      expect(pagination.page).toBe(2);
      expect(pagination.pageSize).toBe(25);
      expect(pagination.totalCount).toBe(100);
      expect(pagination.totalPages).toBe(4); // 100 / 25 = 4
    });

    it("calculates totalPages correctly with remainder", () => {
      const pagination = createCaseListPagination({
        page: 1,
        pageSize: 10,
        totalCount: 23,
      });

      expect(pagination.totalPages).toBe(3); // ceil(23 / 10) = 3
    });

    it("handles zero totalCount", () => {
      const pagination = createCaseListPagination({
        page: 1,
        pageSize: 10,
        totalCount: 0,
      });

      expect(pagination.totalPages).toBe(0);
    });

    it("handles pageSize of 1", () => {
      const pagination = createCaseListPagination({
        page: 5,
        pageSize: 1,
        totalCount: 10,
      });

      expect(pagination.totalPages).toBe(10);
    });
  });

  describe("createCaseCardData", () => {
    it("creates valid case card data with all fields", () => {
      const caseCard = createCaseCardData({
        _id: "test-id-123" as Id<"cases">,
        employerName: "Tech Corp",
        beneficiaryIdentifier: "John Doe",
        positionTitle: "Software Engineer",
        caseStatus: "pwd",
        progressStatus: "working",
        nextDeadline: "2025-01-15",
        isFavorite: true,
        isPinned: false,
        pwdFilingDate: "2024-12-01",
        eta9089FilingDate: "2025-02-01",
        i140FilingDate: undefined,
        _creationTime: 1703001600000,
        updatedAt: 1703088000000,
      });

      expect(caseCard._id).toBe("test-id-123");
      expect(caseCard.employerName).toBe("Tech Corp");
      expect(caseCard.beneficiaryIdentifier).toBe("John Doe");
      expect(caseCard.caseStatus).toBe("pwd");
      expect(caseCard.progressStatus).toBe("working");
      expect(caseCard.nextDeadline).toBe("2025-01-15");
      expect(caseCard.isFavorite).toBe(true);
      expect(caseCard.dates.pwdFiled).toBe("2024-12-01");
      expect(caseCard.dates.etaFiled).toBe("2025-02-01");
      expect(caseCard.dates.i140Filed).toBeUndefined();
      expect(caseCard.dates.created).toBe(1703001600000);
      expect(caseCard.dates.updated).toBe(1703088000000);
    });

    it("creates valid case card data with minimal fields", () => {
      const caseCard = createCaseCardData({
        _id: "test-id-456" as Id<"cases">,
        employerName: "Startup Inc",
        beneficiaryIdentifier: "Jane Smith",
        positionTitle: "Data Analyst",
        caseStatus: "recruitment",
        progressStatus: "filed",
        nextDeadline: undefined,
        isFavorite: false,
        isPinned: false,
        pwdFilingDate: undefined,
        eta9089FilingDate: undefined,
        i140FilingDate: undefined,
        _creationTime: 1703001600000,
        updatedAt: 1703088000000,
      });

      expect(caseCard._id).toBe("test-id-456");
      expect(caseCard.employerName).toBe("Startup Inc");
      expect(caseCard.nextDeadline).toBeUndefined();
      expect(caseCard.isFavorite).toBe(false);
      expect(caseCard.dates.pwdFiled).toBeUndefined();
      expect(caseCard.dates.etaFiled).toBeUndefined();
      expect(caseCard.dates.i140Filed).toBeUndefined();
    });
  });
});

// ============================================================================
// CONST ARRAY TESTS
// ============================================================================

describe("Const Arrays", () => {
  it("CASE_LIST_SORT_FIELDS contains all expected values", () => {
    expect(CASE_LIST_SORT_FIELDS).toEqual([
      "deadline",
      "updated",
      "employer",
      "status",
      "pwdFiled",
      "etaFiled",
      "i140Filed",
      "custom", // Added for drag-drop custom ordering
      "favorites", // Added for favorites-first sorting
    ]);
  });

  it("SORT_ORDERS contains all expected values", () => {
    expect(SORT_ORDERS).toEqual(["asc", "desc"]);
  });
});

// ============================================================================
// TYPE STRUCTURE TESTS (compile-time validation)
// ============================================================================

describe("Type Structures", () => {
  it("CaseListFilters has correct structure", () => {
    const filters: CaseListFilters = {
      status: "pwd",
      progressStatus: "working",
      searchQuery: "tech",
      favoritesOnly: true,
    };

    expect(filters.status).toBe("pwd");
    expect(filters.progressStatus).toBe("working");
    expect(filters.searchQuery).toBe("tech");
    expect(filters.favoritesOnly).toBe(true);
  });

  it("CaseListFilters allows optional fields", () => {
    const filters: CaseListFilters = {};
    expect(filters).toEqual({});
  });

  it("CaseListSort has correct structure", () => {
    const sort: CaseListSort = {
      sortBy: "deadline",
      sortOrder: "asc",
    };

    expect(sort.sortBy).toBe("deadline");
    expect(sort.sortOrder).toBe("asc");
  });

  it("CaseListResponse has correct structure", () => {
    const response: CaseListResponse = {
      cases: [],
      pagination: createCaseListPagination({
        page: 1,
        pageSize: 10,
        totalCount: 0,
      }),
    };

    expect(response.cases).toEqual([]);
    expect(response.pagination.page).toBe(1);
  });
});
