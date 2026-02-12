/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompletenessIndicator } from '../CompletenessIndicator';

describe('CompletenessIndicator', () => {
  it('renders "0%" for score 0', () => {
    render(<CompletenessIndicator score={0} />);
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders "100%" for score 100', () => {
    render(<CompletenessIndicator score={100} />);
    expect(screen.getByText('100%')).toBeDefined();
  });

  it('renders "65%" for score 65', () => {
    render(<CompletenessIndicator score={65} />);
    expect(screen.getByText('65%')).toBeDefined();
  });

  it('renders "Not assessed" for null score', () => {
    render(<CompletenessIndicator score={null} />);
    expect(screen.getByText('Not assessed')).toBeDefined();
  });

  it('renders "Not assessed" for undefined score', () => {
    render(<CompletenessIndicator score={undefined} />);
    expect(screen.getByText('Not assessed')).toBeDefined();
  });

  it('has aria-label "Completeness: N percent" for numeric score', () => {
    const { container } = render(<CompletenessIndicator score={42} />);
    const el = container.querySelector('[aria-label="Completeness: 42 percent"]');
    expect(el).not.toBeNull();
  });

  it('has aria-label "Not assessed" for null score', () => {
    const { container } = render(<CompletenessIndicator score={null} />);
    const el = container.querySelector('[aria-label="Not assessed"]');
    expect(el).not.toBeNull();
  });

  it('progress bar width matches percentage', () => {
    const { container } = render(<CompletenessIndicator score={75} />);
    const bar = container.querySelector('[style*="width"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe('75%');
  });

  it('compact variant renders text only', () => {
    const { container } = render(<CompletenessIndicator score={50} compact />);
    expect(screen.getByText('50%')).toBeDefined();
    // No progress bar in compact mode
    const bar = container.querySelector('[style*="width"]');
    expect(bar).toBeNull();
  });
});
