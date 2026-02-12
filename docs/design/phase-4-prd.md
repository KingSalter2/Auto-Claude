# Phase 4 PRD: Polish + Extras

**Status:** Final
**Parent:** [Design Document](design-document.md) Section 14, [Decisions Registry](../README.md) Decisions 3, 4, 11, 23
**Phase:** 4 of 4
**Scope:** Label sync to GitHub, 3-panel triage mode, read-only dependencies, metrics dashboard

---

## 1. Objective

Phase 4 completes the Issues Tab transformation by adding GitHub visibility (label sync), an advanced triage layout (3-panel mode), issue relationship awareness (dependencies), and operational analytics (metrics dashboard).

After Phase 4, local workflow state is optionally visible on GitHub via `ac:` namespaced labels, the triage workflow has a dedicated focused layout, dependencies between issues are surfaced, and team leads can track triage velocity and backlog health.

**User-visible outcome:** Workflow state labels appear on GitHub issues (opt-in), triage mode provides a focused 3-panel layout, issue dependencies are visible in the detail panel, and a metrics view shows triage throughput and backlog health.

---

## 2. User Stories

### US-1: Enable Label Sync

**As a** team lead,
**I want to** opt-in to syncing workflow state labels to GitHub,
**So that** other team members see triage status directly on GitHub without using Auto-Claude.

**Acceptance Criteria:**
- AC1.1: Settings UI shows "Label Sync" section with enable/disable toggle
- AC1.2: Toggle defaults to disabled
- AC1.3: When enabled, Auto-Claude creates `ac:new`, `ac:triage`, `ac:ready`, `ac:in-progress`, `ac:review`, `ac:done`, `ac:blocked` labels in the repo
- AC1.4: Labels use distinctive teal/cyan color family and description "Managed by Auto-Claude"
- AC1.5: If labels already exist with `ac:` prefix, colors are updated to match scheme
- AC1.6: Enable operation shows progress indicator
- AC1.7: Error during label creation shows toast with specific error
- AC1.8: All text uses i18n keys

### US-2: Automatic Label Sync on Transition

**As a** user,
**I want** workflow state labels to sync automatically when I transition an issue,
**So that** GitHub always reflects the current triage state without manual effort.

**Acceptance Criteria:**
- AC2.1: When label sync is enabled and an issue transitions state, the old `ac:*` state label is removed and the new one is added
- AC2.2: Sync is debounced by 2 seconds to batch rapid transitions
- AC2.3: Sync happens asynchronously — transition response returns immediately
- AC2.4: Sync failure shows non-blocking toast notification
- AC2.5: If issue already has the correct `ac:*` label, no API call is made
- AC2.6: Works for single transitions and bulk transitions (Phase 3 batch triage)
- AC2.7: Bulk transitions are batched into a single sync operation per 2-second window

### US-3: Disable Label Sync and Cleanup

**As a** user,
**I want to** disable label sync and optionally remove all `ac:` labels from GitHub,
**So that** I can cleanly disconnect without leaving orphaned labels.

**Acceptance Criteria:**
- AC3.1: Disabling sync shows prompt: "Remove all ac: labels from GitHub?"
- AC3.2: "Remove" option removes `ac:*` labels from all issues, then deletes label definitions
- AC3.3: "Keep" option disables sync but leaves existing labels in place
- AC3.4: Cleanup shows progress indicator with issue count
- AC3.5: Partial cleanup failure is reported but doesn't block disable

### US-4: Enter Triage Mode (3-Panel Layout)

**As a** triager,
**I want to** switch to a 3-panel layout optimized for triage,
**So that** I can see the issue list, issue content, and triage tools simultaneously.

**Acceptance Criteria:**
- AC4.1: "Triage Mode" toggle button visible in issue list header
- AC4.2: Click toggles between 2-panel (default) and 3-panel layout
- AC4.3: 3-panel layout: compact issue list (left) | issue detail (center) | triage sidebar (right)
- AC4.4: Issue list in 3-panel mode shows compact cards (title + badges only, no body preview)
- AC4.5: Triage sidebar contains: workflow state dropdown, completeness indicator, AI action buttons, enrichment sections
- AC4.6: Layout preference is persisted in settings
- AC4.7: If window width < 1200px, 3-panel is disabled with tooltip explaining minimum width
- AC4.8: `aria-label` on each panel region for accessibility
- AC4.9: All text uses i18n keys

