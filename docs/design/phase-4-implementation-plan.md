# Phase 4 Implementation Plan

**Parent:** [Phase 4 PRD](phase-4-prd.md), [Design Document](design-document.md)
**Approach:** TDD — tests first, implementation second, commit per WP
**Base path:** `apps/frontend/src/`
**Status:** Final

---

## Execution Order

```
WP-1  Types, Constants, Label Map           (no deps)
  ├── WP-2  Label Sync Handlers (Main)      (WP-1)
  │     └── WP-3  Dependency + Metrics Handlers (WP-1)
  ├── WP-4  IPC Wiring + Preload            (WP-2 + WP-3)
  ├── WP-5  Store Extensions                (WP-1)
  │     └── WP-6  Hooks                     (WP-4 + WP-5)
  └── WP-7  UI Components                   (WP-6)
        └── WP-8  Integration + i18n        (WP-7)
              └── WP-9  Verification
```

**Parallelizable:** WP-2 and WP-3 can run in parallel. WP-4 and WP-5 can run in parallel.

---

## File Inventory

### New Source Files (12)

1. `shared/types/label-sync.ts`
2. `shared/types/dependencies.ts`
3. `shared/types/metrics.ts`
4. `shared/constants/label-sync.ts`
5. `main/ipc-handlers/github/label-sync-handlers.ts`
6. `main/ipc-handlers/github/dependency-handlers.ts`
7. `main/ipc-handlers/github/metrics-handlers.ts`
8. `renderer/stores/github/label-sync-store.ts`
9. `renderer/components/github-issues/hooks/useLabelSync.ts`
10. `renderer/components/github-issues/components/LabelSyncSettings.tsx`
11. `renderer/components/github-issues/components/DependencyList.tsx`
12. `renderer/components/github-issues/components/MetricsDashboard.tsx`

### New Test Files (12)

1. `shared/__tests__/label-sync-types.test.ts`
2. `shared/__tests__/dependencies-types.test.ts`
3. `shared/__tests__/metrics-types.test.ts`
4. `shared/__tests__/label-sync-constants.test.ts`
5. `main/ipc-handlers/github/__tests__/label-sync-handlers.test.ts`
6. `main/ipc-handlers/github/__tests__/dependency-handlers.test.ts`
7. `main/ipc-handlers/github/__tests__/metrics-handlers.test.ts`
8. `renderer/__tests__/label-sync-store.test.ts`
9. `renderer/components/github-issues/hooks/__tests__/useLabelSync.test.ts`
10. `renderer/components/github-issues/components/__tests__/LabelSyncSettings.test.tsx`
11. `renderer/components/github-issues/components/__tests__/DependencyList.test.tsx`
12. `renderer/components/github-issues/components/__tests__/MetricsDashboard.test.tsx`

### Modified Files (10)

1. `shared/types/settings.ts` — Add `labelSync?: LabelSyncConfig` to `AppSettings`
2. `shared/constants/ipc.ts` — Add ~10 new channel constants
3. `shared/i18n/locales/en/common.json` — Label sync, deps, metrics, triage mode keys
4. `shared/i18n/locales/fr/common.json` — French translations
5. `main/ipc-handlers/github/index.ts` — Register 3 new handler modules
6. `preload/api/modules/github-api.ts` — Add ~14 new API methods
7. `renderer/components/GitHubIssues.tsx` — 3-panel layout + metrics tab
8. `renderer/components/github-issues/components/IssueDetail.tsx` — Dependencies section
9. `renderer/components/github-issues/components/IssueListHeader.tsx` — Triage mode toggle
10. `renderer/components/github-issues/components/IssueList.tsx` — Compact mode prop

---

## WP-1: Types, Constants, Label Map

**Goal:** Define all Phase 4 type definitions and the `WORKFLOW_LABEL_MAP` constant.

### Step 1.1 — Create label sync types

**Create:** `shared/types/label-sync.ts`

