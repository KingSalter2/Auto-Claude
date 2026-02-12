import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExecFileSync = vi.fn();
vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn(),
    handle: vi.fn(),
  },
}));

// Mock project-middleware
const mockProject = { id: 'test-project', path: '/fake/project', name: 'Test' };
vi.mock('../utils/project-middleware', () => ({
  withProjectOrNull: vi.fn((_id: string, handler: (p: typeof mockProject) => Promise<unknown>) =>
    handler(mockProject),
  ),
}));

// Mock env-utils
vi.mock('../../../env-utils', () => ({
  getAugmentedEnv: vi.fn(() => ({ PATH: '/usr/bin', GH_TOKEN: 'test-token' })),
}));

// Mock enrichment-persistence
const mockEnrichmentData = {
  schemaVersion: 1,
  issues: {} as Record<string, unknown>,
};
vi.mock('../enrichment-persistence', () => ({
  readEnrichmentFile: vi.fn(() => Promise.resolve(mockEnrichmentData)),
  writeEnrichmentFile: vi.fn(() => Promise.resolve()),
  appendTransition: vi.fn(() => Promise.resolve()),
}));

// Mock subprocess-runner
const mockRunPythonSubprocess = vi.fn();
const mockValidateGitHubModule = vi.fn();
vi.mock('../utils/subprocess-runner', () => ({
  runPythonSubprocess: (...args: unknown[]) => mockRunPythonSubprocess(...args),
  validateGitHubModule: (...args: unknown[]) => mockValidateGitHubModule(...args),
  getPythonPath: vi.fn(() => '/fake/python'),
  getRunnerPath: vi.fn(() => '/fake/runner.py'),
  buildRunnerArgs: vi.fn((_runner: string, _project: string, cmd: string, extra: string[]) => [
    '-m', 'runners.github.runner', '--project', '/fake/project', cmd, ...extra,
  ]),
}));

// Mock runner-env
vi.mock('../utils/runner-env', () => ({
  getRunnerEnv: vi.fn(() => Promise.resolve({ PATH: '/usr/bin' })),
}));

// Mock IPC communicator
const mockSendProgress = vi.fn();
const mockSendError = vi.fn();
const mockSendComplete = vi.fn();
vi.mock('../utils/ipc-communicator', () => ({
  createIPCCommunicators: vi.fn(() => ({
    sendProgress: mockSendProgress,
    sendError: mockSendError,
    sendComplete: mockSendComplete,
  })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

// Mock settings
vi.mock('../../../settings-utils', () => ({
  readSettingsFile: vi.fn(() => ({})),
}));

// Mock constants
vi.mock('../../../../shared/constants', () => ({
  IPC_CHANNELS: {
    GITHUB_TRIAGE_ENRICH: 'github:triage:enrich',
    GITHUB_TRIAGE_ENRICH_PROGRESS: 'github:triage:enrich:progress',
    GITHUB_TRIAGE_ENRICH_ERROR: 'github:triage:enrich:error',
    GITHUB_TRIAGE_ENRICH_COMPLETE: 'github:triage:enrich:complete',
    GITHUB_TRIAGE_SPLIT: 'github:triage:split',
    GITHUB_TRIAGE_SPLIT_PROGRESS: 'github:triage:split:progress',
    GITHUB_TRIAGE_SPLIT_ERROR: 'github:triage:split:error',
    GITHUB_TRIAGE_SPLIT_COMPLETE: 'github:triage:split:complete',
    GITHUB_TRIAGE_APPLY_RESULTS: 'github:triage:applyResults',
    GITHUB_TRIAGE_APPLY_RESULTS_PROGRESS: 'github:triage:applyResults:progress',
    GITHUB_TRIAGE_APPLY_RESULTS_COMPLETE: 'github:triage:applyResults:complete',
    GITHUB_TRIAGE_SAVE_TRUST: 'github:triage:saveTrust',
    GITHUB_TRIAGE_GET_TRUST: 'github:triage:getTrust',
    CLAUDE_AUTH_FAILURE: 'claude:auth:failure',
  },
  MODEL_ID_MAP: { opus: 'claude-opus-4-6', sonnet: 'claude-sonnet-4-5-20250929', haiku: 'claude-haiku-4-5-20251001' },
  DEFAULT_FEATURE_MODELS: { githubIssues: 'sonnet' },
  DEFAULT_FEATURE_THINKING: { githubIssues: 'medium' },
}));

// Mock fs and path
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
  },
  readFileSync: vi.fn(() => '{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => true),
}));

vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/') },
  join: (...args: string[]) => args.join('/'),
}));