### US-5: Keyboard Navigation in Triage Mode

**As a** power user,
**I want** keyboard shortcuts to navigate between triage panels,
**So that** I can triage quickly without using the mouse.

**Acceptance Criteria:**
- AC5.1: `Ctrl+1` focuses the issue list panel
- AC5.2: `Ctrl+2` focuses the issue detail panel
- AC5.3: `Ctrl+3` focuses the triage sidebar panel
- AC5.4: Shortcuts only active when in 3-panel mode
- AC5.5: Each panel has `role="region"` with descriptive `aria-label`

### US-6: View Issue Dependencies

**As a** developer,
**I want to** see which issues track or are tracked by the current issue,
**So that** I understand the dependency graph before starting work.

**Acceptance Criteria:**
- AC6.1: Issue detail shows "Dependencies" section when dependency data exists
- AC6.2: "Tracks" subsection lists issues this issue tracks (outgoing)
- AC6.3: "Tracked by" subsection lists issues that track this issue (incoming)
- AC6.4: Each dependency shows issue number, title, and state (open/closed)
- AC6.5: Click on a dependency navigates to that issue in the list
- AC6.6: If GraphQL API is unavailable, section shows "Dependencies not available" message
- AC6.7: Dependencies are fetched on issue selection (not eagerly for all issues)
- AC6.8: All text uses i18n keys

### US-7: View Metrics Dashboard

**As a** team lead,
**I want to** see triage metrics and backlog health at a glance,
**So that** I can track triage velocity and identify bottlenecks.

**Acceptance Criteria:**
- AC7.1: "Metrics" tab or section accessible from the Issues view
- AC7.2: Shows issues-by-state breakdown (bar chart or counts)
- AC7.3: Shows average time in each state
- AC7.4: Shows triage throughput (issues triaged per week for last 4 weeks)
- AC7.5: Shows completeness score distribution (histogram: 0-25, 25-50, 50-75, 75-100)
- AC7.6: Shows backlog age (average time issues sit in `new` state)
- AC7.7: Empty state shown when no transition data exists
- AC7.8: Time window filter: "Last 7 days", "Last 30 days", "All time"
- AC7.9: Metrics computed in main process, not renderer
- AC7.10: All text uses i18n keys

### US-8: Label Sync Settings UI

**As a** user,
**I want** the settings UI to clearly show label sync configuration,
**So that** I can manage the feature without confusion.

**Acceptance Criteria:**
- AC8.1: Settings section replaces the Phase 2 disabled placeholder with functional controls
- AC8.2: Shows current sync status (enabled/disabled, last synced timestamp)
- AC8.3: Shows label prefix (default `ac:`, read-only display)
- AC8.4: Shows color preview for each workflow state label
- AC8.5: "Sync Now" button for manual full sync
- AC8.6: All text uses i18n keys

---

## 3. Technical Specification

### 3.1 New Types

```typescript
// shared/types/label-sync.ts
interface LabelSyncConfig {
  enabled: boolean;
  lastSyncedAt: string | null;
}

interface WorkflowLabel {
  name: string;
  color: string;
  description: string;
}

interface LabelSyncResult {
  created: number;
  updated: number;
  removed: number;
  errors: Array<{ label: string; error: string }>;
}

interface LabelSyncProgress {
  phase: 'creating' | 'syncing' | 'cleaning' | 'complete';
  progress: number;
  message: string;
}

// shared/types/dependencies.ts
interface IssueDependency {
  issueNumber: number;
  title: string;
  state: 'open' | 'closed';
  repo?: string;  // For cross-repo dependencies
}

interface IssueDependencies {
  tracks: IssueDependency[];
  trackedBy: IssueDependency[];
}

// shared/types/metrics.ts
interface TriageMetrics {
  stateCounts: Record<WorkflowState, number>;
  avgTimeInState: Record<WorkflowState, number>;  // milliseconds
  weeklyThroughput: Array<{ week: string; count: number }>;
  completenessDistribution: { low: number; medium: number; high: number; excellent: number };
  avgBacklogAge: number;  // milliseconds
  totalTransitions: number;
  computedAt: string;
}

type MetricsTimeWindow = '7d' | '30d' | 'all';
```

