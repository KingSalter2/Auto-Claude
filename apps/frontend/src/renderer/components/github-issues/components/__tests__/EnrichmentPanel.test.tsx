/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnrichmentPanel } from '../EnrichmentPanel';
import { createDefaultEnrichment } from '../../../../../shared/types/enrichment';
import type { IssueEnrichment } from '../../../../../shared/types/enrichment';

function makeEnrichment(overrides?: Partial<IssueEnrichment>): IssueEnrichment {
  return {
    ...createDefaultEnrichment(1),
    ...overrides,
  };
}

describe('EnrichmentPanel', () => {
  it('renders all 6 enrichment section headers', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={() => {}}
      />,
    );

    for (const label of [
      'Problem Statement',
      'Goal',
      'In Scope',
      'Out of Scope',
      'Acceptance Criteria',
      'Technical Context',
    ]) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('shows "Not yet enriched" placeholder for empty sections', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={() => {}}
      />,
    );

    const placeholders = screen.getAllByText('Not yet enriched');
    expect(placeholders.length).toBe(6);
  });

  it('renders enrichment content when provided', () => {
    const enrichment = makeEnrichment({
      enrichment: {
        problem: 'Users cannot log in',
        goal: 'Fix login flow',
        scopeIn: 'Authentication module',
        scopeOut: 'Registration',
        acceptanceCriteria: ['Login works', 'Tests pass'],
        technicalContext: 'OAuth2 based',
        risksEdgeCases: '',
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={65}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByText('Users cannot log in')).toBeDefined();
    expect(screen.getByText('Fix login flow')).toBeDefined();
  });

  it('renders workflow state dropdown', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: 'Change workflow state' })).toBeDefined();
  });

  it('renders priority when set', () => {
    const enrichment = makeEnrichment({ priority: 1 });
    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={40}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByText('P1')).toBeDefined();
  });

  it('renders "No priority" when not set', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByText('No priority')).toBeDefined();
  });

  it('renders completeness score', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={75}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.getByText('Completeness')).toBeDefined();
  });

  it('has aria-live="polite" for state change area', () => {
    const { container } = render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={() => {}}
      />,
    );

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('renders array acceptance criteria joined by newlines', () => {
    const enrichment = makeEnrichment({
      enrichment: {
        problem: '',
        goal: '',
        scopeIn: '',
        scopeOut: '',
        acceptanceCriteria: ['Login works', 'Tests pass'],
        technicalContext: '',
        risksEdgeCases: '',
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={25}
        onTransition={() => {}}
      />,
    );

    expect(screen.getByText(/Login works/)).toBeDefined();
    expect(screen.getByText(/Tests pass/)).toBeDefined();
  });
});
