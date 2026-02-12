# Phase 4 Brownfield Analysis: Polish + Extras

**Date:** 2026-02-12
**Scope:** Label sync to GitHub, 3-panel triage mode, dependencies (read-only), metrics dashboard
**Methodology:** Inventory every existing file Phase 4 must touch/extend, map extension points and risks

---

## Executive Summary

- Phase 4 extends 4 distinct subsystems: GitHub API (label CRUD), layout system (2→3 panel), enrichment persistence (transitions data for metrics), and settings infrastructure
- The `WORKFLOW_LABEL_MAP` constant and `syncToGitHub?: boolean` parameter were designed into Phases 1-2 but never activated — Phase 4 wires them up
- 3-panel layout requires refactoring `GitHubIssues.tsx` (286 LOC) from fixed `w-1/2` split to dynamic panel widths
- Metrics dashboard reads existing `transitions.json` data — no new persistence needed, only aggregation logic and visualization
- Dependencies feature uses GitHub GraphQL API (`tracks`/`tracked-by` fields) — read-only, no mutations
- Label sync uses `gh label create/edit/delete` and `gh issue edit --add-label/--remove-label` — same CLI pattern as Phase 2 mutations

---

## 1. Label Sync Subsystem

### 1.1 Enrichment Types — WorkflowState Mapping

**File:** `shared/types/enrichment.ts` (158 LOC)

Exports `WorkflowState` type: `'new' | 'triage' | 'ready' | 'in_progress' | 'review' | 'done' | 'blocked'`. This is the source of truth for the `WORKFLOW_LABEL_MAP` constant Phase 4 introduces.

**Extension point:** No changes to this file. New `WORKFLOW_LABEL_MAP` constant goes in `shared/constants/label-sync.ts`.

### 1.2 Enrichment Handlers — Transition Hook

**File:** `main/ipc-handlers/github/enrichment-handlers.ts` (172 LOC)

Registers `GITHUB_ENRICHMENT_TRANSITION` handler that validates and executes workflow state transitions. Currently updates local `enrichment.json` only.

**Extension point:** After successful transition (line ~87), call label sync if enabled. Pattern: read `syncToGitHub` setting → if enabled, queue label update (debounced). Must not block the transition response.

### 1.3 Mutation Handlers — Existing gh CLI Pattern

**File:** `main/ipc-handlers/github/mutation-handlers.ts` (~400 LOC)

Established pattern: `execFileSync(ghPath, args, { env: getAugmentedEnv(), ... })` for `gh issue edit --add-label`, `--remove-label`. Temp file pattern for large bodies.

**Extension point:** Label sync reuses the same `execFileSync` + `getAugmentedEnv` pattern. New handler for `gh label create`, `gh label edit`, `gh label delete` (repo-level operations).

### 1.4 Settings Types — syncToGitHub Field

**File:** `shared/types/settings.ts` (315 LOC)

`AppSettings` interface at line 219. Currently has `featureModels.githubIssues` and `featureThinking.githubIssues` but no label sync settings.

**Extension point:** Add `labelSync?: LabelSyncSettings` field to `AppSettings`. New interface: `LabelSyncSettings { enabled: boolean; prefix: string; colorFamily: string }`.

### 1.5 Settings Store — Persistence

**File:** `renderer/stores/settings-store.ts` (416 LOC)

`updateSettings(updates)` at line ~160 accepts partial `AppSettings` and persists via IPC. No store changes needed — just add settings fields to the type.

**Extension point:** None — existing `saveSettings()` flow handles new fields automatically.

### 1.6 i18n Placeholder Keys

**File:** `shared/i18n/locales/en/common.json`

Already contains `settingsLabelSync.title` and `settingsLabelSync.comingSoon` keys (lines 543-546). Phase 4 replaces "coming soon" with functional UI.

**Extension point:** Replace placeholder keys with full label sync settings keys.

### 1.7 GitHub API Utilities

**File:** `main/ipc-handlers/github/utils.ts` (354 LOC)

Exports `githubFetch()` for REST API calls and `getGitHubTokenForSubprocess()` for auth. Also `getAugmentedEnv()` for gh CLI PATH.

**Extension point:** Label CRUD can use either `gh label create/edit/delete` CLI commands or `githubFetch()` REST calls. CLI approach is consistent with existing patterns and simpler.

---

## 2. 3-Panel Layout Subsystem

### 2.1 Main Issues Container

**File:** `renderer/components/GitHubIssues.tsx` (286 LOC)

Current layout (lines 202-241): `flex` container with two `w-1/2` children — `IssueList` and `IssueDetail`. Selected issue state at line ~75.