// Mock atomic-file
vi.mock('../../../utils/atomic-file', () => ({
  writeJsonWithRetry: vi.fn(() => Promise.resolve()),
}));

import { ipcMain } from 'electron';
import { registerAITriageHandlers } from '../ai-triage-handlers';

// Collect registered handlers
type OnHandlerFn = (event: unknown, ...args: unknown[]) => void;
type HandleHandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const onHandlers: Record<string, OnHandlerFn> = {};
const handleHandlers: Record<string, HandleHandlerFn> = {};

const mockMainWindow = {
  webContents: { send: vi.fn() },
} as unknown;

beforeEach(() => {
  vi.clearAllMocks();
  mockEnrichmentData.issues = {};

  // Capture registered handlers
  (ipcMain.on as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: OnHandlerFn) => {
      onHandlers[channel] = handler;
    },
  );
  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: HandleHandlerFn) => {
      handleHandlers[channel] = handler;
    },
  );

  // Default: validation passes
  mockValidateGitHubModule.mockResolvedValue({
    valid: true,
    backendPath: '/fake/backend',
    runnerAvailable: true,
    ghCliInstalled: true,
    ghAuthenticated: true,
    pythonEnvValid: true,
  });

  registerAITriageHandlers(() => mockMainWindow as import('electron').BrowserWindow);
});

// ============================================
// runEnrichment
// ============================================

describe('runEnrichment handler', () => {
  const trigger = (projectId: string, issueNumber: number) =>
    onHandlers['github:triage:enrich']({}, projectId, issueNumber);

  it('calls Python runner with enrich command', async () => {
    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: true,
        data: {
          issueNumber: 42,
          problem: 'Test problem',
          goal: 'Test goal',
          scopeIn: [],
          scopeOut: [],
          acceptanceCriteria: [],
          technicalContext: '',
          risksEdgeCases: [],
          confidence: 0.85,
        },
      }),
    });

    await trigger('test-project', 42);

    expect(mockRunPythonSubprocess).toHaveBeenCalled();
    expect(mockSendComplete).toHaveBeenCalled();
  });

  it('validates issue number', async () => {
    await trigger('test-project', -1);

    expect(mockSendError).toHaveBeenCalled();
    expect(mockRunPythonSubprocess).not.toHaveBeenCalled();
  });

  it('sends error on Python failure', async () => {
    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: false,
        error: 'Python crashed',
      }),
    });

    await trigger('test-project', 42);

    expect(mockSendError).toHaveBeenCalledWith('Python crashed');
  });

  it('sends error when validation fails', async () => {
    mockValidateGitHubModule.mockResolvedValue({
      valid: false,
      error: 'GitHub module not installed',
    });

    await trigger('test-project', 42);

    expect(mockSendError).toHaveBeenCalledWith('GitHub module not installed');
  });

  it('persists enrichment result to enrichment.json', async () => {
    const { readEnrichmentFile, writeEnrichmentFile } = await import('../enrichment-persistence');
    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: true,
        data: {
          issueNumber: 42,
          problem: 'Test problem',
          goal: 'Test goal',
          scopeIn: ['scope-in'],
          scopeOut: ['scope-out'],
          acceptanceCriteria: ['AC-1'],
          technicalContext: 'Some context',
          risksEdgeCases: ['Risk 1'],
          confidence: 0.85,
        },
      }),
    });

    await trigger('test-project', 42);

    expect(readEnrichmentFile).toHaveBeenCalledWith('/fake/project');
    expect(writeEnrichmentFile).toHaveBeenCalledWith(
      '/fake/project',
      expect.objectContaining({
        issues: expect.objectContaining({
          '42': expect.objectContaining({
            enrichment: expect.objectContaining({
              problem: 'Test problem',
              goal: 'Test goal',
            }),
            completenessScore: 0.85,
          }),
        }),
      }),
    );
  });
});

