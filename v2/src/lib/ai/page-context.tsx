/**
 * Page Context System for Chat
 *
 * Provides the chatbot with awareness of what page the user is viewing
 * and what data is visible on screen.
 *
 * Architecture:
 * - PageContextProvider wraps the app and holds current context
 * - usePageContext() reads the current context
 * - usePageContextUpdater() allows pages to update their specific data
 * - Context is sent with each chat message for AI awareness
 *
 * @module lib/ai/page-context
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// =============================================================================
// Types
// =============================================================================

/**
 * Recognized page types in the application
 */
export type PageType =
  | 'dashboard'
  | 'cases_list'
  | 'case_detail'
  | 'calendar'
  | 'notifications'
  | 'settings'
  | 'unknown';

/**
 * Filters applied on the cases list page
 */
export interface CaseListFilters {
  status?: string;
  progressStatus?: string;
  searchText?: string;
  favoritesOnly?: boolean;
  showDuplicates?: boolean;
}

/**
 * Pagination state for list pages
 * All fields optional since we may only know partial info from URL
 */
export interface PaginationState {
  page?: number;
  pageSize?: number;
  totalCount?: number;
}

/**
 * Calendar-specific filters
 */
export interface CalendarFilters {
  showCompleted?: boolean;
  showClosed?: boolean;
}

/**
 * Complete page context sent to the chat API
 */
export interface PageContext {
  // Always present
  path: string;
  pageType: PageType;
  timestamp: number;

  // Case detail page
  currentCaseId?: string;
  currentCaseData?: {
    employerName?: string;
    beneficiaryIdentifier?: string;
    caseStatus?: string;
    progressStatus?: string;
  };

  // Cases list page
  filters?: CaseListFilters;
  pagination?: PaginationState;
  visibleCaseIds?: string[];
  selectedCaseIds?: string[];

  // Calendar page
  calendarFilters?: CalendarFilters;
  visibleEventCount?: number;

  // Notifications page
  notificationTab?: string;
  unreadCount?: number;
  totalNotifications?: number;

  // Settings page
  settingsTab?: string;
}

/**
 * Page-specific data that components can update
 */
export interface PageSpecificData {
  // Case detail
  currentCaseId?: string;
  currentCaseData?: PageContext['currentCaseData'];

  // Cases list
  filters?: CaseListFilters;
  pagination?: PaginationState;
  visibleCaseIds?: string[];
  selectedCaseIds?: string[];

  // Calendar
  calendarFilters?: CalendarFilters;
  visibleEventCount?: number;

  // Notifications
  notificationTab?: string;
  unreadCount?: number;
  totalNotifications?: number;