**Extension point:** Replace fixed `w-1/2` with dynamic widths controlled by `layoutMode` state. Add `TriageModeToggle` button in header. 3-panel splits: `w-1/4 | w-1/2 | w-1/4` or resizable.

### 2.2 Issue Detail Panel

**File:** `renderer/components/github-issues/components/IssueDetail.tsx` (234 LOC)

Contains `<EnrichmentPanel>` at lines 182-198. In 3-panel mode, enrichment moves to the third panel (triage sidebar).

**Extension point:** Conditionally render `<EnrichmentPanel>` inline (2-panel) or pass enrichment data to separate `<TriageSidebar>` (3-panel).

### 2.3 Issue List Component

**File:** `renderer/components/github-issues/components/IssueList.tsx`

Renders scrollable issue list with `<IssueListItem>` children. In 3-panel mode, needs compact variant (smaller cards, fewer fields visible).

**Extension point:** Add `compact?: boolean` prop that hides body preview, reduces padding, shows only title + badges.

### 2.4 Enrichment Panel

**File:** `renderer/components/github-issues/components/EnrichmentPanel.tsx` (125 LOC)

Current: workflow dropdown, priority badge, completeness indicator, AI action buttons, enrichment sections. In 3-panel mode, this becomes the standalone triage sidebar content.

**Extension point:** No changes needed — component is already self-contained and receives all data via props.

### 2.5 Issue List Header

**File:** `renderer/components/github-issues/components/IssueListHeader.tsx`

Contains search, filters, action buttons. Needs a "Triage Mode" toggle button.

**Extension point:** Add `onToggleTriageMode` callback prop and toggle button.

---

## 3. Dependencies Subsystem (Read-Only)

### 3.1 GitHub GraphQL API

Dependencies use GitHub's native `trackedBy` and `trackedIn` fields, available via GraphQL API. The `gh api graphql` command supports this.

**Extension point:** New IPC handler that runs `gh api graphql -f query='...'` to fetch dependency data for a given issue.

### 3.2 Issue Detail — Dependency Display

**File:** `renderer/components/github-issues/components/IssueDetail.tsx` (234 LOC)

After the body section (line 179), add a "Dependencies" section showing tracked/tracked-by relationships.

**Extension point:** New `<DependencyList>` component rendered in IssueDetail when dependency data is available.

### 3.3 Issue Types

**File:** `shared/types/github.ts`

Contains `GitHubIssue` interface. Dependencies are not part of the REST API response — they require a separate GraphQL query.

**Extension point:** New `IssueDependency` type in a new types file. Keep separate from `GitHubIssue` to avoid mixing REST/GraphQL data.

---

## 4. Metrics Dashboard Subsystem

### 4.1 Transitions Data

**File:** `main/ipc-handlers/github/enrichment-persistence.ts`

Persists `transitions.json` alongside `enrichment.json`. Each transition record contains: `issueNumber`, `from`, `to`, `actor`, `timestamp`, `resolution?`.

**Extension point:** New IPC handler to read and aggregate transition data. No new persistence needed — data already exists.

### 4.2 Enrichment Store — State Counts

**File:** `renderer/stores/github/enrichment-store.ts` (154 LOC)

Already exports `getStateCounts()` selector that returns `Record<WorkflowState, number>`.

**Extension point:** Add `getTransitionMetrics()` that computes average time in state, throughput, backlog age from transitions data.

### 4.3 Completeness Scores

Already computed and stored in `IssueEnrichment.completenessScore` (0-100). Metrics dashboard displays distribution histogram.

**Extension point:** New selector `getCompletenessDistribution()` that buckets scores into ranges.

---

## 5. Risk Matrix

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Label sync rate limit during bulk transition | HIGH | MEDIUM | 2s debounce, batch via GraphQL (50/request), queue with backoff |
| 100-label limit per issue blocks `ac:` label creation | MEDIUM | LOW | Check label count before adding, warn user if near limit |
| 3-panel layout breaks on narrow screens | MEDIUM | MEDIUM | Min-width threshold, auto-fallback to 2-panel below 1200px |
| GraphQL dependencies API not available on all GitHub plans | LOW | MEDIUM | Graceful fallback — show "Dependencies not available" message |
| Metrics computation slow for large repos (1000+ transitions) | MEDIUM | LOW | Compute in main process, cache results, incremental updates |
| Label color conflicts with existing repo labels | LOW | LOW | Use distinctive teal/cyan family, preview before enabling |
| Concurrent label sync + manual label edit | MEDIUM | LOW | One-directional (AC→GH) eliminates bidirectional conflicts |
