import { useCallback, useMemo } from 'react';
import { useMutationStore } from '../../../stores/github/mutation-store';
import { useIssuesStore } from '../../../stores/github/issues-store';
import { validateTitle, validateBody } from '@shared/utils/mutation-validation';
import type { MutationResult } from '@shared/types/mutations';

export function useMutations(projectId: string) {
  const startMutation = useMutationStore((s) => s.startMutation);
  const endMutation = useMutationStore((s) => s.endMutation);

  const updateIssue = useIssuesStore.getState().updateIssue;

  const editTitle = useCallback(async (issueNumber: number, title: string): Promise<MutationResult> => {
    const validation = validateTitle(title);
    if (!validation.valid) return { success: false, issueNumber, error: validation.error };

    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.editIssueTitle(projectId, issueNumber, title);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) updateIssue(issueNumber, { title });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const editBody = useCallback(async (issueNumber: number, body: string | null): Promise<MutationResult> => {
    const validation = validateBody(body);
    if (!validation.valid) return { success: false, issueNumber, error: validation.error };

    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.editIssueBody(projectId, issueNumber, body);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) updateIssue(issueNumber, { body: body ?? undefined });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const closeIssue = useCallback(async (issueNumber: number): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.closeIssue(projectId, issueNumber);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) updateIssue(issueNumber, { state: 'closed' });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const reopenIssue = useCallback(async (issueNumber: number): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.reopenIssue(projectId, issueNumber);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) updateIssue(issueNumber, { state: 'open' });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const addComment = useCallback(async (issueNumber: number, body: string): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueComment(projectId, issueNumber, body);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) {
        const issue = useIssuesStore.getState().issues.find(i => i.number === issueNumber);
        if (issue) updateIssue(issueNumber, { commentsCount: issue.commentsCount + 1 });
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const addLabels = useCallback(async (issueNumber: number, labels: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueLabels(projectId, issueNumber, labels);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) {
        const issue = useIssuesStore.getState().issues.find(i => i.number === issueNumber);
        if (issue) {
          const existing = issue.labels.map(l => l.name);
          const newLabels = labels.filter(l => !existing.includes(l));
          updateIssue(issueNumber, {
            labels: [...issue.labels, ...newLabels.map(name => ({ id: 0, name, color: '000000' }))],
          });
        }
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const removeLabels = useCallback(async (issueNumber: number, labels: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.removeIssueLabels(projectId, issueNumber, labels);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) {
        const issue = useIssuesStore.getState().issues.find(i => i.number === issueNumber);
        if (issue) {
          updateIssue(issueNumber, {
            labels: issue.labels.filter(l => !labels.includes(l.name)),
          });
        }
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const addAssignees = useCallback(async (issueNumber: number, assignees: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.addIssueAssignees(projectId, issueNumber, assignees);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) {
        const issue = useIssuesStore.getState().issues.find(i => i.number === issueNumber);
        if (issue) {
          const existing = issue.assignees.map(a => a.login);
          const newAssignees = assignees.filter(a => !existing.includes(a));
          updateIssue(issueNumber, {
            assignees: [...issue.assignees, ...newAssignees.map(login => ({ login }))],
          });
        }
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const removeAssignees = useCallback(async (issueNumber: number, assignees: string[]): Promise<MutationResult> => {
    startMutation(issueNumber);
    try {
      const result = await window.electronAPI.github.removeIssueAssignees(projectId, issueNumber, assignees);
      endMutation(issueNumber, result.success ? undefined : result.error);
      if (result.success) {
        const issue = useIssuesStore.getState().issues.find(i => i.number === issueNumber);
        if (issue) {
          updateIssue(issueNumber, {
            assignees: issue.assignees.filter(a => !assignees.includes(a.login)),
          });
        }
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      endMutation(issueNumber, error);
      return { success: false, issueNumber, error };
    }
  }, [projectId, startMutation, endMutation, updateIssue]);

  const isMutating = useCallback(
    (issueNumber: number) => useMutationStore.getState().mutatingIssues.has(issueNumber),
    [],
  );

  return useMemo(() => ({
    editTitle,
    editBody,
    closeIssue,
    reopenIssue,
    addComment,
    addLabels,
    removeLabels,
    addAssignees,
    removeAssignees,
    isMutating,
  }), [editTitle, editBody, closeIssue, reopenIssue, addComment, addLabels, removeLabels, addAssignees, removeAssignees, isMutating]);
}
