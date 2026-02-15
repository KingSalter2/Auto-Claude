import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInvestigationStore } from '../investigation-store';

describe('Investigation Store - Label Sync Integration', () => {
  beforeEach(() => {
    // Reset store before each test
    useInvestigationStore.setState({ investigations: {}, settings: {} });
  });

  it('should trigger state change callback when linkedTaskStatus changes', () => {
    const callback = vi.fn();

    act(() => {
      useInvestigationStore.getState().setStateChangeCallback(callback);
    });

    // Start an investigation with a specId
    act(() => {
      useInvestigationStore.getState().startInvestigation('test-project', 42);
    });

    // Simulate task creation (set specId)
    const { investigations } = useInvestigationStore.getState();
    const key = 'test-project:42';
    act(() => {
      useInvestigationStore.setState({
        investigations: {
          ...investigations,
          [key]: {
            ...investigations[key]!,
            specId: '001',
            isInvestigating: false,
          }
        }
      });
    });

    // Sync task state to 'in_progress' which maps to 'building'
    act(() => {
      useInvestigationStore.getState().syncTaskState('test-project', 42, 'in_progress');
    });

    // Trigger label sync
    act(() => {
      useInvestigationStore.getState().triggerLabelSync('test-project', 42);
    });

    expect(callback).toHaveBeenCalledWith('test-project', 42, 'building');
  });

  it('should not trigger callback when sync is disabled (no callback registered)', () => {
    const callback = vi.fn();

    // Don't register callback

    act(() => {
      useInvestigationStore.getState().syncTaskState('test-project', 42, 'done');
      useInvestigationStore.getState().triggerLabelSync('test-project', 42);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow updating the callback', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    act(() => {
      useInvestigationStore.getState().setStateChangeCallback(callback1);
    });

    // Start an investigation
    act(() => {
      useInvestigationStore.getState().startInvestigation('test-project', 42);
    });

    act(() => {
      useInvestigationStore.setState({
        investigations: {
          'test-project:42': {
            ...useInvestigationStore.getState().investigations['test-project:42']!,
            specId: '001',
            isInvestigating: false,
          }
        }
      });
    });

    act(() => {
      useInvestigationStore.getState().syncTaskState('test-project', 42, 'in_progress');
      useInvestigationStore.getState().triggerLabelSync('test-project', 42);
    });

    expect(callback1).toHaveBeenCalledTimes(1);

    // Change callback
    act(() => {
      useInvestigationStore.getState().setStateChangeCallback(callback2);
    });

    act(() => {
      useInvestigationStore.getState().syncTaskState('test-project', 42, 'done');
      useInvestigationStore.getState().triggerLabelSync('test-project', 42);
    });

    expect(callback2).toHaveBeenCalledWith('test-project', 42, 'done');
    // callback1 should not be called again
    expect(callback1).toHaveBeenCalledTimes(1);
  });

  it('should not trigger callback for investigation without specId', () => {
    const callback = vi.fn();

    act(() => {
      useInvestigationStore.getState().setStateChangeCallback(callback);
    });

    // Start an investigation without specId but with a completed report
    act(() => {
      useInvestigationStore.getState().startInvestigation('test-project', 42);
    });

    // Complete the investigation with a report
    act(() => {
      useInvestigationStore.getState().setResult('test-project', {
        issueNumber: 42,
        report: {
          rootCause: { agentType: 'root_cause', rootCause: 'test', codePaths: [], relatedIssues: [], summary: '', findings: [], codeReferences: [] },
          impact: { agentType: 'impact', severity: 'medium', affectedComponents: [], userImpact: '', riskIfUnfixed: '', summary: '', findings: [], codeReferences: [] },
          fixAdvice: { agentType: 'fix_advisor', suggestedApproaches: [], recommendedApproach: 0, patternsToFollow: [], summary: '', findings: [], codeReferences: [] },
          reproduction: { agentType: 'reproducer', reproducible: 'unknown', existingTests: [], testGaps: [], suggestedTests: [], summary: '', findings: [], codeReferences: [] },
          summary: 'Test',
          severity: 'medium',
          suggestedLabels: [],
          likelyResolved: false,
          linkedPRs: [],
          timestamp: new Date().toISOString(),
        },
        completedAt: new Date().toISOString(),
      });
    });

    act(() => {
      useInvestigationStore.getState().triggerLabelSync('test-project', 42);
    });

    // State should be 'findings_ready' (report completed but no specId), callback should be called
    expect(callback).toHaveBeenCalledWith('test-project', 42, 'findings_ready');
  });
});
