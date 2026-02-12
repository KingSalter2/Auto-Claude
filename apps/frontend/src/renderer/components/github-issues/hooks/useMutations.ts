import { useCallback } from 'react';
import { useMutationStore } from '../../../stores/github/mutation-store';
import { validateTitle, validateBody } from '../../../../shared/utils/mutation-validation';
import type { MutationResult } from '../../../../shared/types/mutations';

export function useMutations(projectId: string) {
  const { startMutation, endMutation } = useMutationStore();

  const editTitle = useCallback(async (issueNumber: number, title: string): Promise<MutationResult> => {
    const validation = validateTitle(title);
    if (!validation.valid) return { success: false, issueNumber, error: validation.error };

    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.editIssueTitle(projectId, issueNumber, title);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const editBody = useCallback(async (issueNumber: number, body: string | null): Promise<MutationResult> => {
    const validation = validateBody(body);
    if (!validation.valid) return { success: false, issueNumber, error: validation.error };

    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.editIssueBody(projectId, issueNumber, body);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const closeIssue = useCallback(async (issueNumber: number): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.closeIssue(projectId, issueNumber);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const reopenIssue = useCallback(async (issueNumber: number): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.reopenIssue(projectId, issueNumber);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const addComment = useCallback(async (issueNumber: number, body: string): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueComment(projectId, issueNumber, body);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const addLabels = useCallback(async (issueNumber: number, labels: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueLabels(projectId, issueNumber, labels);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const removeLabels = useCallback(async (issueNumber: number, labels: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.removeIssueLabels(projectId, issueNumber, labels);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const addAssignees = useCallback(async (issueNumber: number, assignees: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueAssignees(projectId, issueNumber, assignees);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  const removeAssignees = useCallback(async (issueNumber: number, assignees: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.removeIssueAssignees(projectId, issueNumber, assignees);
      endMutation(issueNumber, result.success ? undefined : result.error);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation]);

  return {
    editTitle,
    editBody,
    closeIssue,
    reopenIssue,
    addComment,
    addLabels,
    removeLabels,
    addAssignees,
    removeAssignees,
    isMutating: (issueNumber: number) => useMutationStore.getState().mutatingIssues.has(issueNumber),
  };
}
