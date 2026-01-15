// @vitest-environment jsdom
/**
 * Page Context Utilities Tests
 *
 * Tests for the page context system that provides chatbot awareness
 * of what page the user is viewing.
 *
 * Key behaviors:
 * - detectPageType returns correct type for each route
 * - extractCaseId parses case detail routes correctly
 * - extractFiltersFromURL parses filter params from URL
 * - Context provider provides and updates context on route change
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock next/navigation
const mockPathname = vi.fn(() => '/');
const mockSearchParams = vi.fn(() => new URLSearchParams());

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useSearchParams: () => mockSearchParams(),
}));

// Import after mocks are set up
import {
  PageContextProvider,
  usePageContext,
  usePageContextUpdater,
  serializePageContext,
  summarizePageContext,
  type PageContext,
} from '../page-context';

// =============================================================================
// Test Helpers
// =============================================================================

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PageContextProvider>{children}</PageContextProvider>;
  };
}

function createSearchParams(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params);
}

// =============================================================================
// detectPageType Tests
// =============================================================================

describe('detectPageType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it.each([
    ['/', 'dashboard'],
    ['/dashboard', 'dashboard'],
    ['/cases', 'cases_list'],
    ['/cases/abc123', 'case_detail'],
    ['/cases/some-case-id-here', 'case_detail'],
    ['/calendar', 'calendar'],
    ['/notifications', 'notifications'],
    ['/settings', 'settings'],
    ['/unknown-route', 'unknown'],
    ['/some/nested/path', 'unknown'],
    ['/cases/new', 'unknown'], // /cases/new is explicitly NOT a case_detail
  ])('returns %s for path %s', (path, expectedType) => {
    mockPathname.mockReturnValue(path);

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pageType).toBe(expectedType);
    expect(result.current.path).toBe(path);
  });
});

// =============================================================================
// extractCaseId Tests
// =============================================================================

describe('extractCaseId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it.each([
    ['/cases/abc123', 'abc123'],
    ['/cases/case-with-dashes', 'case-with-dashes'],
    ['/cases/CaseWithCaps', 'CaseWithCaps'],
    ['/cases/123456', '123456'],
    ['/cases/a1b2c3d4e5f6', 'a1b2c3d4e5f6'],
  ])('extracts case ID %s from path %s', (path, expectedId) => {
    mockPathname.mockReturnValue(path);

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentCaseId).toBe(expectedId);
  });

  it.each([
    ['/', undefined],
    ['/dashboard', undefined],
    ['/cases', undefined],
    ['/cases/new', undefined], // new is not a valid case ID route
    ['/calendar', undefined],
    ['/settings', undefined],
    ['/notifications', undefined],
  ])('returns undefined for non-case route %s', (path, expectedId) => {
    mockPathname.mockReturnValue(path);

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentCaseId).toBe(expectedId);
  });
});

// =============================================================================
// extractFiltersFromURL Tests
// =============================================================================

describe('extractFiltersFromURL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/cases');
  });

  it('returns undefined when no filters are present', () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toBeUndefined();
  });

  it('parses status filter', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ status: 'pwd' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({ status: 'pwd' });
  });

  it('parses progress filter', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ progress: 'in_progress' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({ progressStatus: 'in_progress' });
  });

  it('parses search filter', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ search: 'acme corp' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({ searchText: 'acme corp' });
  });

  it('parses favorites filter when true', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ favorites: 'true' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({ favoritesOnly: true });
  });

  it('ignores favorites filter when not true', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ favorites: 'false' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    // favorites=false is not included in filters
    expect(result.current.filters).toBeUndefined();
  });

  it('parses duplicates filter when true', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ duplicates: 'true' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({ showDuplicates: true });
  });

  it('parses all filters together', () => {
    mockSearchParams.mockReturnValue(
      createSearchParams({
        status: 'recruitment',
        progress: 'waiting',
        search: 'test query',
        favorites: 'true',
        duplicates: 'true',
      })
    );

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.filters).toEqual({
      status: 'recruitment',
      progressStatus: 'waiting',
      searchText: 'test query',
      favoritesOnly: true,
      showDuplicates: true,
    });
  });

  it('parses pagination from URL', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ page: '3' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pagination).toEqual({ page: 3 });
  });

  it('defaults pagination to page 1 when not specified', () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pagination).toEqual({ page: 1 });
  });

  it('handles invalid page number gracefully', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ page: 'invalid' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pagination).toEqual({ page: 1 });
  });
});

// =============================================================================
// Settings Tab Extraction Tests
// =============================================================================

describe('settings tab extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/settings');
  });

  it('defaults to profile tab when no tab specified', () => {
    mockSearchParams.mockReturnValue(new URLSearchParams());

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.settingsTab).toBe('profile');
  });

  it('extracts settings tab from URL', () => {
    mockSearchParams.mockReturnValue(createSearchParams({ tab: 'notifications' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.settingsTab).toBe('notifications');
  });
});

// =============================================================================
// Context Provider Behavior Tests
// =============================================================================

describe('PageContextProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('provides context to children', () => {
    mockPathname.mockReturnValue('/dashboard');

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.path).toBe('/dashboard');
    expect(result.current.pageType).toBe('dashboard');
    expect(typeof result.current.timestamp).toBe('number');
  });

  it('updates context on route change', () => {
    mockPathname.mockReturnValue('/cases');

    const { result, rerender } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.pageType).toBe('cases_list');

    // Simulate route change
    mockPathname.mockReturnValue('/calendar');
    rerender();

    expect(result.current.pageType).toBe('calendar');
    expect(result.current.path).toBe('/calendar');
  });

  it('clears page data when route changes', () => {
    mockPathname.mockReturnValue('/cases');

    const { result, rerender } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    // Set some page-specific data
    act(() => {
      result.current.updater.setPageData({
        visibleCaseIds: ['case1', 'case2'],
      });
    });

    expect(result.current.context.visibleCaseIds).toEqual(['case1', 'case2']);

    // Simulate route change
    mockPathname.mockReturnValue('/calendar');
    rerender();

    // Page data should be cleared
    expect(result.current.context.visibleCaseIds).toBeUndefined();
  });
});

// =============================================================================
// usePageContextUpdater Tests
// =============================================================================

describe('usePageContextUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue('/cases');
    mockSearchParams.mockReturnValue(new URLSearchParams());
  });

  it('allows setting page-specific data', () => {
    const { result } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.updater.setPageData({
        visibleCaseIds: ['case1', 'case2', 'case3'],
        pagination: { page: 1, pageSize: 10, totalCount: 50 },
      });
    });

    expect(result.current.context.visibleCaseIds).toEqual(['case1', 'case2', 'case3']);
    expect(result.current.context.pagination).toEqual({
      page: 1,
      pageSize: 10,
      totalCount: 50,
    });
  });

  it('merges page data on subsequent calls', () => {
    const { result } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.updater.setPageData({
        visibleCaseIds: ['case1'],
      });
    });

    act(() => {
      result.current.updater.setPageData({
        selectedCaseIds: ['case1'],
      });
    });

    expect(result.current.context.visibleCaseIds).toEqual(['case1']);
    expect(result.current.context.selectedCaseIds).toEqual(['case1']);
  });

  it('allows clearing page data', () => {
    const { result } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.updater.setPageData({
        visibleCaseIds: ['case1', 'case2'],
        selectedCaseIds: ['case1'],
      });
    });

    expect(result.current.context.visibleCaseIds).toEqual(['case1', 'case2']);

    act(() => {
      result.current.updater.clearPageData();
    });

    expect(result.current.context.visibleCaseIds).toBeUndefined();
    expect(result.current.context.selectedCaseIds).toBeUndefined();
  });
});

// =============================================================================
// usePageContext Without Provider Tests
// =============================================================================

describe('usePageContext without provider', () => {
  it('returns minimal context when provider not mounted', () => {
    // Render without wrapper
    const { result } = renderHook(() => usePageContext());

    expect(result.current.pageType).toBe('unknown');
    expect(typeof result.current.timestamp).toBe('number');
    // Path should fallback to window.location.pathname or '/'
    expect(typeof result.current.path).toBe('string');
  });
});

// =============================================================================
// usePageContextUpdater Without Provider Tests
// =============================================================================

describe('usePageContextUpdater without provider', () => {
  it('returns no-op functions when provider not mounted', () => {
    const { result } = renderHook(() => usePageContextUpdater());

    // Should not throw
    expect(() => result.current.setPageData({ visibleCaseIds: ['test'] })).not.toThrow();
    expect(() => result.current.clearPageData()).not.toThrow();
  });
});

// =============================================================================
// serializePageContext Tests
// =============================================================================

describe('serializePageContext', () => {
  it('removes undefined values from context', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      currentCaseId: undefined,
      filters: undefined,
    };

    const serialized = serializePageContext(context);

    expect(serialized).toEqual({
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
    });
    expect('currentCaseId' in serialized).toBe(false);
    expect('filters' in serialized).toBe(false);
  });

  it('removes null values from context', () => {
    const context: PageContext = {
      path: '/dashboard',
      pageType: 'dashboard',
      timestamp: 1234567890,
    };

    // Add a null value manually for testing
    const contextWithNull = { ...context, someField: null } as unknown as PageContext;

    const serialized = serializePageContext(contextWithNull);

    expect('someField' in serialized).toBe(false);
  });

  it('preserves defined values', () => {
    const context: PageContext = {
      path: '/cases/abc123',
      pageType: 'case_detail',
      timestamp: 1234567890,
      currentCaseId: 'abc123',
      currentCaseData: {
        employerName: 'Acme Corp',
        beneficiaryIdentifier: 'John Doe',
        caseStatus: 'pwd',
        progressStatus: 'in_progress',
      },
    };

    const serialized = serializePageContext(context);

    expect(serialized).toEqual({
      path: '/cases/abc123',
      pageType: 'case_detail',
      timestamp: 1234567890,
      currentCaseId: 'abc123',
      currentCaseData: {
        employerName: 'Acme Corp',
        beneficiaryIdentifier: 'John Doe',
        caseStatus: 'pwd',
        progressStatus: 'in_progress',
      },
    });
  });
});

// =============================================================================
// summarizePageContext Tests
// =============================================================================

describe('summarizePageContext', () => {
  it('includes page path and type', () => {
    const context: PageContext = {
      path: '/dashboard',
      pageType: 'dashboard',
      timestamp: 1234567890,
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('/dashboard');
    expect(summary).toContain('dashboard');
  });

  it('includes case ID when viewing case detail', () => {
    const context: PageContext = {
      path: '/cases/abc123',
      pageType: 'case_detail',
      timestamp: 1234567890,
      currentCaseId: 'abc123',
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('abc123');
    expect(summary).toContain('Viewing case');
  });

  it('includes case data when available', () => {
    const context: PageContext = {
      path: '/cases/abc123',
      pageType: 'case_detail',
      timestamp: 1234567890,
      currentCaseId: 'abc123',
      currentCaseData: {
        employerName: 'Acme Corp',
        beneficiaryIdentifier: 'John Doe',
      },
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('Acme Corp');
    expect(summary).toContain('John Doe');
  });

  it('includes visible case count', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      visibleCaseIds: ['case1', 'case2', 'case3'],
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('3 cases visible');
  });

  it('includes active filters', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      filters: {
        status: 'pwd',
        progressStatus: 'in_progress',
        searchText: 'test query',
        favoritesOnly: true,
      },
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('Active filters');
    expect(summary).toContain('status=pwd');
    expect(summary).toContain('progress=in_progress');
    expect(summary).toContain('search="test query"');
    expect(summary).toContain('favorites only');
  });

  it('includes pagination total count', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      pagination: { page: 1, totalCount: 42 },
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('42 cases');
  });

  it('includes selected case count', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      selectedCaseIds: ['case1', 'case2'],
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('2 cases selected');
  });

  it('includes notification tab', () => {
    const context: PageContext = {
      path: '/notifications',
      pageType: 'notifications',
      timestamp: 1234567890,
      notificationTab: 'unread',
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('Notification tab: unread');
  });

  it('includes unread notification count', () => {
    const context: PageContext = {
      path: '/notifications',
      pageType: 'notifications',
      timestamp: 1234567890,
      unreadCount: 5,
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('Unread notifications: 5');
  });

  it('includes settings tab', () => {
    const context: PageContext = {
      path: '/settings',
      pageType: 'settings',
      timestamp: 1234567890,
      settingsTab: 'calendar',
    };

    const summary = summarizePageContext(context);

    expect(summary).toContain('Settings tab: calendar');
  });

  it('handles empty filters gracefully', () => {
    const context: PageContext = {
      path: '/cases',
      pageType: 'cases_list',
      timestamp: 1234567890,
      filters: {},
    };

    const summary = summarizePageContext(context);

    // Should not include "Active filters" for empty filters object
    expect(summary).not.toContain('Active filters');
  });

  it('handles missing case data fields gracefully', () => {
    const context: PageContext = {
      path: '/cases/abc123',
      pageType: 'case_detail',
      timestamp: 1234567890,
      currentCaseId: 'abc123',
      currentCaseData: {}, // Empty case data
    };

    const summary = summarizePageContext(context);

    // Should not include the case data line when fields are missing
    expect(summary).toContain('Viewing case: abc123');
    expect(summary).not.toContain('Unknown - Unknown');
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('page context integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('case detail page has correct context structure', () => {
    mockPathname.mockReturnValue('/cases/test-case-123');
    mockSearchParams.mockReturnValue(new URLSearchParams());

    const { result } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    // Set case-specific data
    act(() => {
      result.current.updater.setPageData({
        currentCaseData: {
          employerName: 'Test Corp',
          beneficiaryIdentifier: 'Jane Doe',
          caseStatus: 'recruitment',
          progressStatus: 'in_progress',
        },
      });
    });

    const ctx = result.current.context;

    expect(ctx.pageType).toBe('case_detail');
    expect(ctx.currentCaseId).toBe('test-case-123');
    expect(ctx.currentCaseData?.employerName).toBe('Test Corp');
    expect(ctx.currentCaseData?.beneficiaryIdentifier).toBe('Jane Doe');
  });

  it('cases list page has correct context structure', () => {
    mockPathname.mockReturnValue('/cases');
    mockSearchParams.mockReturnValue(
      createSearchParams({
        status: 'pwd',
        search: 'acme',
        page: '2',
      })
    );

    const { result } = renderHook(
      () => ({
        context: usePageContext(),
        updater: usePageContextUpdater(),
      }),
      { wrapper: createWrapper() }
    );

    // Set list-specific data
    act(() => {
      result.current.updater.setPageData({
        visibleCaseIds: ['case1', 'case2', 'case3'],
        pagination: { page: 2, pageSize: 10, totalCount: 25 },
      });
    });

    const ctx = result.current.context;

    expect(ctx.pageType).toBe('cases_list');
    expect(ctx.filters?.status).toBe('pwd');
    expect(ctx.filters?.searchText).toBe('acme');
    expect(ctx.pagination?.page).toBe(2);
    expect(ctx.pagination?.totalCount).toBe(25);
    expect(ctx.visibleCaseIds).toHaveLength(3);
  });

  it('serialized context can be JSON stringified', () => {
    mockPathname.mockReturnValue('/cases');
    mockSearchParams.mockReturnValue(createSearchParams({ status: 'pwd' }));

    const { result } = renderHook(() => usePageContext(), {
      wrapper: createWrapper(),
    });

    const serialized = serializePageContext(result.current);

    // Should not throw
    const jsonString = JSON.stringify(serialized);
    const parsed = JSON.parse(jsonString);

    expect(parsed.path).toBe('/cases');
    expect(parsed.pageType).toBe('cases_list');
    expect(parsed.filters.status).toBe('pwd');
  });
});