### 3.2 New IPC Channels (~12)

| Channel | Type | Purpose |
|---------|------|---------|
| `GITHUB_LABEL_SYNC_ENABLE` | handle | Create `ac:*` labels in repo |
| `GITHUB_LABEL_SYNC_DISABLE` | handle | Disable sync (optionally cleanup) |
| `GITHUB_LABEL_SYNC_ISSUE` | on | Sync single issue's label |
| `GITHUB_LABEL_SYNC_BULK` | on | Sync multiple issues' labels |
| `GITHUB_LABEL_SYNC_PROGRESS` | send | Progress events |
| `GITHUB_LABEL_SYNC_STATUS` | handle | Get current sync config |
| `GITHUB_LABEL_SYNC_SAVE` | handle | Save sync config |
| `GITHUB_DEPS_FETCH` | handle | Fetch dependencies for issue |
| `GITHUB_METRICS_COMPUTE` | handle | Compute metrics for time window |
| `GITHUB_METRICS_STATE_COUNTS` | handle | Quick state count query |

### 3.3 New Files (~12 source + ~12 test)

**Source:**
1. `shared/types/label-sync.ts` — Label sync types
2. `shared/types/dependencies.ts` — Dependency types
3. `shared/types/metrics.ts` — Metrics types
4. `shared/constants/label-sync.ts` — `WORKFLOW_LABEL_MAP`, colors, descriptions
5. `main/ipc-handlers/github/label-sync-handlers.ts` — Label CRUD + sync handlers
6. `main/ipc-handlers/github/dependency-handlers.ts` — GraphQL dependency fetch
7. `main/ipc-handlers/github/metrics-handlers.ts` — Metrics aggregation
8. `renderer/stores/github/label-sync-store.ts` — Label sync Zustand store
9. `renderer/components/github-issues/hooks/useLabelSync.ts` — Label sync hook
10. `renderer/components/github-issues/components/LabelSyncSettings.tsx` — Settings UI
11. `renderer/components/github-issues/components/DependencyList.tsx` — Dependency display
12. `renderer/components/github-issues/components/MetricsDashboard.tsx` — Metrics view

**Modified:**
1. `shared/types/settings.ts` — Add `labelSync` field to `AppSettings`
2. `shared/constants/ipc.ts` — Add 10 new channel constants
3. `shared/i18n/locales/en/common.json` — Label sync, dependencies, metrics keys
4. `shared/i18n/locales/fr/common.json` — French translations
5. `main/ipc-handlers/github/index.ts` — Register new handlers
6. `preload/api/modules/github-api.ts` — Add new API methods
7. `renderer/components/GitHubIssues.tsx` — 3-panel layout + metrics tab
8. `renderer/components/github-issues/components/IssueDetail.tsx` — Dependencies section
9. `renderer/components/github-issues/components/IssueListHeader.tsx` — Triage mode toggle
10. `renderer/components/github-issues/components/IssueList.tsx` — Compact mode

### 3.4 Label Sync Pattern

```
On transition (state change):
  1. Check settings: labelSync.enabled === true?
  2. If yes, debounce 2 seconds per issue
  3. After debounce: gh issue edit <number> --remove-label "ac:<old>" --add-label "ac:<new>"
  4. On error: toast notification, no retry (next transition will fix)

On enable:
  1. For each WorkflowState: gh label create "ac:<state>" --color XXXXXX --description "Managed by Auto-Claude" --force
  2. For each issue with enrichment: sync current state label

On disable + cleanup:
  1. For each issue: gh issue edit <number> --remove-label "ac:*"
  2. For each label: gh label delete "ac:<state>" --yes
```

---

## 4. Out of Scope

- Bidirectional label sync (GitHub → Auto-Claude) — never planned
- Custom label names (beyond prefix) — use fixed `ac:` mapping
- Label sync for non-workflow labels (e.g., priority, category)
- Editable dependencies — read-only display only
- Real-time metrics updates — manual refresh only
- Export metrics to external tools
