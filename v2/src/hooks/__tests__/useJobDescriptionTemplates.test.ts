import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { useJobDescriptionTemplates } from '../useJobDescriptionTemplates';
import type { JobDescriptionTemplate } from '../useJobDescriptionTemplates';

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));
const captureError = vi.fn();
vi.mock('@/lib/sentry', () => ({ captureError: (...a: unknown[]) => captureError(...a) }));

import { useQuery, useMutation } from 'convex/react';

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>;
const mockUseMutation = useMutation as ReturnType<typeof vi.fn>;

const template = (overrides: Partial<JobDescriptionTemplate> = {}): JobDescriptionTemplate => ({
  _id: 'template_a' as JobDescriptionTemplate['_id'],
  name: 'Test Template',
  description: 'Test description',
  usageCount: 0,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('useJobDescriptionTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([]);
    mockUseMutation.mockReturnValue(vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('answers the list, and says it is loading until the query does', () => {
    mockUseQuery.mockReturnValue(undefined);
    const loading = renderHook(() => useJobDescriptionTemplates());
    expect(loading.result.current.isLoading).toBe(true);
    expect(loading.result.current.templates).toEqual([]);
    mockUseQuery.mockReturnValue([template({ name: 'A' }), template({ name: 'B' })]);
    const ready = renderHook(() => useJobDescriptionTemplates());
    expect(ready.result.current.isLoading).toBe(false);
    expect(ready.result.current.templates.map((t) => t.name)).toEqual(['A', 'B']);
  });

  it('records a template being loaded, and never fails the load when the count does', async () => {
    const recordUsage = vi.fn().mockResolvedValue(undefined);
    mockUseMutation.mockReturnValue(recordUsage);
    const { result } = renderHook(() => useJobDescriptionTemplates());
    await act(() => result.current.loadTemplate(template()));
    expect(recordUsage).toHaveBeenCalledWith({ id: 'template_a' });
    recordUsage.mockRejectedValue(new Error('Network error'));
    await act(() => result.current.loadTemplate(template()));
    expect(captureError).toHaveBeenCalledWith(expect.any(Error), { operation: 'recordTemplateUsage' });
  });

  it('saves a new template and answers its id', async () => {
    mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue('template_new'));
    const { result } = renderHook(() => useJobDescriptionTemplates());
    let id: string | undefined;
    await act(async () => {
      id = await result.current.saveAsNewTemplate('New', 'Text');
    });
    expect(id).toBe('template_new');
  });

  it("passes a name already taken back to the editor without reporting it as a fault", async () => {
    mockUseMutation.mockReturnValue(vi.fn().mockRejectedValue(new ConvexError('TEMPLATE_EXISTS:template_a')));
    const { result } = renderHook(() => useJobDescriptionTemplates());
    await expect(act(() => result.current.saveAsNewTemplate('Taken', 'Text'))).rejects.toBeInstanceOf(ConvexError);
    await expect(act(() => result.current.updateTemplate(template()._id, 'Taken', 'Text'))).rejects.toBeInstanceOf(ConvexError);
    expect(captureError).not.toHaveBeenCalled();
  });

  it('reports a real failure and still throws it, for every write', async () => {
    mockUseMutation.mockReturnValue(vi.fn().mockRejectedValue(new Error('Server Error')));
    const { result } = renderHook(() => useJobDescriptionTemplates());
    await expect(act(() => result.current.saveAsNewTemplate('A', 'B'))).rejects.toThrow('Server Error');
    await expect(act(() => result.current.updateTemplate(template()._id, 'A', 'B'))).rejects.toThrow('Server Error');
    await expect(act(() => result.current.hardDeleteTemplate(template()._id))).rejects.toThrow('Server Error');
    expect(captureError).toHaveBeenCalledTimes(3);
  });

  it('answers how many cases a permanent delete cleared', async () => {
    mockUseMutation.mockReturnValue(vi.fn().mockResolvedValue({ success: true, clearedReferences: 5 }));
    const { result } = renderHook(() => useJobDescriptionTemplates());
    let cleared = 0;
    await act(async () => {
      cleared = (await result.current.hardDeleteTemplate(template()._id)).clearedReferences;
    });
    expect(cleared).toBe(5);
  });
});
