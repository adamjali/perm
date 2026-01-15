/**
 * Demo Storage Tests
 *
 * Tests for localStorage-based demo case CRUD operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getDemoCases,
  setDemoCases,
  addDemoCase,
  updateDemoCase,
  deleteDemoCase,
  getDemoCaseById,
  resetDemoCases,
  clearDemoCases,
  initDemoCases,
  hasDemoCases,
  DEMO_CASES_KEY,
  DEMO_CASES_VERSION_KEY,
  DEMO_CASES_VERSION,
} from "../storage";
import { DEFAULT_DEMO_CASES } from "../defaultCases";
import type { DemoCase, CreateDemoCaseInput } from "../types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestCaseInput(overrides?: Partial<CreateDemoCaseInput>): CreateDemoCaseInput {
  return {
    beneficiaryName: "Test Beneficiary",
    employerName: "Test Employer",
    status: "pwd",
    progressStatus: "working",
    isProfessionalOccupation: false,
    isFavorite: false,
    ...overrides,
  };
}

function createTestCase(id: string, overrides?: Partial<DemoCase>): DemoCase {
  const now = new Date().toISOString();
  return {
    id,
    beneficiaryName: "Test Beneficiary",
    employerName: "Test Employer",
    status: "pwd",
    progressStatus: "working",
    isProfessionalOccupation: false,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ============================================================================
// Mock localStorage
// ============================================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

// ============================================================================
// Setup & Teardown
// ============================================================================

beforeEach(() => {
  // Reset localStorage mock
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();

  // Mock window and localStorage
  vi.stubGlobal("window", { localStorage: localStorageMock });
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================================================
// getDemoCases Tests
// ============================================================================

describe("getDemoCases", () => {
  it("returns empty array when localStorage is empty", () => {
    const result = getDemoCases();
    expect(result).toEqual([]);
  });

  it("returns empty array when stored data is not an array", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify({ foo: "bar" }));
    const result = getDemoCases();
    expect(result).toEqual([]);
  });

  it("returns parsed cases from localStorage", () => {
    const testCases = [createTestCase("test-1"), createTestCase("test-2")];
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify(testCases));

    const result = getDemoCases();
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("test-1");
    expect(result[1]?.id).toBe("test-2");
  });

  it("returns empty array on JSON parse error", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, "invalid json{");
    const result = getDemoCases();
    expect(result).toEqual([]);
  });
});

// ============================================================================
// setDemoCases Tests
// ============================================================================

describe("setDemoCases", () => {
  it("saves cases to localStorage and returns success", () => {
    const testCases = [createTestCase("test-1")];
    const result = setDemoCases(testCases);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      DEMO_CASES_KEY,
      JSON.stringify(testCases)
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      DEMO_CASES_VERSION_KEY,
      String(DEMO_CASES_VERSION)
    );
  });

  it("returns quota_exceeded error on QuotaExceededError", () => {
    const quotaError = new DOMException("Quota exceeded", "QuotaExceededError");
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw quotaError;
    });

    const result = setDemoCases([createTestCase("test-1")]);
    expect(result.success).toBe(false);
    expect(result.error).toBe("quota_exceeded");
  });

  it("returns unknown error on other errors", () => {
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error("Unknown error");
    });

    const result = setDemoCases([createTestCase("test-1")]);
    expect(result.success).toBe(false);
    expect(result.error).toBe("unknown");
  });
});

// ============================================================================
// addDemoCase Tests
// ============================================================================

describe("addDemoCase", () => {
  it("adds a new case with generated id and timestamps", () => {
    const input = createTestCaseInput();
    const result = addDemoCase(input);

    expect(result.case.id).toMatch(/^demo_/);
    expect(result.case.beneficiaryName).toBe(input.beneficiaryName);
    expect(result.case.employerName).toBe(input.employerName);
    expect(result.case.createdAt).toBeDefined();
    expect(result.case.updatedAt).toBeDefined();
    expect(result.storageResult.success).toBe(true);
  });

  it("appends case to existing cases", () => {
    const existingCase = createTestCase("existing-1");
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([existingCase]));

    const input = createTestCaseInput({ beneficiaryName: "New Person" });
    const result = addDemoCase(input);

    const allCases = getDemoCases();
    expect(allCases).toHaveLength(2);
    expect(allCases[0]?.id).toBe("existing-1");
    expect(allCases[1]?.beneficiaryName).toBe("New Person");
    expect(result.storageResult.success).toBe(true);
  });
});

// ============================================================================
// updateDemoCase Tests
// ============================================================================

describe("updateDemoCase", () => {
  it("updates an existing case", () => {
    const existingCase = createTestCase("test-1", {
      beneficiaryName: "Original Name",
    });
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([existingCase]));

    const result = updateDemoCase("test-1", { beneficiaryName: "Updated Name" });

    expect(result.case).not.toBeNull();
    expect(result.case?.beneficiaryName).toBe("Updated Name");
    expect(result.case?.id).toBe("test-1"); // ID preserved
    expect(result.case?.createdAt).toBe(existingCase.createdAt); // createdAt preserved
    expect(result.storageResult.success).toBe(true);
  });

  it("returns null case when id not found", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("test-1")]));

    const result = updateDemoCase("non-existent", { beneficiaryName: "Updated" });

    expect(result.case).toBeNull();
    expect(result.storageResult.success).toBe(true);
  });

  it("preserves original id and createdAt on update", () => {
    const originalCreatedAt = "2024-01-01T00:00:00.000Z";
    const existingCase = createTestCase("original-id", {
      createdAt: originalCreatedAt,
    });
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([existingCase]));

    // Attempt to override id and createdAt
    const result = updateDemoCase("original-id", {
      beneficiaryName: "Updated",
    });

    expect(result.case?.id).toBe("original-id");
    expect(result.case?.createdAt).toBe(originalCreatedAt);
  });
});

// ============================================================================
// deleteDemoCase Tests
// ============================================================================

describe("deleteDemoCase", () => {
  it("deletes an existing case", () => {
    const cases = [createTestCase("test-1"), createTestCase("test-2")];
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify(cases));

    const result = deleteDemoCase("test-1");

    expect(result.deleted).toBe(true);
    expect(result.storageResult.success).toBe(true);

    const remaining = getDemoCases();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe("test-2");
  });

  it("returns deleted=false when id not found", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("test-1")]));

    const result = deleteDemoCase("non-existent");

    expect(result.deleted).toBe(false);
    expect(result.storageResult.success).toBe(true);
  });
});

// ============================================================================
// getDemoCaseById Tests
// ============================================================================

describe("getDemoCaseById", () => {
  it("returns case when found", () => {
    const testCase = createTestCase("target-id", { beneficiaryName: "Target" });
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([testCase]));

    const result = getDemoCaseById("target-id");

    expect(result).not.toBeNull();
    expect(result?.beneficiaryName).toBe("Target");
  });

  it("returns null when not found", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("other-id")]));

    const result = getDemoCaseById("non-existent");
    expect(result).toBeNull();
  });

  it("returns null when localStorage is empty", () => {
    const result = getDemoCaseById("any-id");
    expect(result).toBeNull();
  });
});

// ============================================================================
// resetDemoCases Tests
// ============================================================================

describe("resetDemoCases", () => {
  it("resets cases to default values", () => {
    // Start with custom cases
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("custom-1")]));

    const result = resetDemoCases();

    expect(result.success).toBe(true);
    const cases = getDemoCases();
    expect(cases).toEqual(DEFAULT_DEMO_CASES);
  });
});

// ============================================================================
// clearDemoCases Tests
// ============================================================================

describe("clearDemoCases", () => {
  it("clears all cases", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("test-1")]));

    const result = clearDemoCases();

    expect(result.success).toBe(true);
    const cases = getDemoCases();
    expect(cases).toEqual([]);
  });
});

// ============================================================================
// initDemoCases Tests
// ============================================================================

describe("initDemoCases", () => {
  it("initializes with defaults when empty", () => {
    const result = initDemoCases();

    expect(result.initialized).toBe(true);
    expect(result.storageResult.success).toBe(true);

    const cases = getDemoCases();
    expect(cases).toEqual(DEFAULT_DEMO_CASES);
  });

  it("does not reinitialize when cases exist", () => {
    const existingCases = [createTestCase("existing-1")];
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify(existingCases));

    const result = initDemoCases();

    expect(result.initialized).toBe(false);
    expect(result.storageResult.success).toBe(true);

    const cases = getDemoCases();
    expect(cases).toHaveLength(1);
    expect(cases[0]?.id).toBe("existing-1");
  });
});

// ============================================================================
// hasDemoCases Tests
// ============================================================================

describe("hasDemoCases", () => {
  it("returns true when cases exist", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([createTestCase("test-1")]));
    expect(hasDemoCases()).toBe(true);
  });

  it("returns false when no cases exist", () => {
    expect(hasDemoCases()).toBe(false);
  });

  it("returns false when localStorage has empty array", () => {
    localStorageMock.setItem(DEMO_CASES_KEY, JSON.stringify([]));
    expect(hasDemoCases()).toBe(false);
  });
});
