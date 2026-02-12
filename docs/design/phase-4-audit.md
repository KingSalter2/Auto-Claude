# Phase 4 Cross-Reference Audit

**Date:** 2026-02-12
**Status:** Final
**Scope:** Cross-reference every PRD acceptance criterion against implementation plan steps and tests
**Method:** Map each AC to WP step, verify test coverage, identify gaps

---

## Audit Results

### Summary

| User Story | AC Count | Covered | Gaps |
|------------|----------|---------|------|
| US-1: Enable Label Sync | 8 | 8 | 0 |
| US-2: Auto Label Sync | 7 | 6 | 1 |
| US-3: Disable + Cleanup | 5 | 5 | 0 |
| US-4: Triage Mode | 9 | 8 | 1 |
| US-5: Keyboard Navigation | 5 | 4 | 1 |
| US-6: Dependencies | 8 | 8 | 0 |
| US-7: Metrics Dashboard | 10 | 10 | 0 |
| US-8: Label Sync Settings | 6 | 6 | 0 |
| **Total** | **58** | **55** | **3** |

**Severity breakdown:** 1 MUST-FIX, 1 SHOULD-FIX, 1 COSMETIC

---

## Cross-Reference Matrix

### US-1: Enable Label Sync

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC1.1 | Settings UI shows toggle | WP-7 Step 7.1 | LabelSyncSettings test: renders toggle |
| AC1.2 | Defaults to disabled | WP-1 Step 1.1 | label-sync-types test: default disabled |
| AC1.3 | Creates 7 `ac:*` labels | WP-2 Step 2.1 | Handler test: creates all labels |
| AC1.4 | Teal/cyan colors + description | WP-1 Step 1.4 | Constants test: colors are valid hex |
| AC1.5 | Updates existing labels | WP-2 Step 2.1 | Handler test: --force flag |
| AC1.6 | Progress indicator | WP-7 Step 7.1 | LabelSyncSettings test: progress bar |
| AC1.7 | Error toast | WP-2 Step 2.1 | Handler test: partial failure |
| AC1.8 | i18n keys | WP-8 Step 8.1 | Integration: keys present in both locales |

### US-2: Automatic Label Sync

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC2.1 | Remove old label, add new | WP-2 Step 2.1 | Handler test: sync removes/adds |
| AC2.2 | 2-second debounce | WP-1 Step 1.4 | Constants test: SYNC_DEBOUNCE_MS = 2000 |
| AC2.3 | Async, non-blocking | WP-2 Step 2.2 | Handler: uses fire-and-forget pattern |
| AC2.4 | Failure toast | WP-6 Step 6.2 | Hook: error handling |
| AC2.5 | Skip if already correct | **GAP-1** | — |
| AC2.6 | Works for single + bulk | WP-2 Step 2.1 | Handler tests: single + bulk |
| AC2.7 | Bulk batched per 2s window | WP-2 Step 2.1 | Handler test: bulk sync |

### US-3: Disable + Cleanup

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC3.1 | Prompt on disable | WP-7 Step 7.1 | LabelSyncSettings: confirmation flow |
| AC3.2 | Remove labels + definitions | WP-2 Step 2.1 | Handler test: cleanup |
| AC3.3 | Keep option | WP-2 Step 2.1 | Handler test: cleanup: false |
| AC3.4 | Progress indicator | WP-7 Step 7.1 | LabelSyncSettings: progress |
| AC3.5 | Partial failure reported | WP-2 Step 2.1 | Handler test: partial failure |

### US-4: Triage Mode

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC4.1 | Toggle button in header | WP-8 Step 8.4 | IssueListHeader: toggle button |
| AC4.2 | Click toggles layout | WP-8 Step 8.2 | GitHubIssues: layout state |
| AC4.3 | 3-panel: list/detail/sidebar | WP-8 Step 8.2 | GitHubIssues: 3-panel rendering |
| AC4.4 | Compact list in 3-panel | WP-8 Step 8.5 | IssueList: compact prop |
| AC4.5 | Sidebar = enrichment panel | WP-8 Step 8.2 | EnrichmentPanel in third panel |
| AC4.6 | Preference persisted | WP-8 Step 8.2 | Settings: layoutMode saved |
| AC4.7 | Disabled below 1200px | **GAP-2** | — |
| AC4.8 | aria-label on each panel | WP-8 Step 8.2 | Regions with aria-label |
| AC4.9 | i18n keys | WP-8 Step 8.1 | triageMode.* keys |

### US-5: Keyboard Navigation

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC5.1 | Ctrl+1 focuses list | WP-8 Step 8.2 | Keyboard handler in GitHubIssues |
| AC5.2 | Ctrl+2 focuses detail | WP-8 Step 8.2 | Keyboard handler |
| AC5.3 | Ctrl+3 focuses sidebar | WP-8 Step 8.2 | Keyboard handler |
| AC5.4 | Only in 3-panel mode | WP-8 Step 8.2 | Guard on layoutMode |
| AC5.5 | role="region" + aria-label | **GAP-3** (overlaps AC4.8) | — |

