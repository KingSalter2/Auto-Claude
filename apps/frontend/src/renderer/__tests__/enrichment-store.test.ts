import { describe, it, expect, beforeEach } from 'vitest';
import { useEnrichmentStore } from '../stores/github/enrichment-store';
import { createDefaultEnrichment } from '../../shared/types/enrichment';
import type { IssueEnrichment } from '../../shared/types/enrichment';

beforeEach(() => {
  useEnrichmentStore.setState({
    enrichments: {},
    isLoaded: false,
    isLoading: false,
    error: null,
  });
});

describe('enrichment store actions', () => {
  it('setEnrichments sets enrichments and marks loaded', () => {
    const enrichment = createDefaultEnrichment(42);
    useEnrichmentStore.getState().setEnrichments({ '42': enrichment });

    const state = useEnrichmentStore.getState();
    expect(state.enrichments['42'].issueNumber).toBe(42);
    expect(state.isLoaded).toBe(true);
  });

  it('setEnrichment sets a single enrichment', () => {
    const enrichment = createDefaultEnrichment(42);
    useEnrichmentStore.getState().setEnrichment(42, enrichment);

    expect(useEnrichmentStore.getState().enrichments['42'].issueNumber).toBe(42);
  });

  it('removeEnrichment removes a single enrichment', () => {
    const enrichment = createDefaultEnrichment(42);
    useEnrichmentStore.getState().setEnrichment(42, enrichment);
    useEnrichmentStore.getState().removeEnrichment(42);

    expect(useEnrichmentStore.getState().enrichments['42']).toBeUndefined();
  });

  it('clearEnrichment resets all state', () => {
    const enrichment = createDefaultEnrichment(42);
    useEnrichmentStore.getState().setEnrichments({ '42': enrichment });
    useEnrichmentStore.getState().clearEnrichment();

    const state = useEnrichmentStore.getState();
    expect(state.enrichments).toEqual({});
    expect(state.isLoaded).toBe(false);
  });

  it('setLoading updates loading state', () => {
    useEnrichmentStore.getState().setLoading(true);
    expect(useEnrichmentStore.getState().isLoading).toBe(true);
  });

  it('setError updates error state', () => {
    useEnrichmentStore.getState().setError('test error');
    expect(useEnrichmentStore.getState().error).toBe('test error');
  });
});

describe('enrichment store selectors', () => {
  it('getEnrichment returns enrichment for existing issue', () => {
    const enrichment = createDefaultEnrichment(42);
    useEnrichmentStore.getState().setEnrichment(42, enrichment);

    expect(useEnrichmentStore.getState().getEnrichment(42)?.issueNumber).toBe(42);
  });

  it('getEnrichment returns null for non-existent issue', () => {
    expect(useEnrichmentStore.getState().getEnrichment(99)).toBeNull();
  });

  it('getEnrichmentsByState returns matching enrichments', () => {
    const e1 = { ...createDefaultEnrichment(1), triageState: 'new' } as IssueEnrichment;
    const e2 = { ...createDefaultEnrichment(2), triageState: 'triage' } as IssueEnrichment;
    const e3 = { ...createDefaultEnrichment(3), triageState: 'new' } as IssueEnrichment;

    useEnrichmentStore.getState().setEnrichments({
      '1': e1,
      '2': e2,
      '3': e3,
    });

    const newOnes = useEnrichmentStore.getState().getEnrichmentsByState('new');
    expect(newOnes).toHaveLength(2);
  });

});