```typescript
export interface LabelSyncConfig {
  enabled: boolean;
  lastSyncedAt: string | null;
}

export interface WorkflowLabel {
  name: string;
  color: string;
  description: string;
}

export interface LabelSyncResult {
  created: number;
  updated: number;
  removed: number;
  errors: Array<{ label: string; error: string }>;
}

export interface LabelSyncProgress {
  phase: 'creating' | 'syncing' | 'cleaning' | 'complete';
  progress: number;
  message: string;
}

export function createDefaultLabelSyncConfig(): LabelSyncConfig {
  return { enabled: false, lastSyncedAt: null };
}
```

**Test:** `shared/__tests__/label-sync-types.test.ts`
- `createDefaultLabelSyncConfig()` returns disabled config
- Config has null `lastSyncedAt`
- Factory returns fresh object each time

### Step 1.2 — Create dependency types

**Create:** `shared/types/dependencies.ts`

```typescript
export interface IssueDependency {
  issueNumber: number;
  title: string;
  state: 'open' | 'closed';
  repo?: string;
}

export interface IssueDependencies {
  tracks: IssueDependency[];
  trackedBy: IssueDependency[];
}

export function createEmptyDependencies(): IssueDependencies {
  return { tracks: [], trackedBy: [] };
}

export function hasDependencies(deps: IssueDependencies): boolean {
  return deps.tracks.length > 0 || deps.trackedBy.length > 0;
}
```

**Test:** `shared/__tests__/dependencies-types.test.ts`
- `createEmptyDependencies()` returns empty arrays
- `hasDependencies()` returns false for empty, true for non-empty

### Step 1.3 — Create metrics types

**Create:** `shared/types/metrics.ts`

```typescript
import type { WorkflowState } from './enrichment';

export interface TriageMetrics {
  stateCounts: Record<WorkflowState, number>;
  avgTimeInState: Record<WorkflowState, number>;
  weeklyThroughput: Array<{ week: string; count: number }>;
  completenessDistribution: { low: number; medium: number; high: number; excellent: number };
  avgBacklogAge: number;
  totalTransitions: number;
  computedAt: string;
}

export type MetricsTimeWindow = '7d' | '30d' | 'all';

export function createEmptyMetrics(): TriageMetrics { ... }
export function getCompletenessCategory(score: number): 'low' | 'medium' | 'high' | 'excellent' { ... }
```

**Test:** `shared/__tests__/metrics-types.test.ts`
- `createEmptyMetrics()` returns zero counts for all states
- `getCompletenessCategory()` boundaries: 0-25 low, 25-50 medium, 50-75 high, 75-100 excellent

### Step 1.4 — Create label sync constants

**Create:** `shared/constants/label-sync.ts`

```typescript
import type { WorkflowState } from '../types/enrichment';
import type { WorkflowLabel } from '../types/label-sync';

export const LABEL_PREFIX = 'ac:';

export const WORKFLOW_LABEL_MAP: Record<WorkflowState, string> = {
  new: 'ac:new',
  triage: 'ac:triage',
  ready: 'ac:ready',
  in_progress: 'ac:in-progress',
  review: 'ac:review',
  done: 'ac:done',
  blocked: 'ac:blocked',
};

export const WORKFLOW_LABEL_COLORS: Record<WorkflowState, string> = {
  new: 'C2E0F4',        // light blue
  triage: '0E8A16',     // green
  ready: '1D76DB',      // blue
  in_progress: 'FBCA04', // yellow
  review: 'D93F0B',     // orange
  done: '91CA55',       // light green
  blocked: 'B60205',    // red
};

export const LABEL_DESCRIPTION = 'Managed by Auto-Claude';

export const SYNC_DEBOUNCE_MS = 2000;

export function getWorkflowLabels(): WorkflowLabel[] { ... }
export function getLabelForState(state: WorkflowState): string { ... }
export function getStateFromLabel(label: string): WorkflowState | null { ... }
```

**Test:** `shared/__tests__/label-sync-constants.test.ts`
- `WORKFLOW_LABEL_MAP` has entry for every WorkflowState
- All label names start with `LABEL_PREFIX`
- All colors are valid 6-char hex (no `#` prefix for gh CLI)
- `getLabelForState()` returns correct label for each state
- `getStateFromLabel()` returns correct state for each label
- `getStateFromLabel()` returns null for unknown labels
- `getWorkflowLabels()` returns 7 labels
- `SYNC_DEBOUNCE_MS` is 2000

