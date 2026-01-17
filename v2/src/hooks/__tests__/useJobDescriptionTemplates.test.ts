/**
 * useJobDescriptionTemplates Hook Tests
 *
 * Tests for the job description templates hook.
 * Focuses on state management and utility functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJobDescriptionTemplates } from '../useJobDescriptionTemplates';
import type { JobDescriptionTemplate } from '../useJobDescriptionTemplates';

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

// Import mocked modules
import { useQuery, useMutation } from 'convex/react';

// Type-safe mock helpers
const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
const mockUseMutation = useMutation as ReturnType<typeof vi.fn>;

// Test fixtures
const createMockTemplate = (
  overrides: Partial<JobDescriptionTemplate> = {}
): JobDescriptionTemplate => ({
  _id: `template_${Math.random().toString(36).slice(2, 9)}` as JobDescriptionTemplate['_id'],
  name: 'Test Template',
  description: 'Test description',
  usageCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('useJobDescriptionTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks
    mockUseQuery.mockReturnValue([]);
    mockUseMutation.mockReturnValue(vi.fn());
  });

  describe('templates state', () => {
    it('returns empty array when no templates exist', () => {
      mockUseQuery.mockReturnValue([]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.templates).toEqual([]);
    });

    it('returns templates from query', () => {
      const templates = [
        createMockTemplate({ name: 'Template A' }),
        createMockTemplate({ name: 'Template B' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.templates).toHaveLength(2);
      expect(result.current.templates[0].name).toBe('Template A');
      expect(result.current.templates[1].name).toBe('Template B');
    });
  });

  describe('isLoading', () => {
    it('returns true when query is pending (undefined)', () => {
      mockUseQuery.mockReturnValue(undefined);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.isLoading).toBe(true);
    });

    it('returns false when query has data', () => {
      mockUseQuery.mockReturnValue([]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.isLoading).toBe(false);
    });

    it('returns false when query returns templates', () => {
      mockUseQuery.mockReturnValue([createMockTemplate()]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('loadedTemplateId state', () => {
    it('starts with undefined', () => {
      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.loadedTemplateId).toBeUndefined();
    });

    it('can be set via setLoadedTemplateId', () => {
      const { result } = renderHook(() => useJobDescriptionTemplates());
      const templateId = 'template_abc123' as JobDescriptionTemplate['_id'];

      act(() => {
        result.current.setLoadedTemplateId(templateId);
      });

      expect(result.current.loadedTemplateId).toBe(templateId);
    });

    it('can be cleared by setting to undefined', () => {
      const { result } = renderHook(() => useJobDescriptionTemplates());
      const templateId = 'template_abc123' as JobDescriptionTemplate['_id'];

      act(() => {
        result.current.setLoadedTemplateId(templateId);
      });
      expect(result.current.loadedTemplateId).toBe(templateId);

      act(() => {
        result.current.setLoadedTemplateId(undefined);
      });
      expect(result.current.loadedTemplateId).toBeUndefined();
    });
  });

  describe('findTemplateByName', () => {
    it('returns template with exact name match', () => {
      const templates = [
        createMockTemplate({ name: 'Software Engineer' }),
        createMockTemplate({ name: 'Product Manager' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());
      const found = result.current.findTemplateByName('Software Engineer');

      expect(found).toBeDefined();
      expect(found?.name).toBe('Software Engineer');
    });

    it('returns template with case-insensitive match', () => {
      const templates = [
        createMockTemplate({ name: 'Software Engineer' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      // Various case combinations
      expect(result.current.findTemplateByName('software engineer')?.name).toBe('Software Engineer');
      expect(result.current.findTemplateByName('SOFTWARE ENGINEER')?.name).toBe('Software Engineer');
      expect(result.current.findTemplateByName('SoFtWaRe EnGiNeEr')?.name).toBe('Software Engineer');
    });

    it('trims whitespace when searching', () => {
      const templates = [
        createMockTemplate({ name: 'Software Engineer' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.findTemplateByName('  Software Engineer  ')?.name).toBe('Software Engineer');
      expect(result.current.findTemplateByName('\tSoftware Engineer\n')?.name).toBe('Software Engineer');
    });

    it('returns undefined when no match found', () => {
      const templates = [
        createMockTemplate({ name: 'Software Engineer' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.findTemplateByName('Data Scientist')).toBeUndefined();
    });

    it('returns undefined when templates array is empty', () => {
      mockUseQuery.mockReturnValue([]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      expect(result.current.findTemplateByName('Any Template')).toBeUndefined();
    });

    it('does not match partial names', () => {
      const templates = [
        createMockTemplate({ name: 'Senior Software Engineer' }),
      ];
      mockUseQuery.mockReturnValue(templates);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      // Partial match should NOT return the template
      expect(result.current.findTemplateByName('Software Engineer')).toBeUndefined();
      expect(result.current.findTemplateByName('Senior')).toBeUndefined();
    });
  });

  describe('loadTemplate', () => {
    it('calls recordUsage mutation and sets loadedTemplateId', async () => {
      const mockRecordUsage = vi.fn().mockResolvedValue(undefined);
      mockUseMutation.mockReturnValue(mockRecordUsage);

      const template = createMockTemplate({ name: 'Test Template' });
      mockUseQuery.mockReturnValue([template]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      await act(async () => {
        await result.current.loadTemplate(template);
      });

      // Should have called the mutation (recordUsage)
      expect(mockRecordUsage).toHaveBeenCalledWith({ id: template._id });

      // Should set the loaded template ID
      await waitFor(() => {
        expect(result.current.loadedTemplateId).toBe(template._id);
      });
    });

    it('sets loadedTemplateId even if recordUsage fails', async () => {
      const mockRecordUsage = vi.fn().mockRejectedValue(new Error('Network error'));
      mockUseMutation.mockReturnValue(mockRecordUsage);

      const template = createMockTemplate({ name: 'Test Template' });
      mockUseQuery.mockReturnValue([template]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      // Should not throw
      await act(async () => {
        await result.current.loadTemplate(template);
      });

      // Should still set the loaded template ID despite error
      expect(result.current.loadedTemplateId).toBe(template._id);
    });
  });

  describe('saveAsNewTemplate', () => {
    it('creates template and sets loadedTemplateId', async () => {
      const newTemplateId = 'template_new123' as JobDescriptionTemplate['_id'];
      const mockCreate = vi.fn().mockResolvedValue(newTemplateId);
      mockUseMutation.mockReturnValue(mockCreate);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      let returnedId: JobDescriptionTemplate['_id'];
      await act(async () => {
        returnedId = await result.current.saveAsNewTemplate('New Template', 'Description');
      });

      expect(returnedId!).toBe(newTemplateId);
      expect(result.current.loadedTemplateId).toBe(newTemplateId);
    });

    it('throws error when create fails', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Template already exists'));
      mockUseMutation.mockReturnValue(mockCreate);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      await expect(
        act(async () => {
          await result.current.saveAsNewTemplate('Existing Template', 'Description');
        })
      ).rejects.toThrow('Template already exists');
    });
  });

  describe('deleteTemplate', () => {
    it('clears loadedTemplateId when deleting the loaded template', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue(mockRemove);

      const template = createMockTemplate();
      mockUseQuery.mockReturnValue([template]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      // Set the loaded template first
      act(() => {
        result.current.setLoadedTemplateId(template._id);
      });
      expect(result.current.loadedTemplateId).toBe(template._id);

      // Delete the loaded template
      await act(async () => {
        await result.current.deleteTemplate(template._id);
      });

      // Should clear the loaded template ID
      expect(result.current.loadedTemplateId).toBeUndefined();
    });

    it('does not clear loadedTemplateId when deleting a different template', async () => {
      const mockRemove = vi.fn().mockResolvedValue({ success: true });
      mockUseMutation.mockReturnValue(mockRemove);

      const template1 = createMockTemplate({ name: 'Template 1' });
      const template2 = createMockTemplate({ name: 'Template 2' });
      mockUseQuery.mockReturnValue([template1, template2]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      // Set template1 as loaded
      act(() => {
        result.current.setLoadedTemplateId(template1._id);
      });

      // Delete template2
      await act(async () => {
        await result.current.deleteTemplate(template2._id);
      });

      // Should still have template1 as loaded
      expect(result.current.loadedTemplateId).toBe(template1._id);
    });
  });

  describe('hardDeleteTemplate', () => {
    it('returns result with clearedReferences count', async () => {
      const mockHardDelete = vi.fn().mockResolvedValue({ success: true, clearedReferences: 5 });
      mockUseMutation.mockReturnValue(mockHardDelete);

      const template = createMockTemplate();
      mockUseQuery.mockReturnValue([template]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      let hardDeleteResult: { success: boolean; clearedReferences: number };
      await act(async () => {
        hardDeleteResult = await result.current.hardDeleteTemplate(template._id);
      });

      expect(hardDeleteResult!.success).toBe(true);
      expect(hardDeleteResult!.clearedReferences).toBe(5);
    });

    it('clears loadedTemplateId when hard deleting the loaded template', async () => {
      const mockHardDelete = vi.fn().mockResolvedValue({ success: true, clearedReferences: 0 });
      mockUseMutation.mockReturnValue(mockHardDelete);

      const template = createMockTemplate();
      mockUseQuery.mockReturnValue([template]);

      const { result } = renderHook(() => useJobDescriptionTemplates());

      act(() => {
        result.current.setLoadedTemplateId(template._id);
      });

      await act(async () => {
        await result.current.hardDeleteTemplate(template._id);
      });

      expect(result.current.loadedTemplateId).toBeUndefined();
    });
  });
});
