/**
 * Tests for Implementation Plan Schema
 *
 * Verifies that Zod coercion handles common LLM field name variations
 * so plans from different models all validate successfully.
 */

import { describe, it, expect } from 'vitest';
import { ImplementationPlanSchema, PlanSubtaskSchema, PlanPhaseSchema } from '../implementation-plan';

describe('PlanSubtaskSchema', () => {
  it('validates a canonical subtask', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Create the API endpoint',
      status: 'pending',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('1.1');
      expect(result.data.description).toBe('Create the API endpoint');
      expect(result.data.status).toBe('pending');
    }
  });

  it('coerces "title" to "description"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      title: 'Create canonical allowlist',
      status: 'pending',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Create canonical allowlist');
    }
  });

  it('coerces "name" to "description"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      name: 'Setup database',
      status: 'pending',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe('Setup database');
    }
  });

  it('coerces "subtask_id" to "id"', () => {
    const result = PlanSubtaskSchema.safeParse({
      subtask_id: 'subtask-1-1',
      description: 'Test something',
      status: 'pending',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('subtask-1-1');
    }
  });

  it('normalizes "done" status to "completed"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Task',
      status: 'done',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('completed');
    }
  });

  it('normalizes "todo" status to "pending"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Task',
      status: 'todo',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('defaults missing status to "pending"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Task',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('coerces "file_paths" to "files_to_modify"', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Task',
      status: 'pending',
      file_paths: ['src/main.ts'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files_to_modify).toEqual(['src/main.ts']);
    }
  });

  it('fails when both id and description are missing', () => {
    const result = PlanSubtaskSchema.safeParse({
      status: 'pending',
    });
    expect(result.success).toBe(false);
  });

  it('preserves unknown fields via passthrough', () => {
    const result = PlanSubtaskSchema.safeParse({
      id: '1.1',
      description: 'Task',
      status: 'pending',
      deliverable: 'A working feature',
      details: ['step 1', 'step 2'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).deliverable).toBe('A working feature');
    }
  });
});

describe('PlanPhaseSchema', () => {
  const validSubtask = { id: '1.1', description: 'Task', status: 'pending' };

  it('validates a canonical phase', () => {
    const result = PlanPhaseSchema.safeParse({
      id: 'phase-1',
      name: 'Backend API',
      subtasks: [validSubtask],
    });
    expect(result.success).toBe(true);
  });

  it('coerces "title" to "name"', () => {
    const result = PlanPhaseSchema.safeParse({
      id: 'phase-1',
      title: 'Backend API',
      subtasks: [validSubtask],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Backend API');
    }
  });

  it('coerces phase number to id', () => {
    const result = PlanPhaseSchema.safeParse({
      phase: 1,
      name: 'Backend',
      subtasks: [validSubtask],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('1');
    }
  });

  it('coerces "chunks" to "subtasks"', () => {
    const result = PlanPhaseSchema.safeParse({
      id: 'phase-1',
      name: 'Backend',
      chunks: [validSubtask],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subtasks).toHaveLength(1);
    }
  });

  it('fails when subtasks is empty', () => {
    const result = PlanPhaseSchema.safeParse({
      id: 'phase-1',
      name: 'Backend',
      subtasks: [],
    });
    expect(result.success).toBe(false);
  });

  it('fails when neither id nor phase is present', () => {
    const result = PlanPhaseSchema.safeParse({
      name: 'Backend',
      subtasks: [validSubtask],
    });
    // coercePhase should produce id=undefined and phase=undefined
    // The refine check should fail
    expect(result.success).toBe(false);
  });
});

describe('ImplementationPlanSchema', () => {
  const validPlan = {
    feature: 'Add user auth',
    workflow_type: 'feature',
    phases: [
      {
        id: 'phase-1',
        name: 'Backend',
        subtasks: [
          { id: '1.1', description: 'Create model', status: 'pending' },
        ],
      },
    ],
  };

  it('validates a canonical plan', () => {
    const result = ImplementationPlanSchema.safeParse(validPlan);
    expect(result.success).toBe(true);
  });

  it('validates a plan with LLM field variations (title, subtask_id, done status)', () => {
    const llmPlan = {
      title: 'Restrict web access',
      type: 'feature',
      phases: [
        {
          phase: 1,
          name: 'Define route policy',
          objective: 'Establish allowlist',
          subtasks: [
            {
              id: '1.1',
              title: 'Create canonical allowlist',
              details: ['Page routes', 'Metadata routes'],
              deliverable: 'Documented allowlist',
              status: 'completed',
              completed_at: '2026-02-26T12:35:32.451Z',
            },
            {
              id: '1.2',
              title: 'Define deny behavior',
              status: 'done',
            },
          ],
        },
      ],
    };

    const result = ImplementationPlanSchema.safeParse(llmPlan);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feature).toBe('Restrict web access');
      expect(result.data.workflow_type).toBe('feature');
      const subtask = result.data.phases[0].subtasks[0];
      expect(subtask.description).toBe('Create canonical allowlist');
      expect(result.data.phases[0].subtasks[1].status).toBe('completed');
    }
  });

  it('coerces "title" to "feature" at top level', () => {
    const result = ImplementationPlanSchema.safeParse({
      title: 'My Feature',
      phases: [
        {
          id: 'p1',
          name: 'Phase 1',
          subtasks: [{ id: '1', description: 'Task', status: 'pending' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feature).toBe('My Feature');
    }
  });

  it('fails when phases is missing', () => {
    const result = ImplementationPlanSchema.safeParse({
      feature: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('fails when phases is empty', () => {
    const result = ImplementationPlanSchema.safeParse({
      feature: 'Test',
      phases: [],
    });
    expect(result.success).toBe(false);
  });
});