**Package verification:**
- All 4 test files pass
- No lint warnings

---

## WP-2: Label Sync Handlers (Main)

**Goal:** IPC handlers for label CRUD, issue label sync, and cleanup.

### Step 2.1 — Write label sync handler tests

**Create:** `main/ipc-handlers/github/__tests__/label-sync-handlers.test.ts`

Tests (~14):
- `enableLabelSync`: creates all 7 labels via `execFileSync`
- `enableLabelSync`: updates existing labels (--force flag)
- `enableLabelSync`: saves config with `lastSyncedAt`
- `enableLabelSync`: handles partial label creation failure
- `syncIssueLabel`: removes old label, adds new label
- `syncIssueLabel`: skips if sync disabled
- `syncIssueLabel`: handles missing old label gracefully
- `bulkSyncLabels`: processes multiple issues
- `bulkSyncLabels`: reports progress per issue
- `disableLabelSync`: removes labels from all issues
- `disableLabelSync`: deletes label definitions
- `disableLabelSync`: handles cleanup: false (keep labels)
- `getSyncConfig`: returns saved config
- `getSyncConfig`: returns default when no config exists

### Step 2.2 — Implement label sync handlers

**Create:** `main/ipc-handlers/github/label-sync-handlers.ts`

Register: `registerLabelSyncHandlers(getMainWindow)`

Handlers:
- `GITHUB_LABEL_SYNC_ENABLE` (handle): creates labels via `gh label create --force`
- `GITHUB_LABEL_SYNC_DISABLE` (handle): removes labels, deletes definitions
- `GITHUB_LABEL_SYNC_ISSUE` (handle): sync single issue label
- `GITHUB_LABEL_SYNC_BULK` (on): sync multiple issues with progress
- `GITHUB_LABEL_SYNC_STATUS` (handle): read config
- `GITHUB_LABEL_SYNC_SAVE` (handle): save config

**Pattern:** Same as `mutation-handlers.ts` — `execFileSync(ghPath, [...args], { env: getAugmentedEnv() })`

**Package verification:**
- All 14 handler tests pass

---

## WP-3: Dependency + Metrics Handlers

**Goal:** IPC handlers for GraphQL dependency fetch and metrics computation.

### Step 3.1 — Write dependency handler tests

**Create:** `main/ipc-handlers/github/__tests__/dependency-handlers.test.ts`

Tests (~6):
- `fetchDependencies`: returns tracks and trackedBy arrays
- `fetchDependencies`: handles GraphQL field error (unavailable API)
- `fetchDependencies`: handles empty dependencies
- `fetchDependencies`: handles cross-repo dependencies
- `fetchDependencies`: validates issue number
- `fetchDependencies`: handles auth error

### Step 3.2 — Implement dependency handlers

**Create:** `main/ipc-handlers/github/dependency-handlers.ts`

Register: `registerDependencyHandlers(getMainWindow)`

Uses `execFileSync(ghPath, ['api', 'graphql', '-f', 'query=...'])` to fetch `trackedBy` and `trackedIn` fields.

### Step 3.3 — Write metrics handler tests

**Create:** `main/ipc-handlers/github/__tests__/metrics-handlers.test.ts`

Tests (~8):
- `computeMetrics`: returns state counts from enrichment data
- `computeMetrics`: computes average time in state from transitions
- `computeMetrics`: computes weekly throughput
- `computeMetrics`: computes completeness distribution
- `computeMetrics`: computes backlog age
- `computeMetrics`: handles empty transitions (returns zeros)
- `computeMetrics`: filters by time window (7d, 30d)
- `getStateCounts`: returns quick count query

### Step 3.4 — Implement metrics handlers

**Create:** `main/ipc-handlers/github/metrics-handlers.ts`

Register: `registerMetricsHandlers(getMainWindow)`

Reads `enrichment.json` and `transitions.json`, computes aggregations, returns `TriageMetrics`.

**Package verification:**
- All 14 handler tests pass (6 dependency + 8 metrics)

---

## WP-4: IPC Wiring + Preload