// ============================================
// runSplitSuggestion
// ============================================

describe('runSplitSuggestion handler', () => {
  const trigger = (projectId: string, issueNumber: number) =>
    onHandlers['github:triage:split']({}, projectId, issueNumber);

  it('calls Python runner with split command', async () => {
    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: true,
        data: {
          issueNumber: 42,
          subIssues: [{ title: 'Sub 1', body: 'Body 1', labels: [] }],
          rationale: 'Too broad',
          confidence: 0.9,
        },
      }),
    });

    await trigger('test-project', 42);

    expect(mockRunPythonSubprocess).toHaveBeenCalled();
    expect(mockSendComplete).toHaveBeenCalled();
  });

  it('caps sub-issues at MAX_SPLIT_SUB_ISSUES', async () => {
    const tooMany = Array.from({ length: 8 }, (_, i) => ({
      title: `Sub ${i + 1}`,
      body: `Body ${i + 1}`,
      labels: [],
    }));

    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: true,
        data: {
          issueNumber: 42,
          subIssues: tooMany,
          rationale: 'Many parts',
          confidence: 0.8,
        },
      }),
    });

    await trigger('test-project', 42);

    const sentResult = mockSendComplete.mock.calls[0][0];
    expect(sentResult.subIssues).toHaveLength(5);
  });

  it('sends error on Python failure', async () => {
    mockRunPythonSubprocess.mockReturnValue({
      promise: Promise.resolve({
        success: false,
        error: 'Split analysis failed',
      }),
    });

    await trigger('test-project', 42);

    expect(mockSendError).toHaveBeenCalledWith('Split analysis failed');
  });
});

// ============================================
// applyTriageResults
// ============================================

