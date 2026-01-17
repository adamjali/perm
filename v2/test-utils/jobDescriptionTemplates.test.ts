/**
 * Job Description Templates Tests
 *
 * Tests for CRUD operations on job description templates.
 * Templates are user-scoped and identified by position title (name).
 */

import { describe, it, expect } from 'vitest';
import { createTestContext, createAuthenticatedContext } from './convex';
import { api } from '../convex/_generated/api';
import type { Id } from '../convex/_generated/dataModel';

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

interface TemplateData {
  name?: string;
  description?: string;
  usageCount?: number;
  deletedAt?: number;
}

/**
 * Create a test template with sensible defaults.
 * Reduces boilerplate in test setup.
 *
 * @param auth - The authenticated context (created by createAuthenticatedContext)
 * @param overrides - Optional overrides for template fields
 * @returns The created template ID
 */
async function createTestTemplate(
  auth: Awaited<ReturnType<typeof createAuthenticatedContext>>,
  overrides: TemplateData = {}
): Promise<Id<"jobDescriptionTemplates">> {
  return auth.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert('jobDescriptionTemplates', {
      userId: auth.userId,
      name: overrides.name ?? 'Test Template',
      description: overrides.description ?? 'Test description content',
      usageCount: overrides.usageCount ?? 0,
      createdAt: now,
      updatedAt: now,
      ...(overrides.deletedAt !== undefined && { deletedAt: overrides.deletedAt }),
    });
  });
}