**Goal:** Register handlers, add IPC channel constants, expose preload API.

### Step 4.1 — Add IPC channel constants

**Modify:** `shared/constants/ipc.ts`

Add:
```typescript
GITHUB_LABEL_SYNC_ENABLE, GITHUB_LABEL_SYNC_DISABLE,
GITHUB_LABEL_SYNC_ISSUE, GITHUB_LABEL_SYNC_BULK,
GITHUB_LABEL_SYNC_PROGRESS, GITHUB_LABEL_SYNC_STATUS, GITHUB_LABEL_SYNC_SAVE,
GITHUB_DEPS_FETCH,
GITHUB_METRICS_COMPUTE, GITHUB_METRICS_STATE_COUNTS
```

### Step 4.2 — Register handlers

**Modify:** `main/ipc-handlers/github/index.ts`

Import and call:
- `registerLabelSyncHandlers(getMainWindow)`
- `registerDependencyHandlers(getMainWindow)`
- `registerMetricsHandlers(getMainWindow)`

### Step 4.3 — Add preload API methods

**Modify:** `preload/api/modules/github-api.ts`

Add interface methods and implementations:
- `enableLabelSync(projectId)`, `disableLabelSync(projectId, cleanup)`, `syncIssueLabel(projectId, issueNumber, state)`, `bulkSyncLabels(projectId, issues)`, `onLabelSyncProgress(cb)`, `getLabelSyncStatus(projectId)`, `saveLabelSyncConfig(projectId, config)`
- `fetchDependencies(projectId, issueNumber)`
- `computeMetrics(projectId, timeWindow)`, `getStateCounts(projectId)`

**Package verification:**
- All existing handler tests still pass (170+ files)

---

## WP-5: Store Extensions

**Goal:** Zustand store for label sync state.

### Step 5.1 — Write label sync store tests

**Create:** `renderer/__tests__/label-sync-store.test.ts`

Tests (~10):
- Initial state: not syncing, config disabled, no progress
- `setConfig`: updates config
- `setSyncing`: toggles syncing state
- `setProgress`: updates progress
- `clearProgress`: resets progress to null
- `setError`: stores error message
- `clearError`: clears error
- `getIsEnabled`: derived from config.enabled
- `enable/disable` updates config.enabled
- Multiple state changes in sequence

### Step 5.2 — Implement label sync store

**Create:** `renderer/stores/github/label-sync-store.ts`

Zustand store with: `config`, `isSyncing`, `progress`, `error`, actions for each.

**Package verification:**
- All 10 store tests pass

---

## WP-6: Hooks

**Goal:** React hooks for label sync, dependencies, and metrics.

### Step 6.1 — Write useLabelSync hook tests

**Create:** `renderer/components/github-issues/hooks/__tests__/useLabelSync.test.ts`

Tests (~6):
- `enableSync` calls IPC enableLabelSync
- `disableSync` calls IPC with cleanup flag
- `syncIssue` calls IPC syncIssueLabel
- Hook returns store state (isSyncing, config, error)
- Sets up IPC progress listener on mount
- Cleans up listener on unmount

### Step 6.2 — Implement useLabelSync hook

**Create:** `renderer/components/github-issues/hooks/useLabelSync.ts`

Pattern: same as `useAITriage.ts` — IPC listeners in `useEffect`, actions via `useCallback`.

**Package verification:**
- All 6 hook tests pass

---

## WP-7: UI Components

**Goal:** LabelSyncSettings, DependencyList, MetricsDashboard components.

### Step 7.1 — Write LabelSyncSettings tests

**Create:** `renderer/components/github-issues/components/__tests__/LabelSyncSettings.test.tsx`

Tests (~7):
- Renders enable/disable toggle
- Toggle calls onToggle callback
- Shows color preview for each workflow state (7 colors)
- Shows "Sync Now" button when enabled
- Shows last synced timestamp when available
- Shows progress bar during sync
- All text uses i18n keys (renders key strings)

### Step 7.2 — Implement LabelSyncSettings

**Create:** `renderer/components/github-issues/components/LabelSyncSettings.tsx`

Toggle, color swatches, sync button, progress indicator.