### US-6: Dependencies

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC6.1 | Dependencies section | WP-8 Step 8.3 | IssueDetail: DependencyList |
| AC6.2 | "Tracks" subsection | WP-7 Step 7.3 | DependencyList test: tracks |
| AC6.3 | "Tracked by" subsection | WP-7 Step 7.3 | DependencyList test: trackedBy |
| AC6.4 | Number, title, state | WP-7 Step 7.3 | DependencyList test: renders info |
| AC6.5 | Click navigates | WP-7 Step 7.3 | DependencyList test: onNavigate |
| AC6.6 | Unavailable API message | WP-7 Step 7.3 | DependencyList test: error state |
| AC6.7 | Fetch on selection | WP-8 Step 8.3 | IssueDetail: fetch on select |
| AC6.8 | i18n keys | WP-8 Step 8.1 | dependencies.* keys |

### US-7: Metrics Dashboard

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC7.1 | Accessible from Issues view | WP-8 Step 8.2 | GitHubIssues: metrics toggle |
| AC7.2 | Issues-by-state | WP-7 Step 7.5 | MetricsDashboard test: state counts |
| AC7.3 | Avg time in state | WP-7 Step 7.5 | MetricsDashboard test: time display |
| AC7.4 | Weekly throughput | WP-7 Step 7.5 | MetricsDashboard test: throughput |
| AC7.5 | Completeness distribution | WP-7 Step 7.5 | MetricsDashboard test: distribution |
| AC7.6 | Backlog age | WP-7 Step 7.5 | MetricsDashboard test: backlog |
| AC7.7 | Empty state | WP-7 Step 7.5 | MetricsDashboard test: empty |
| AC7.8 | Time window filter | WP-7 Step 7.5 | MetricsDashboard test: selector |
| AC7.9 | Computed in main process | WP-3 Step 3.4 | metrics-handlers: computation |
| AC7.10 | i18n keys | WP-8 Step 8.1 | metrics.* keys |

### US-8: Label Sync Settings

| AC | Description | WP | Test |
|----|-------------|-----|------|
| AC8.1 | Replaces Phase 2 placeholder | WP-8 Step 8.1 | Remove comingSoon key |
| AC8.2 | Shows sync status | WP-7 Step 7.1 | LabelSyncSettings test: status |
| AC8.3 | Shows prefix | WP-7 Step 7.1 | LabelSyncSettings test: prefix |
| AC8.4 | Color preview | WP-7 Step 7.1 | LabelSyncSettings test: colors |
| AC8.5 | Sync Now button | WP-7 Step 7.1 | LabelSyncSettings test: button |
| AC8.6 | i18n keys | WP-8 Step 8.1 | labelSync.* keys |

---

## MUST-FIX (Blocks correctness)

### GAP-1: Skip sync when label already correct (AC2.5)

**PRD:** AC2.5: "If issue already has the correct `ac:*` label, no API call is made"

**Implementation Plan:** WP-2 handler tests cover add/remove but not the "already correct" optimization.

**Problem:** Without this check, every transition triggers an API call even if the label is already set (e.g., after a manual "Sync Now" that already synced everything).

**Fix:** In `syncIssueLabel` handler, before calling `gh issue edit`, fetch current labels and check if `ac:<state>` already present. Skip if so.

**Add to WP-2:** Add test: "syncIssueLabel skips when correct label already present"
**Add test:** Mock `execFileSync` for `gh issue view --json labels`, verify no edit call when label matches.

---

## SHOULD-FIX (Quality/UX concerns)

### GAP-2: Min-width enforcement for 3-panel mode (AC4.7)

**PRD:** AC4.7: "If window width < 1200px, 3-panel is disabled with tooltip explaining minimum width"

**Implementation Plan:** WP-8 Step 8.2 mentions "min-width constraints" but no explicit test for the 1200px threshold or tooltip.

**Problem:** Without enforcing the threshold, users on small screens can activate triage mode and get unusable narrow panels.

**Fix:** Add `useEffect` with window resize listener. When width drops below 1200px and in 3-panel mode, auto-switch to 2-panel with toast. Triage mode button disabled below threshold with title tooltip.

**Add to WP-8:** Add test for min-width guard.

---

## COSMETIC (Nice-to-have)

### GAP-3: role="region" duplication (AC5.5 ↔ AC4.8)

**PRD:** AC5.5 and AC4.8 both specify `role="region"` with `aria-label` on panels. Same requirement stated in two places.

**Problem:** Not a real gap — just duplicated criteria. Implementation covers both via the same code.

**Fix:** No code change needed. Note in test that both ACs are covered by the same assertion.

---

## File Inventory Audit

| Category | Plan Count | Verified |
|----------|------------|----------|
| New source files | 12 | 12 listed in inventory |
| New test files | 12 | 12 listed in inventory |
| Modified files | 10 | 10 listed in inventory |
| Total new tests (estimated) | ~150 | Sufficient coverage |

**IPC channels:** 10 new channels listed. Each has corresponding preload API method and handler.

**i18n:** Keys specified for EN + FR in WP-8.

**Accessibility:** `role="region"`, `aria-label`, keyboard shortcuts specified.

---

## Recommended Actions

1. **GAP-1 (MUST-FIX):** Add "skip if already synced" test and implementation to WP-2
2. **GAP-2 (SHOULD-FIX):** Add min-width threshold test to WP-8
3. **GAP-3 (COSMETIC):** No action — note in test comments
