/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnrichmentPanel } from '../EnrichmentPanel';
import { createDefaultEnrichment } from '../../../../../shared/types/enrichment';
import type { IssueEnrichment } from '../../../../../shared/types/enrichment';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeEnrichment(overrides?: Partial<IssueEnrichment>): IssueEnrichment {
  return {
    ...createDefaultEnrichment(1),
    ...overrides,
  };
}

describe('EnrichmentPanel', () => {
  it('renders all 7 enrichment section headers via i18n keys', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
      />,
    );

    for (const key of [
      'enrichment.panel.problemStatement',
      'enrichment.panel.goal',
      'enrichment.panel.inScope',
      'enrichment.panel.outOfScope',
      'enrichment.panel.acceptanceCriteria',
      'enrichment.panel.technicalContext',
      'enrichment.panel.risksEdgeCases',
    ]) {
      expect(screen.getByText(key)).toBeDefined();
    }
  });

  it('shows i18n "notYetEnriched" placeholder for empty sections', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
      />,
    );

    const placeholders = screen.getAllByText('enrichment.panel.notYetEnriched');
    expect(placeholders.length).toBe(7);
  });

  it('renders enrichment content when provided', () => {
    const enrichment = makeEnrichment({
      enrichment: {
        problem: 'Users cannot log in',
        goal: 'Fix login flow',
        scopeIn: ['Authentication module'],
        scopeOut: ['Registration'],
        acceptanceCriteria: ['Login works', 'Tests pass'],
        technicalContext: 'OAuth2 based',
        risksEdgeCases: [],
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={65}
        onTransition={vi.fn()}
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
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'enrichment.dropdown.changeState' })).toBeDefined();
  });

  it('renders priority when set', () => {
    const enrichment = makeEnrichment({ priority: 'high' });
    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={40}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByText('high')).toBeDefined();
  });

  it('renders i18n "noPriority" when not set', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByText('enrichment.panel.noPriority')).toBeDefined();
  });

  it('renders completeness score with i18n label', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={75}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByText('75%')).toBeDefined();
    expect(screen.getByText('enrichment.panel.completeness')).toBeDefined();
  });

  it('has aria-live="polite" for state change area', () => {
    const { container } = render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
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
        scopeIn: [],
        scopeOut: [],
        acceptanceCriteria: ['Login works', 'Tests pass'],
        technicalContext: '',
        risksEdgeCases: [],
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={25}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByText(/Login works/)).toBeDefined();
    expect(screen.getByText(/Tests pass/)).toBeDefined();
  });

  it('renders CompletenessBreakdown when enrichment data exists', () => {
    const enrichment = makeEnrichment({
      enrichment: {
        problem: 'A problem',
        goal: 'A goal',
        scopeIn: ['item'],
        scopeOut: [],
        acceptanceCriteria: [],
        technicalContext: '',
        risksEdgeCases: [],
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={40}
        onTransition={vi.fn()}
      />,
    );

    // CompletenessBreakdown renders a section with aria-label "Completeness score breakdown"
    expect(screen.getByLabelText('Completeness score breakdown')).toBeDefined();
  });

  it('does not render CompletenessBreakdown when no enrichment data', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Completeness score breakdown')).toBeNull();
  });

  it('shows error alert with retry button when lastError is set', () => {
    const onRetry = vi.fn();
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
        lastError="Enrichment failed: API timeout"
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(screen.getByText('Enrichment failed: API timeout')).toBeDefined();

    const retryButton = screen.getByRole('button', { name: 'aiTriage.retry' });
    expect(retryButton).toBeDefined();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show error alert when lastError is null', () => {
    render(
      <EnrichmentPanel
        enrichment={null}
        currentState="new"
        completenessScore={0}
        onTransition={vi.fn()}
        lastError={null}
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders risksEdgeCases section when data is provided', () => {
    const enrichment = makeEnrichment({
      enrichment: {
        problem: '',
        goal: '',
        scopeIn: [],
        scopeOut: [],
        acceptanceCriteria: [],
        technicalContext: '',
        risksEdgeCases: ['Race condition in auth', 'Token expiry edge case'],
      },
    });

    render(
      <EnrichmentPanel
        enrichment={enrichment}
        currentState="triage"
        completenessScore={50}
        onTransition={vi.fn()}
      />,
    );

    expect(screen.getByText('enrichment.panel.risksEdgeCases')).toBeDefined();
    expect(screen.getByText(/Race condition in auth/)).toBeDefined();
    expect(screen.getByText(/Token expiry edge case/)).toBeDefined();
  });
});
