/**
 * Edit Case Page Tests
 *
 * Test suite for the Edit Case page component.
 * Validates data fetching, loading states, form pre-population, and navigation.
 *
 * Phase: 22 (Case Forms)
 * Task: 22-05 (Edit Case Page)
 * Created: 2025-12-25
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import EditCasePage from '../page';
import type { Doc } from '../../../../../../../convex/_generated/dataModel';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('next/navigation', () => ({
  useParams: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
  useConvex: vi.fn(() => ({
    query: vi.fn().mockResolvedValue({ duplicates: [] }),
  })),
}));

// Mock auth-aware toast wrapper (not sonner directly)
vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

vi.mock('@/components/forms/CaseForm', () => ({
  CaseForm: vi.fn(({ mode, initialData, onSuccess, onCancel }: any) => {
    // Convert BigInt to string for JSON serialization
    const serializableData = initialData ? {
      ...initialData,
      recruitmentApplicantsCount: initialData.recruitmentApplicantsCount?.toString(),
    } : null;

    return (
      <div data-testid="case-form">
        <div data-testid="form-mode">{mode}</div>
        <div data-testid="form-data">{JSON.stringify(serializableData)}</div>
        <button onClick={() => onSuccess(initialData)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  }),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const mockCaseData: Partial<Doc<'cases'>> = {
  _id: 'test-case-id' as any,
  _creationTime: 1234567890,
  userId: 'user-123' as any,
  employerName: 'Acme Corp',
  beneficiaryIdentifier: 'John Doe',
  positionTitle: 'Software Engineer',
  caseStatus: 'pwd',
  progressStatus: 'working',
  isProfessionalOccupation: true,
  isFavorite: false,
  calendarSyncEnabled: true,
  priorityLevel: 'normal',
  recruitmentApplicantsCount: 0,
  additionalRecruitmentMethods: [],
  tags: [],
  documents: [],
  notes: [],
  createdAt: 1234567890,
  updatedAt: 1234567890,
};

// ============================================================================
// TESTS
// ============================================================================

describe('EditCasePage', () => {
  const mockPush = vi.fn();
  const mockBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (useParams as ReturnType<typeof vi.fn>).mockReturnValue({ id: 'test-case-id' });
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue({
      push: mockPush,
      back: mockBack,
    });
  });

  describe('Loading State', () => {
    it('renders loading skeleton while fetching case data', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      render(<EditCasePage />);

      expect(screen.getByTestId('edit-page-skeleton')).toBeInTheDocument();
      expect(screen.queryByTestId('case-form')).not.toBeInTheDocument();
    });
  });

  describe('Not Found State', () => {
    it('renders not found message when case does not exist', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(null);

      render(<EditCasePage />);

      expect(screen.getByText('Case not found')).toBeInTheDocument();
      expect(
        screen.getByText("The case you're looking for doesn't exist or you don't have access.")
      ).toBeInTheDocument();
      expect(screen.getByText('Back to Cases')).toBeInTheDocument();
      expect(screen.queryByTestId('case-form')).not.toBeInTheDocument();
    });

    it('provides link back to cases list when case not found', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(null);

      render(<EditCasePage />);

      const backLink = screen.getByText('Back to Cases').closest('a');
      expect(backLink).toHaveAttribute('href', '/cases');
    });
  });

  describe('Form Pre-population', () => {
    it('fetches case data using correct API and ID', () => {
      const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
      mockUseQuery.mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'test-case-id',
        })
      );
    });

    it('renders CaseForm with edit mode', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      expect(screen.getByTestId('case-form')).toBeInTheDocument();
      expect(screen.getByTestId('form-mode')).toHaveTextContent('edit');
    });

    it('pre-populates form with fetched case data', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      const formData = JSON.parse(screen.getByTestId('form-data').textContent || '{}');
      expect(formData.employerName).toBe('Acme Corp');
      expect(formData.beneficiaryIdentifier).toBe('John Doe');
      expect(formData.positionTitle).toBe('Software Engineer');
      expect(formData.caseStatus).toBe('pwd');
    });
  });

  describe('Page Layout', () => {
    it('renders breadcrumb navigation', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      expect(screen.getByText('Cases')).toBeInTheDocument();
      expect(screen.getByText('Acme Corp - Software Engineer')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('renders page title with case details', () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      expect(screen.getByText('Edit Case: Acme Corp - Software Engineer')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates back to case detail page on cancel', async () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      const cancelButton = screen.getByText('Cancel');
      cancelButton.click();

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/cases/test-case-id');
      });
    });

    it('navigates to case detail page on successful save', async () => {
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      const saveButton = screen.getByText('Save');
      saveButton.click();

      await waitFor(() => {
        // Page uses caseId from params ('test-case-id'), not the returned result
        expect(mockPush).toHaveBeenCalledWith('/cases/test-case-id');
      });
    });

    it('shows success toast on successful save', async () => {
      const { toast } = await import('@/lib/toast');
      (useQuery as ReturnType<typeof vi.fn>).mockReturnValue(mockCaseData);

      render(<EditCasePage />);

      const saveButton = screen.getByText('Save');
      saveButton.click();

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Case updated successfully');
      });
    });
  });
});
