import { describe, it, expect } from 'vitest';
import {
  createEmptyDependencies,
  hasDependencies,
  totalDependencyCount,
} from '../types/dependencies';
import type { IssueDependency, IssueDependencies } from '../types/dependencies';

describe('createEmptyDependencies', () => {
  it('returns empty tracks array', () => {
    const deps = createEmptyDependencies();
    expect(deps.tracks).toEqual([]);
  });

  it('returns empty trackedBy array', () => {
    const deps = createEmptyDependencies();
    expect(deps.trackedBy).toEqual([]);
  });

  it('returns a fresh object each time', () => {
    const a = createEmptyDependencies();
    const b = createEmptyDependencies();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('hasDependencies', () => {
  it('returns false for empty dependencies', () => {
    expect(hasDependencies(createEmptyDependencies())).toBe(false);
  });

  it('returns true when tracks has items', () => {
    const deps: IssueDependencies = {
      tracks: [{ issueNumber: 1, title: 'Issue 1', state: 'open' }],
      trackedBy: [],
    };
    expect(hasDependencies(deps)).toBe(true);
  });

  it('returns true when trackedBy has items', () => {
    const deps: IssueDependencies = {
      tracks: [],
      trackedBy: [{ issueNumber: 2, title: 'Issue 2', state: 'closed' }],
    };
    expect(hasDependencies(deps)).toBe(true);
  });

  it('returns true when both have items', () => {
    const deps: IssueDependencies = {
      tracks: [{ issueNumber: 1, title: 'Issue 1', state: 'open' }],
      trackedBy: [{ issueNumber: 2, title: 'Issue 2', state: 'closed' }],
    };
    expect(hasDependencies(deps)).toBe(true);
  });
});

describe('totalDependencyCount', () => {
  it('returns 0 for empty', () => {
    expect(totalDependencyCount(createEmptyDependencies())).toBe(0);
  });

  it('sums tracks and trackedBy', () => {
    const deps: IssueDependencies = {
      tracks: [
        { issueNumber: 1, title: 'A', state: 'open' },
        { issueNumber: 2, title: 'B', state: 'open' },
      ],
      trackedBy: [{ issueNumber: 3, title: 'C', state: 'closed' }],
    };
    expect(totalDependencyCount(deps)).toBe(3);
  });
});

describe('IssueDependency type shape', () => {
  it('supports optional repo field for cross-repo deps', () => {
    const dep: IssueDependency = {
      issueNumber: 42,
      title: 'Cross-repo issue',
      state: 'open',
      repo: 'owner/other-repo',
    };
    expect(dep.repo).toBe('owner/other-repo');
  });

  it('repo is optional', () => {
    const dep: IssueDependency = {
      issueNumber: 1,
      title: 'Same-repo issue',
      state: 'closed',
    };
    expect(dep.repo).toBeUndefined();
  });
});