describe('jobDescriptionTemplates', () => {
  describe('list', () => {
    it('returns empty array when user has no templates', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templates = await auth.query(api.jobDescriptionTemplates.list, {});

      expect(templates).toEqual([]);
    });

    it('returns only templates owned by the current user', async () => {
      const t = createTestContext();
      const auth1 = await createAuthenticatedContext(t, 'User 1');
      const auth2 = await createAuthenticatedContext(t, 'User 2');

      // Create templates for each user
      await auth1.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth1.userId,
          name: 'User 1 Template',
          description: 'Description for user 1',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await auth2.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth2.userId,
          name: 'User 2 Template',
          description: 'Description for user 2',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // User 1 should only see their template
      const user1Templates = await auth1.query(api.jobDescriptionTemplates.list, {});
      expect(user1Templates).toHaveLength(1);
      expect(user1Templates[0].name).toBe('User 1 Template');

      // User 2 should only see their template
      const user2Templates = await auth2.query(api.jobDescriptionTemplates.list, {});
      expect(user2Templates).toHaveLength(1);
      expect(user2Templates[0].name).toBe('User 2 Template');
    });

    it('excludes soft-deleted templates', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      // Create templates - one active, one deleted
      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Active Template',
          description: 'Active description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Deleted Template',
          description: 'Deleted description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: Date.now(), // Soft deleted
        });
      });

      const templates = await auth.query(api.jobDescriptionTemplates.list, {});
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe('Active Template');
    });

    it('returns templates sorted by name alphabetically', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      // Create templates in non-alphabetical order
      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Zebra Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Alpha Developer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Middle Manager',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const templates = await auth.query(api.jobDescriptionTemplates.list, {});
      expect(templates).toHaveLength(3);
      expect(templates.map((t: { name: string }) => t.name)).toEqual([
        'Alpha Developer',
        'Middle Manager',
        'Zebra Engineer',
      ]);
    });
  });

  describe('get', () => {
    it('returns template by ID', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.run(async (ctx) => {
        return await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Test Template',
          description: 'Test description',
          usageCount: 5,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template).toBeDefined();
      expect(template?.name).toBe('Test Template');
      expect(template?.description).toBe('Test description');
      expect(template?.usageCount).toBe(5);
    });

    it('returns null for template owned by another user', async () => {
      const t = createTestContext();
      const auth1 = await createAuthenticatedContext(t, 'User 1');
      const auth2 = await createAuthenticatedContext(t, 'User 2');

      // Create template for user 1
      const templateId = await auth1.run(async (ctx) => {
        return await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth1.userId,
          name: 'User 1 Template',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // User 2 should not be able to access user 1's template
      const template = await auth2.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template).toBeNull();
    });

    it('returns null for deleted template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.run(async (ctx) => {
        return await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Deleted Template',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: Date.now(),
        });
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template).toBeNull();
    });
  });

  describe('searchByName', () => {
    it('returns templates matching search query', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Software Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Data Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Product Manager',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const results = await auth.query(api.jobDescriptionTemplates.searchByName, {
        query: 'engineer',
      });

      expect(results).toHaveLength(2);
      expect(results.map((r: { name: string }) => r.name).sort()).toEqual([
        'Data Engineer',
        'Software Engineer',
      ]);
    });

    it('prioritizes exact matches', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Senior Software Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Software Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const results = await auth.query(api.jobDescriptionTemplates.searchByName, {
        query: 'Software Engineer',
      });

      expect(results).toHaveLength(2);
      // Exact match should be first
      expect(results[0].name).toBe('Software Engineer');
    });

    it('returns empty array for empty query', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const results = await auth.query(api.jobDescriptionTemplates.searchByName, {
        query: '',
      });

      expect(results).toEqual([]);
    });
  });

  describe('findByExactName', () => {
    it('returns template with exact name match (case-insensitive)', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Software Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Exact match
      const result1 = await auth.query(api.jobDescriptionTemplates.findByExactName, {
        name: 'Software Engineer',
      });
      expect(result1).toBeDefined();
      expect(result1?.name).toBe('Software Engineer');

      // Case-insensitive match
      const result2 = await auth.query(api.jobDescriptionTemplates.findByExactName, {
        name: 'software engineer',
      });
      expect(result2).toBeDefined();
      expect(result2?.name).toBe('Software Engineer');
    });

    it('returns null when no exact match found', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.run(async (ctx) => {
        await ctx.db.insert('jobDescriptionTemplates', {
          userId: auth.userId,
          name: 'Software Engineer',
          description: 'Description',
          usageCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await auth.query(api.jobDescriptionTemplates.findByExactName, {
        name: 'Senior Software Engineer',
      });

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates a new template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'New Template',
        description: 'New description',
      });

      expect(templateId).toBeDefined();

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template?.name).toBe('New Template');
      expect(template?.description).toBe('New description');
      expect(template?.usageCount).toBe(0);
    });

    it('trims whitespace from name and description', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: '  Template Name  ',
        description: '  Description with spaces  ',
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template?.name).toBe('Template Name');
      expect(template?.description).toBe('Description with spaces');
    });

    it('throws error for empty name', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await expect(
        auth.mutation(api.jobDescriptionTemplates.create, {
          name: '',
          description: 'Description',
        })
      ).rejects.toThrow(/name.*required/i);
    });

    it('throws error for empty description', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await expect(
        auth.mutation(api.jobDescriptionTemplates.create, {
          name: 'Template',
          description: '',
        })
      ).rejects.toThrow(/description.*required/i);
    });

    it('throws error for duplicate name (case-insensitive)', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Software Engineer',
        description: 'First template',
      });

      await expect(
        auth.mutation(api.jobDescriptionTemplates.create, {
          name: 'software engineer', // Same name, different case
          description: 'Second template',
        })
      ).rejects.toThrow(/already exists/i);
    });
  });

  describe('update', () => {
    it('updates template name and description', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Original Name',
        description: 'Original description',
      });

      await auth.mutation(api.jobDescriptionTemplates.update, {
        id: templateId,
        name: 'Updated Name',
        description: 'Updated description',
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template?.name).toBe('Updated Name');
      expect(template?.description).toBe('Updated description');
    });

    it('throws error for empty name', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template',
        description: 'Description',
      });

      await expect(
        auth.mutation(api.jobDescriptionTemplates.update, {
          id: templateId,
          name: '',
          description: 'Description',
        })
      ).rejects.toThrow(/name.*required/i);
    });

    it('throws error for duplicate name when renaming', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template A',
        description: 'Description A',
      });

      const templateBId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template B',
        description: 'Description B',
      });

      await expect(
        auth.mutation(api.jobDescriptionTemplates.update, {
          id: templateBId,
          name: 'Template A', // Trying to rename to existing name
          description: 'Description B',
        })
      ).rejects.toThrow(/already exists/i);
    });

    it('allows keeping the same name when updating', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template',
        description: 'Original description',
      });

      // Update with same name should work
      await auth.mutation(api.jobDescriptionTemplates.update, {
        id: templateId,
        name: 'Template',
        description: 'Updated description',
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template?.description).toBe('Updated description');
    });
  });

  describe('remove', () => {
    it('soft deletes template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template to Delete',
        description: 'Description',
      });

      await auth.mutation(api.jobDescriptionTemplates.remove, {
        id: templateId,
      });

      // Template should not be returned in queries
      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });
      expect(template).toBeNull();

      // But should still exist in database with deletedAt set
      const rawTemplate = await auth.run(async (ctx) => {
        return await ctx.db.get(templateId);
      });
      expect(rawTemplate).toBeDefined();
      expect(rawTemplate?.deletedAt).toBeDefined();
    });

    it('throws error when deleting already deleted template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template',
        description: 'Description',
      });

      await auth.mutation(api.jobDescriptionTemplates.remove, {
        id: templateId,
      });

      await expect(
        auth.mutation(api.jobDescriptionTemplates.remove, {
          id: templateId,
        })
      ).rejects.toThrow(/already deleted/i);
    });
  });

  describe('recordUsage', () => {
    it('increments usage count', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template',
        description: 'Description',
      });

      // Record usage multiple times
      await auth.mutation(api.jobDescriptionTemplates.recordUsage, {
        id: templateId,
      });
      await auth.mutation(api.jobDescriptionTemplates.recordUsage, {
        id: templateId,
      });
      await auth.mutation(api.jobDescriptionTemplates.recordUsage, {
        id: templateId,
      });

      const template = await auth.query(api.jobDescriptionTemplates.get, {
        id: templateId,
      });

      expect(template?.usageCount).toBe(3);
      expect(template?.lastUsedAt).toBeDefined();
    });

    it('throws error when recording usage of deleted template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await auth.mutation(api.jobDescriptionTemplates.create, {
        name: 'Template',
        description: 'Description',
      });

      await auth.mutation(api.jobDescriptionTemplates.remove, {
        id: templateId,
      });

      await expect(
        auth.mutation(api.jobDescriptionTemplates.recordUsage, {
          id: templateId,
        })
      ).rejects.toThrow(/deleted/i);
    });
  });

  describe('hardDelete', () => {
    it('permanently deletes template from database', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await createTestTemplate(auth, {
        name: 'Template to Hard Delete',
      });

      // Verify template exists
      const beforeDelete = await auth.run(async (ctx) => ctx.db.get(templateId));
      expect(beforeDelete).toBeDefined();

      // Hard delete
      const result = await auth.mutation(api.jobDescriptionTemplates.hardDelete, {
        id: templateId,
      });

      expect(result.success).toBe(true);
      expect(result.clearedReferences).toBe(0);

      // Template should be completely gone from database
      const afterDelete = await auth.run(async (ctx) => ctx.db.get(templateId));
      expect(afterDelete).toBeNull();
    });

    it('clears jobDescriptionTemplateId from cases using the template', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      // Create a template
      const templateId = await createTestTemplate(auth, {
        name: 'Template for Cases',
      });

      // Create cases that reference this template
      const caseIds = await auth.run(async (ctx) => {
        const now = Date.now();
        const caseDefaults = {
          userId: auth.userId,
          employerName: 'Test Employer',
          positionTitle: 'Software Engineer',
          caseStatus: 'pwd' as const,
          progressStatus: 'working' as const,
          jobDescriptionTemplateId: templateId,
          additionalRecruitmentMethods: [],
          recruitmentApplicantsCount: 0,
          isProfessionalOccupation: false,
          priorityLevel: 'normal' as const,
          isFavorite: false,
          tags: [],
          calendarSyncEnabled: false,
          documents: [],
          createdAt: now,
          updatedAt: now,
        };
        const case1 = await ctx.db.insert('cases', caseDefaults);
        const case2 = await ctx.db.insert('cases', caseDefaults);
        return [case1, case2];
      });

      // Hard delete the template
      const result = await auth.mutation(api.jobDescriptionTemplates.hardDelete, {
        id: templateId,
      });

      expect(result.success).toBe(true);
      expect(result.clearedReferences).toBe(2);

      // Verify template references are cleared from cases
      for (const caseId of caseIds) {
        const caseDoc = await auth.run(async (ctx) => ctx.db.get(caseId));
        expect(caseDoc).toBeDefined();
        expect(caseDoc?.jobDescriptionTemplateId).toBeUndefined();
      }
    });

    it('returns correct clearedReferences count', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      const templateId = await createTestTemplate(auth);

      // Create 3 cases with this template
      await auth.run(async (ctx) => {
        const now = Date.now();
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert('cases', {
            userId: auth.userId,
            employerName: 'Test Employer',
            positionTitle: 'Engineer',
            caseStatus: 'pwd' as const,
            progressStatus: 'working' as const,
            jobDescriptionTemplateId: templateId,
            additionalRecruitmentMethods: [],
            recruitmentApplicantsCount: 0,
            isProfessionalOccupation: false,
            priorityLevel: 'normal' as const,
            isFavorite: false,
            tags: [],
            calendarSyncEnabled: false,
            documents: [],
            createdAt: now,
            updatedAt: now,
          });
        }
      });

      const result = await auth.mutation(api.jobDescriptionTemplates.hardDelete, {
        id: templateId,
      });

      expect(result.clearedReferences).toBe(3);
    });

    it('throws error when template not found', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      // Create and then delete a template to get a valid but non-existent ID
      const templateId = await createTestTemplate(auth);
      await auth.run(async (ctx) => ctx.db.delete(templateId));

      await expect(
        auth.mutation(api.jobDescriptionTemplates.hardDelete, {
          id: templateId,
        })
      ).rejects.toThrow(/not found/i);
    });

    it('throws error when user does not own template', async () => {
      const t = createTestContext();
      const auth1 = await createAuthenticatedContext(t, 'User 1');
      const auth2 = await createAuthenticatedContext(t, 'User 2');

      // User 1 creates a template
      const templateId = await createTestTemplate(auth1, {
        name: 'User 1 Template',
      });

      // User 2 tries to hard delete it
      await expect(
        auth2.mutation(api.jobDescriptionTemplates.hardDelete, {
          id: templateId,
        })
      ).rejects.toThrow();
    });

    it('works on soft-deleted templates', async () => {
      const t = createTestContext();
      const auth = await createAuthenticatedContext(t);

      // Create a template using the factory
      const templateId = await createTestTemplate(auth, {
        name: 'Soft Deleted Template',
      });

      // Soft delete it first
      await auth.mutation(api.jobDescriptionTemplates.remove, {
        id: templateId,
      });

      // Should still be in database
      const afterSoftDelete = await auth.run(async (ctx) => ctx.db.get(templateId));
      expect(afterSoftDelete).toBeDefined();
      expect(afterSoftDelete?.deletedAt).toBeDefined();

      // Hard delete should still work
      const result = await auth.mutation(api.jobDescriptionTemplates.hardDelete, {
        id: templateId,
      });

      expect(result.success).toBe(true);

      // Now it should be gone
      const afterHardDelete = await auth.run(async (ctx) => ctx.db.get(templateId));
      expect(afterHardDelete).toBeNull();
    });
  });
});
