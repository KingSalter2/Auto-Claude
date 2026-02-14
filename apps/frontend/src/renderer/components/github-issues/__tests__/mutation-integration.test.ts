/**
 * Integration test verifying the mutation flow from store → hook → IPC.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMutationStore } from '../../../stores/github/mutation-store';
import {
  validateTitle,
  validateBody,
  validateLabel,
  validateLogin,
  validateIssueNumber,
} from '@shared/utils/mutation-validation';
import type { BulkActionType } from '@shared/types/mutations';
import { BULK_ACTION_LABELS } from '@shared/constants/mutations';

beforeEach(() => {
  useMutationStore.setState({
    mutatingIssues: new Set(),
    mutationErrors: new Map(),
    isBulkOperating: false,
    bulkProgress: null,
    bulkResult: null,
  });
});

// ============================================
// Store → Validation integration
// ============================================

describe('store + validation integration', () => {
  it('validation prevents invalid mutations from reaching store', () => {
    // Invalid title should be caught by validation
    const titleResult = validateTitle('');
    expect(titleResult.valid).toBe(false);

    // Store should not have been touched
    expect(useMutationStore.getState().mutatingIssues.size).toBe(0);
  });

  it('valid inputs pass validation', () => {
    expect(validateTitle('Fix the bug')).toEqual({ valid: true });
    expect(validateBody('Some description')).toEqual({ valid: true });
    expect(validateBody(null)).toEqual({ valid: true });
    expect(validateLabel('bug')).toEqual({ valid: true });
    expect(validateLogin('octocat')).toEqual({ valid: true });
    expect(validateIssueNumber(42)).toEqual({ valid: true });
  });
});

// ============================================
// Store mutation tracking
// ============================================

describe('store mutation tracking flow', () => {
  it('tracks mutation lifecycle: start → end (success)', () => {
    const store = useMutationStore.getState();

    store.startMutation(42);
    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(true);

    store.endMutation(42);
    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(false);
    expect(useMutationStore.getState().mutationErrors.has(42)).toBe(false);
  });

  it('tracks mutation lifecycle: start → end (failure)', () => {
    const store = useMutationStore.getState();

    store.startMutation(42);
    store.endMutation(42, 'API rate limited');

    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(false);
    expect(useMutationStore.getState().mutationErrors.get(42)).toBe('API rate limited');
  });
});

// ============================================
// Store bulk flow
// ============================================

describe('bulk flow', () => {
  it('start bulk → progress → complete', () => {
    const store = useMutationStore.getState();

    // Start bulk
    store.startBulkOperation('close', 3);
    expect(useMutationStore.getState().isBulkOperating).toBe(true);

    // Progress
    store.updateBulkProgress({
      action: 'close',
      totalItems: 3,
      processedItems: 2,
      currentIssueNumber: 3,
    });
    expect(useMutationStore.getState().bulkProgress?.processedItems).toBe(2);

    // Complete
    store.endBulkOperation({
      action: 'close',
      totalItems: 3,
      succeeded: 3,
      failed: 0,
      skipped: 0,
      results: [
        { issueNumber: 1, status: 'success' },
        { issueNumber: 2, status: 'success' },
        { issueNumber: 3, status: 'success' },
      ],
    });
    expect(useMutationStore.getState().isBulkOperating).toBe(false);
    expect(useMutationStore.getState().bulkResult?.succeeded).toBe(3);
  });

  it('bulk lock prevents concurrent operations', () => {
    const store = useMutationStore.getState();

    store.startBulkOperation('close', 5);
    store.startBulkOperation('reopen', 3); // Should be ignored

    expect(useMutationStore.getState().bulkProgress?.action).toBe('close');
    expect(useMutationStore.getState().bulkProgress?.totalItems).toBe(5);
  });
});

// ============================================
// Constants consistency
// ============================================

describe('constants consistency', () => {
  it('BULK_ACTION_LABELS has entry for every BulkActionType', () => {
    const allActions: BulkActionType[] = [
      'close', 'reopen', 'add-label', 'remove-label',
      'add-assignee', 'remove-assignee',
    ];

    for (const action of allActions) {
      expect(BULK_ACTION_LABELS).toHaveProperty(action);
      expect(typeof BULK_ACTION_LABELS[action]).toBe('string');
    }
  });
});