  // Settings
  settingsTab?: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Detect page type from pathname
 */
function detectPageType(pathname: string): PageType {
  if (pathname === '/' || pathname === '/dashboard') {
    return 'dashboard';
  }
  if (pathname === '/cases') {
    return 'cases_list';
  }
  if (pathname.startsWith('/cases/') && pathname !== '/cases/new') {
    return 'case_detail';
  }
  if (pathname === '/calendar') {
    return 'calendar';
  }
  if (pathname === '/notifications') {
    return 'notifications';
  }
  if (pathname === '/settings') {
    return 'settings';
  }
  return 'unknown';
}

/**
 * Extract case ID from pathname like /cases/abc123
 */
function extractCaseId(pathname: string): string | undefined {
  const match = pathname.match(/^\/cases\/([^/]+)$/);
  return match?.[1];
}

/**
 * Extract filter state from URL search params
 * Returns undefined if no filters are present
 */
function extractFiltersFromURL(searchParams: URLSearchParams): CaseListFilters | undefined {
  const filters: CaseListFilters = {};

  const status = searchParams.get('status');
  if (status) filters.status = status;

  const progress = searchParams.get('progress');
  if (progress) filters.progressStatus = progress;

  const search = searchParams.get('search');
  if (search) filters.searchText = search;

  const favorites = searchParams.get('favorites');
  if (favorites === 'true') filters.favoritesOnly = true;

  const duplicates = searchParams.get('duplicates');
  if (duplicates === 'true') filters.showDuplicates = true;

  return Object.keys(filters).length > 0 ? filters : undefined;
}

/**
 * Extract pagination from URL
 */
function extractPaginationFromURL(searchParams: URLSearchParams): PaginationState {
  const page = parseInt(searchParams.get('page') || '1', 10);
  return { page: isNaN(page) ? 1 : page };
}

// =============================================================================
// Context
// =============================================================================

interface PageContextValue {
  context: PageContext;
  setPageData: (data: PageSpecificData) => void;
  clearPageData: () => void;
}

const PageContextContext = createContext<PageContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface PageContextProviderProps {
  children: ReactNode;
}

/**
 * Provider that tracks current page context for the chat system
 *
 * Wrap your app with this provider to enable page awareness in chat.
 *
 * @example
 * ```tsx
 * <PageContextProvider>
 *   <App />
 * </PageContextProvider>
 * ```
 */
export function PageContextProvider({ children }: PageContextProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Page-specific data updated by individual pages
  const [pageData, setPageDataState] = useState<PageSpecificData>({});

  // Timestamp state - initially 0, updated after mount
  // This ensures pure render (no Date.now() during render)
  const [timestamp, setTimestamp] = useState(0);

  // Initialize timestamp on mount
  useEffect(() => {
    setTimestamp(Date.now());
  }, []);

  // Base context derived from URL
  const baseContext = useMemo(() => {
    const pageType = detectPageType(pathname);
    return {
      path: pathname,
      pageType,
      // Auto-extract case ID for detail pages
      ...(pageType === 'case_detail' && {
        currentCaseId: extractCaseId(pathname),
      }),
      // Auto-extract filters for cases list
      ...(pageType === 'cases_list' && {
        filters: extractFiltersFromURL(searchParams),
        pagination: extractPaginationFromURL(searchParams),
      }),
      // Auto-extract settings tab
      ...(pageType === 'settings' && {
        settingsTab: searchParams.get('tab') || 'profile',
      }),
    };
  }, [pathname, searchParams]);

  // Clear page data and update timestamp when route changes
  useEffect(() => {
    setPageDataState({});
    setTimestamp(Date.now());
  }, [pathname]);

  // Update timestamp when page data changes
  useEffect(() => {
    setTimestamp(Date.now());
  }, [pageData]);

  // Merge base context with page-specific data
  const context = useMemo((): PageContext => {
    return {
      ...baseContext,
      ...pageData,
      timestamp,
    };
  }, [baseContext, pageData, timestamp]);

  // Function for pages to update their specific data
  const setPageData = useCallback((data: PageSpecificData) => {
    setPageDataState((prev) => ({ ...prev, ...data }));
  }, []);

  // Function to clear page data
  const clearPageData = useCallback(() => {
    setPageDataState({});
  }, []);

  const value = useMemo(
    () => ({ context, setPageData, clearPageData }),
    [context, setPageData, clearPageData]
  );

  return (
    <PageContextContext.Provider value={value}>
      {children}
    </PageContextContext.Provider>
  );
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Get the current page context
 *
 * @returns Current page context for sending to chat API
 *
 * @example
 * ```tsx
 * const pageContext = usePageContext();
 * sendMessage({ text }, { body: { pageContext } });
 * ```
 */
// Stable fallback timestamp for cases when provider is not mounted
const fallbackTimestamp = typeof globalThis !== 'undefined' ? Date.now() : 0;

export function usePageContext(): PageContext {
  const ctx = useContext(PageContextContext);
  if (!ctx) {
    // Return minimal context if provider not mounted
    // This allows the chat to work even without the provider
    return {
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      pageType: 'unknown',
      timestamp: fallbackTimestamp,
    };
  }
  return ctx.context;
}

/**
 * Get function to update page-specific context data
 *
 * Use this in page components to provide additional context.
 *
 * @example
 * ```tsx
 * const { setPageData } = usePageContextUpdater();
 *
 * useEffect(() => {
 *   setPageData({
 *     visibleCaseIds: cases?.map(c => c._id),
 *     pagination: { page: 1, pageSize: 10, totalCount: 100 },
 *   });
 * }, [cases, setPageData]);
 * ```
 */
export function usePageContextUpdater(): {
  setPageData: (data: PageSpecificData) => void;
  clearPageData: () => void;
} {
  const ctx = useContext(PageContextContext);
  if (!ctx) {
    // Return no-op functions if provider not mounted
    return {
      setPageData: () => {},
      clearPageData: () => {},
    };
  }
  return {
    setPageData: ctx.setPageData,
    clearPageData: ctx.clearPageData,
  };
}

// =============================================================================
// Serialization
// =============================================================================

/**
 * Serialize page context for API request
 *
 * Removes undefined values and ensures clean JSON serialization.
 */
export function serializePageContext(context: PageContext): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined && value !== null) {
      serialized[key] = value;
    }
  }

  return serialized;
}

/**
 * Create a minimal context summary for system prompt
 *
 * Returns a human-readable description of the current page context.
 */
export function summarizePageContext(context: PageContext): string {
  const lines: string[] = [];

  lines.push(`Current page: ${context.path} (${context.pageType})`);

  if (context.currentCaseId) {
    lines.push(`Viewing case: ${context.currentCaseId}`);
    if (context.currentCaseData) {
      const { employerName, beneficiaryIdentifier } = context.currentCaseData;
      if (employerName || beneficiaryIdentifier) {
        lines.push(`Case: ${employerName || 'Unknown'} - ${beneficiaryIdentifier || 'Unknown'}`);
      }
    }
  }

  if (context.visibleCaseIds?.length) {
    lines.push(`${context.visibleCaseIds.length} cases visible on screen`);
  }

  if (context.filters && Object.keys(context.filters).length > 0) {
    const filterParts: string[] = [];
    if (context.filters.status) filterParts.push(`status=${context.filters.status}`);
    if (context.filters.progressStatus) filterParts.push(`progress=${context.filters.progressStatus}`);
    if (context.filters.searchText) filterParts.push(`search="${context.filters.searchText}"`);
    if (context.filters.favoritesOnly) filterParts.push('favorites only');
    if (filterParts.length > 0) {
      lines.push(`Active filters: ${filterParts.join(', ')}`);
    }
  }

  if (context.pagination?.totalCount !== undefined) {
    lines.push(`Total matching: ${context.pagination.totalCount} cases`);
  }

  if (context.selectedCaseIds?.length) {
    lines.push(`${context.selectedCaseIds.length} cases selected`);
  }

  if (context.notificationTab) {
    lines.push(`Notification tab: ${context.notificationTab}`);
  }

  if (context.unreadCount !== undefined) {
    lines.push(`Unread notifications: ${context.unreadCount}`);
  }

  if (context.settingsTab) {
    lines.push(`Settings tab: ${context.settingsTab}`);
  }

  return lines.join('\n');
}
