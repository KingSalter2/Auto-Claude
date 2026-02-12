import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  migrateFromTriageFiles,
  bootstrapFromGitHub,
  getEnrichmentDir,
  getEnrichmentFilePath,
} from '../enrichment-persistence';
import { readTransitionsFile } from '../enrichment-persistence';
import type { GitHubIssue } from '../../../../shared/types/integrations';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enrichment-migration-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createMockIssue(overrides: Partial<GitHubIssue> & { number: number }): GitHubIssue {
  const { number: num, ...rest } = overrides;
  return {
    id: num,
    number: num,
    title: `Issue #${num}`,
    state: 'open',
    labels: [],
    assignees: [],
    author: { login: 'testuser' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    commentsCount: 0,
    url: `https://api.github.com/repos/test/repo/issues/${num}`,
    htmlUrl: `https://github.com/test/repo/issues/${num}`,
    repoFullName: 'test/repo',
    ...rest,
  };
}

describe('migrateFromTriageFiles', () => {
  it('migrates legacy triage files to enrichment', async () => {
    const issuesDir = getEnrichmentDir(tmpDir);
    fs.mkdirSync(issuesDir, { recursive: true });

    // Create 3 legacy triage files
    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(
        path.join(issuesDir, `triage_${i}.json`),
        JSON.stringify({
          issue_number: i,
          category: 'bug',
          confidence: 0.8,
          labels_to_add: ['bug'],
          labels_to_remove: [],
          is_duplicate: false,
          is_spam: false,
        }),
        'utf-8',
      );
    }

    const result = await migrateFromTriageFiles(tmpDir);

    expect(Object.keys(result.issues)).toHaveLength(3);
    expect(result.issues['1'].triageState).toBe('triage');
    expect(result.issues['2'].triageState).toBe('triage');
    expect(result.issues['3'].triageState).toBe('triage');
  });

  it('creates migration marker and skips on re-run', async () => {
    const issuesDir = getEnrichmentDir(tmpDir);
    fs.mkdirSync(issuesDir, { recursive: true });

    fs.writeFileSync(
      path.join(issuesDir, 'triage_1.json'),
      JSON.stringify({ issue_number: 1, category: 'bug' }),
      'utf-8',
    );

    const first = await migrateFromTriageFiles(tmpDir);
    expect(Object.keys(first.issues)).toHaveLength(1);

    // Marker should exist
    expect(
      fs.existsSync(path.join(issuesDir, '.enrichment-migration-complete')),
    ).toBe(true);

    // Second run skips (returns existing data)
    const second = await migrateFromTriageFiles(tmpDir);
    expect(Object.keys(second.issues)).toHaveLength(1);
  });

  it('re-runs migration if marker exists but enrichment.json is missing', async () => {
    const issuesDir = getEnrichmentDir(tmpDir);
    fs.mkdirSync(issuesDir, { recursive: true });

    // Write marker but no enrichment.json
    fs.writeFileSync(path.join(issuesDir, '.enrichment-migration-complete'), 'done', 'utf-8');

    fs.writeFileSync(
      path.join(issuesDir, 'triage_1.json'),
      JSON.stringify({ issue_number: 1, category: 'bug' }),
      'utf-8',
    );

    const result = await migrateFromTriageFiles(tmpDir);
    expect(Object.keys(result.issues)).toHaveLength(1);
  });

  it('returns empty enrichment for empty directory', async () => {
    const result = await migrateFromTriageFiles(tmpDir);
    expect(Object.keys(result.issues)).toHaveLength(0);
  });
});

describe('bootstrapFromGitHub', () => {
  it('generates initial states from issue data', async () => {
    const issues: GitHubIssue[] = [
      createMockIssue({ number: 1, state: 'closed' }),
      createMockIssue({ number: 2, state: 'closed' }),
      createMockIssue({
        number: 3,
        state: 'open',
        assignees: [{ login: 'dev' }],
      }),
      createMockIssue({
        number: 4,
        state: 'open',
        labels: [{ id: 1, name: 'priority:high', color: '000' }],
      }),
      createMockIssue({ number: 5, state: 'open' }),
    ];

    const result = await bootstrapFromGitHub(tmpDir, issues);

    expect(result.issues['1'].triageState).toBe('done');
    expect(result.issues['1'].resolution).toBe('completed');
    expect(result.issues['2'].triageState).toBe('done');
    expect(result.issues['3'].triageState).toBe('in_progress');
    expect(result.issues['4'].triageState).toBe('new');
    expect(result.issues['4'].priority).toBe('high');
    expect(result.issues['5'].triageState).toBe('new');
  });

  it('logs bootstrap transitions with actor bootstrap', async () => {
    const issues: GitHubIssue[] = [
      createMockIssue({ number: 1, state: 'closed' }),
      createMockIssue({ number: 2, state: 'open' }),
    ];

    await bootstrapFromGitHub(tmpDir, issues);
    const transitions = await readTransitionsFile(tmpDir);

    expect(transitions.transitions).toHaveLength(2);

    for (const t of transitions.transitions) {
      expect(t.actor).toBe('bootstrap');
      expect(t.from).toBe('new');
    }

    expect(transitions.transitions[0].to).toBe('done');
    expect(transitions.transitions[1].to).toBe('new');
  });

  it('skips issues that already have enrichment', async () => {
    const issues: GitHubIssue[] = [
      createMockIssue({ number: 1, state: 'open' }),
    ];

    // Bootstrap once
    await bootstrapFromGitHub(tmpDir, issues);

    // Bootstrap again with same + new issue
    const result = await bootstrapFromGitHub(tmpDir, [
      ...issues,
      createMockIssue({ number: 2, state: 'open' }),
    ]);

    // Issue 1 should not be duplicated, issue 2 should be added
    expect(result.issues['1']).toBeDefined();
    expect(result.issues['2']).toBeDefined();

    const transitions = await readTransitionsFile(tmpDir);
    // Should have 1 from first bootstrap + 1 from second
    expect(transitions.transitions).toHaveLength(2);
  });
});