describe('applyTriageResults handler', () => {
  const reviewItems = [
    {
      issueNumber: 1,
      issueTitle: 'Bug report',
      result: {
        category: 'bug',
        confidence: 0.9,
        labelsToAdd: ['bug', 'priority:high'],
        labelsToRemove: [],
        isDuplicate: false,
        isSpam: false,
        isFeatureCreep: false,
        suggestedBreakdown: [],
        priority: 'high' as const,
        triagedAt: '2026-01-01T00:00:00Z',
      },
      status: 'accepted' as const,
    },
    {
      issueNumber: 2,
      issueTitle: 'Feature request',
      result: {
        category: 'feature',
        confidence: 0.7,
        labelsToAdd: ['enhancement'],
        labelsToRemove: ['needs-triage'],
        isDuplicate: false,
        isSpam: false,
        isFeatureCreep: false,
        suggestedBreakdown: [],
        priority: 'medium' as const,
        triagedAt: '2026-01-01T00:00:00Z',
      },
      status: 'accepted' as const,
    },
    {
      issueNumber: 3,
      issueTitle: 'Rejected item',
      result: {
        category: 'bug',
        confidence: 0.4,
        labelsToAdd: ['bug'],
        labelsToRemove: [],
        isDuplicate: false,
        isSpam: false,
        isFeatureCreep: false,
        suggestedBreakdown: [],
        priority: 'low' as const,
        triagedAt: '2026-01-01T00:00:00Z',
      },
      status: 'rejected' as const,
    },
  ];

  const trigger = (projectId: string, items: typeof reviewItems) =>
    onHandlers['github:triage:applyResults']({}, projectId, items);

  it('applies labels via execFileSync per accepted issue', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    await trigger('test-project', reviewItems);

    // Should apply to 2 accepted items (not the rejected one)
    expect(mockExecFileSync).toHaveBeenCalledTimes(3); // add 2 + remove 1
  });

  it('sends progress events per issue', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    await trigger('test-project', reviewItems);

    expect(mockSendProgress).toHaveBeenCalled();
  });

  it('handles partial failure — continues on error', async () => {
    mockExecFileSync
      .mockReturnValueOnce(Buffer.from('')) // Issue 1 add-label succeeds
      .mockImplementationOnce(() => { throw new Error('Rate limited'); }) // Issue 2 add-label fails
      .mockReturnValueOnce(Buffer.from('')); // Issue 2 remove-label succeeds (or skipped)

    await trigger('test-project', reviewItems);

    expect(mockSendComplete).toHaveBeenCalled();
    const result = mockSendComplete.mock.calls[0][0];
    expect(result.failed).toBeGreaterThan(0);
    expect(result.succeeded).toBeGreaterThan(0);
  });

  it('appends ai-triage transition after applying results', async () => {
    const { appendTransition } = await import('../enrichment-persistence');
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    const singleItem = [reviewItems[0]];
    await trigger('test-project', singleItem);

    expect(appendTransition).toHaveBeenCalledWith(
      '/fake/project',
      expect.objectContaining({
        issueNumber: 1,
        actor: 'ai-triage',
        to: 'triage',
        reason: expect.stringContaining('bug'),
      }),
    );
  });

  it('persists triage result to enrichment.json after applying', async () => {
    const { readEnrichmentFile, writeEnrichmentFile } = await import('../enrichment-persistence');
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    const singleItem = [reviewItems[0]]; // accepted item with bug + priority:high
    await trigger('test-project', singleItem);

    expect(readEnrichmentFile).toHaveBeenCalled();
    expect(writeEnrichmentFile).toHaveBeenCalledWith(
      '/fake/project',
      expect.objectContaining({
        issues: expect.objectContaining({
          '1': expect.objectContaining({
            triageResult: expect.objectContaining({
              category: 'bug',
              labelsToAdd: ['bug', 'priority:high'],
              triagedAt: '2026-01-01T00:00:00Z',
            }),
          }),
        }),
      }),
    );
  });

  it('skips rejected items', async () => {
    const allRejected = reviewItems.map(item => ({ ...item, status: 'rejected' as const }));
    mockExecFileSync.mockReturnValue(Buffer.from(''));

    await trigger('test-project', allRejected);

    expect(mockExecFileSync).not.toHaveBeenCalled();
    const result = mockSendComplete.mock.calls[0][0];
    expect(result.succeeded).toBe(0);
    expect(result.skipped).toBe(3);
  });
});

// ============================================
// saveProgressiveTrust
// ============================================

describe('saveProgressiveTrust handler', () => {
  const trustConfig = {
    autoApply: {
      type: { enabled: true, threshold: 0.85 },
      priority: { enabled: false, threshold: 0.9 },
      labels: { enabled: true, threshold: 0.8 },
      duplicate: { enabled: false, threshold: 0.9 },
    },
    batchSize: 25,
    confirmAbove: 5,
  };

  const call = (projectId: string, config: typeof trustConfig) =>
    handleHandlers['github:triage:saveTrust']({}, projectId, config);

  it('saves config successfully', async () => {
    const { writeJsonWithRetry } = await import('../../../utils/atomic-file');
    const result = await call('test-project', trustConfig);

    expect(writeJsonWithRetry).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

// ============================================
// getProgressiveTrust
// ============================================

describe('getProgressiveTrust handler', () => {
  const call = (projectId: string) =>
    handleHandlers['github:triage:getTrust']({}, projectId);

  it('returns default config when no file exists', async () => {
    const result = await call('test-project') as { batchSize: number };

    expect(result).toBeDefined();
    expect(result.batchSize).toBe(50);
  });
});