### Step 7.3 — Write DependencyList tests

**Create:** `renderer/components/github-issues/components/__tests__/DependencyList.test.tsx`

Tests (~6):
- Renders "Tracks" section with outgoing dependencies
- Renders "Tracked by" section with incoming dependencies
- Shows issue number and title for each dependency
- Shows state badge (open/closed) for each dependency
- Click on dependency calls onNavigate
- Shows empty state when no dependencies
- Shows error message when API unavailable

### Step 7.4 — Implement DependencyList

**Create:** `renderer/components/github-issues/components/DependencyList.tsx`

Two sections (tracks/trackedBy), clickable issue links, state badges.

### Step 7.5 — Write MetricsDashboard tests

**Create:** `renderer/components/github-issues/components/__tests__/MetricsDashboard.test.tsx`

Tests (~7):
- Renders state count for each workflow state
- Renders average time display
- Renders weekly throughput values
- Renders completeness distribution
- Renders backlog age
- Shows empty state when no data
- Time window selector changes displayed data
- Shows "Last updated" timestamp

### Step 7.6 — Implement MetricsDashboard

**Create:** `renderer/components/github-issues/components/MetricsDashboard.tsx`

Stats cards, bar displays (CSS-based, no chart library), time window filter.

**Package verification:**
- All 20 component tests pass (7 + 6 + 7)

---

## WP-8: Integration + i18n

**Goal:** Wire components into existing UI, add translations, write integration test.

### Step 8.1 — Add i18n keys

**Modify:** `shared/i18n/locales/en/common.json` and `fr/common.json`

Add keys for:
- `labelSync.*`: settings, status, colors, actions (~15 keys)
- `dependencies.*`: section headers, empty state (~6 keys)
- `metrics.*`: dashboard labels, time windows, empty state (~15 keys)
- `triageMode.*`: toggle button, panel labels, keyboard hints (~6 keys)

### Step 8.2 — Extend GitHubIssues.tsx with 3-panel layout

**Modify:** `renderer/components/GitHubIssues.tsx`

- Add `layoutMode` state (`'2-panel' | '3-panel'`)
- Replace fixed `w-1/2` with dynamic widths based on mode
- In 3-panel: `w-1/4 | w-1/2 | w-1/4` with min-width constraints
- Pass `compact` prop to `IssueList` in 3-panel mode
- Add metrics view toggle

### Step 8.3 — Extend IssueDetail.tsx with dependencies

**Modify:** `renderer/components/github-issues/components/IssueDetail.tsx`

- Fetch dependencies on issue selection
- Render `<DependencyList>` section after body

### Step 8.4 — Extend IssueListHeader.tsx with triage toggle

**Modify:** `renderer/components/github-issues/components/IssueListHeader.tsx`

- Add "Triage Mode" toggle button with i18n label

### Step 8.5 — Extend IssueList.tsx with compact mode

**Modify:** `renderer/components/github-issues/components/IssueList.tsx`

- Accept `compact?: boolean` prop
- When compact: hide body preview, reduce padding

### Step 8.6 — Write integration test

**Create:** `renderer/components/github-issues/__tests__/label-sync-integration.test.ts`

Tests:
- Label sync config + constants consistency (all states mapped)
- `getStateFromLabel` ↔ `getLabelForState` roundtrip
- Metrics `getCompletenessCategory` at boundaries
- Dependencies `hasDependencies` with various inputs
- Store lifecycle: disabled → enable → syncing → synced

**Package verification:**
- All integration tests pass
- All existing tests still pass

---

## WP-9: Verification

**Goal:** Full test suite, lint, file inventory verification.

### Step 9.1 — Run full test suite

Expect ~3670+ tests passing (3521 current + ~150 new Phase 4 tests).

### Step 9.2 — Lint all new files

Run `biome check` on all 12 new source files. Fix all warnings.

### Step 9.3 — Verify file inventory

Cross-reference file list against this plan. Ensure all 12 source + 12 test files exist.

### Step 9.4 — Commit

Final lint-fix commit if needed.

**Package verification:**
- 170+ test files, 3670+ tests, 0 failures
- 0 lint warnings on Phase 4 files
