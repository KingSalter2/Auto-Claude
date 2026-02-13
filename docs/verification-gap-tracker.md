# Verification Gap Tracker — Issues Tab Enhancement (Round 2)

**Branch:** `terminal/enhancement-issues-tab`
**Created:** 2026-02-13
**Total Gaps:** 46 confirmed (from 9-agent triple-verified audit)
**Status:** 12 / 17 complete

---

## How to Use This File

Each gap has: ID, description, status, files to modify, verification source, test status, and notes.

**Status values:**
- `PENDING` — Not started
- `IN_PROGRESS` — Currently being worked on
- `DONE` — Implemented, tested, committed
- `BLOCKED` — Waiting on another gap
- `SKIPPED` — Decided not to implement (with reason)

**Workflow per gap:**
1. Write/update tests first (TDD)
2. Implement the fix
3. Run tests — all must pass
4. Run lint (`npm run lint`)
5. Update this file
6. Commit with message referencing gap ID

---

## TIER 1 — Critical Wiring (Features built but not connected)

### VGAP-01: `onCreateSpec` not passed to IssueDetail in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Verified by:** Phase4+5 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 5 PRD > US-4; Phase 2 PRD > US-8
- **Files modified:** `renderer/components/GitHubIssues.tsx`
- **Fix:** Created `handleCreateSpec` useCallback that calls `window.electronAPI.github.createSpecFromIssue()` and returns `{ specNumber }`. Passed as `onCreateSpec={handleCreateSpec}` to IssueDetail.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-01+02

### VGAP-02: TriageSidebar missing dependency props in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Verified by:** Phase4+5 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 5 PRD > US-6 > AC-6.1; Phase 5 PRD > US-8 > AC-8.3
- **Files modified:** `renderer/components/GitHubIssues.tsx`
- **Fix:** Added `dependencies={dependencies}`, `isDepsLoading={isDepsLoading}`, `depsError={depsError}` to TriageSidebar JSX. Data already available from useDependencies hook.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-01+02

---

## TIER 2 — i18n Hardcoded Strings

### VGAP-03: BulkActionBar.tsx hardcoded action labels (8 strings)
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** CLAUDE.md > i18n required
- **Files modified:** `renderer/components/github-issues/components/BulkActionBar.tsx`, `shared/i18n/locales/en/common.json`, `shared/i18n/locales/fr/common.json`
- **Fix:** Changed `BULK_ACTIONS` constant to use `labelKey` instead of `label`, rendering via `t(labelKey)`. Replaced `{selectedCount} selected` with `t('bulk.selected', { count })`. Replaced `Processing X/Y...` with `t('bulk.processing', { current, total })`. Updated test expectations to match i18n keys.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-03..07

### VGAP-04: EmptyStates.tsx hardcoded strings (4 strings)
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** CLAUDE.md > i18n required
- **Files modified:** `renderer/components/github-issues/components/EmptyStates.tsx`, `shared/i18n/locales/en/common.json`, `shared/i18n/locales/fr/common.json`
- **Fix:** Added `useTranslation('common')` to both EmptyState and NotConnectedState. Replaced 4 hardcoded strings with `t('issues.emptySearch')`, `t('issues.notConnected')`, `t('issues.configureToken')`, `t('issues.openSettings')`.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-03..07

### VGAP-05: IssueListHeader.tsx hardcoded strings (9+ strings)
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** CLAUDE.md > i18n required
- **Files modified:** `renderer/components/github-issues/components/IssueListHeader.tsx`, `shared/i18n/locales/en/common.json`, `shared/i18n/locales/fr/common.json`
- **Fix:** Replaced 10 hardcoded strings with `t()` calls: title, openCount (with interpolation), analyzeGroup, analyzeGroupTooltip, autoFixNew, autoFixTooltip, autoFixProcessing (with interpolation), searchPlaceholder, filterOpen/Closed/All.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-03..07

### VGAP-06: LabelManager.tsx hardcoded strings (3 strings)
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** CLAUDE.md > i18n required
- **Files modified:** `renderer/components/github-issues/components/LabelManager.tsx`, `shared/i18n/locales/en/common.json`, `shared/i18n/locales/fr/common.json`
- **Fix:** Added `useTranslation('common')`. Replaced `'Add Label'` → `t('labels.add')`, `'Filter labels...'` → `t('labels.filter')`, `'No matching labels'` → `t('labels.noMatch')`.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-03..07

### VGAP-07: AssigneeManager.tsx hardcoded strings (3 strings)
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** CLAUDE.md > i18n required
- **Files modified:** `renderer/components/github-issues/components/AssigneeManager.tsx`, `shared/i18n/locales/en/common.json`, `shared/i18n/locales/fr/common.json`
- **Fix:** Added `useTranslation('common')`. Replaced `'Assign'` → `t('assignees.assign')`, `'Search collaborators...'` → `t('assignees.search')`, `'No matching collaborators'` → `t('assignees.noMatch')`.
- **Tests:** 3860 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-03..07

---

## TIER 3 — Accessibility Keyboard Support

### VGAP-08: LabelManager dropdown options missing keyboard handlers
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** Design doc > Section 8.4 Accessibility
- **Files modified:** `renderer/components/github-issues/components/LabelManager.tsx`, `__tests__/LabelManager.test.tsx`
- **Fix:** Added `onKeyDown` handler to `role="option"` divs: Enter/Space to select (with `preventDefault`), Escape to close dropdown and reset search.
- **Tests:** 4 new tests: Enter key select, Space key select, Escape close, Enter on applied label no-op. All pass.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-08+09

### VGAP-09: AssigneeManager dropdown options missing keyboard handlers
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** i18n agent + Verifier-2 (CONFIRMED)
- **Doc ref:** Design doc > Section 8.4 Accessibility
- **Files modified:** `renderer/components/github-issues/components/AssigneeManager.tsx`, `__tests__/AssigneeManager.test.tsx`
- **Fix:** Added `onKeyDown` handler identical to LabelManager: Enter/Space to select, Escape to close dropdown.
- **Tests:** 4 new tests: Enter key select, Space key select, Escape close, Enter on assigned user no-op. All pass.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-08+09

---

## TIER 4 — IPC Consistency (Hardcoded channel strings)

### VGAP-10: dependency-handlers.ts uses hardcoded IPC channel string
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** IPC agent + Verifier-3 (CONFIRMED)
- **Doc ref:** Codebase convention — all handlers use IPC_CHANNELS constants
- **Files modified:** `main/ipc-handlers/github/dependency-handlers.ts`
- **Fix:** Added `import { IPC_CHANNELS } from '../../../shared/constants/ipc'` and replaced `'github:deps:fetch'` with `IPC_CHANNELS.GITHUB_DEPS_FETCH`.
- **Tests:** 3868 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-10..12

### VGAP-11: label-sync-handlers.ts uses 6 hardcoded IPC channel strings
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** IPC agent + Verifier-3 (CONFIRMED)
- **Doc ref:** Codebase convention
- **Files modified:** `main/ipc-handlers/github/label-sync-handlers.ts`
- **Fix:** Added `import { IPC_CHANNELS } from '../../../shared/constants/ipc'` and replaced all 6 hardcoded strings with `IPC_CHANNELS.GITHUB_LABEL_SYNC_*` constants.
- **Tests:** 3868 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-10..12

### VGAP-12: metrics-handlers.ts uses 2 hardcoded IPC channel strings
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Verified by:** IPC agent + Verifier-3 (CONFIRMED)
- **Doc ref:** Codebase convention
- **Files modified:** `main/ipc-handlers/github/metrics-handlers.ts`
- **Fix:** Added `import { IPC_CHANNELS } from '../../../shared/constants/ipc'` and replaced both hardcoded strings with `IPC_CHANNELS.GITHUB_METRICS_COMPUTE` and `IPC_CHANNELS.GITHUB_METRICS_STATE_COUNTS`.
- **Tests:** 3868 pass, lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** VGAP-10..12

---

## TIER 5 — Phase 3 Audit Gaps (Low severity, not addressed from original audit)

### VGAP-13: No validation caching for Python runner check (Phase 3 GAP-3)
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Verified by:** Phase3 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 3 audit > GAP-3
- **Files to modify:** `renderer/stores/github/ai-triage-store.ts`, `renderer/components/github-issues/hooks/useAITriage.ts`
- **Problem:** Every render triggers `validateGitHubModule()` IPC call. No caching with TTL.
- **Fix:** Add `lastValidation: { valid: boolean; checkedAt: number } | null` to ai-triage-store. In useAITriage, check cache (5-minute TTL) before calling validation.
- **Tests:** Test cache hit/miss behavior, TTL expiry
- **Test status:** —
- **Depends on:** None
- **Commit:** —

### VGAP-14: Undo batch only reverts local state, not GitHub labels (Phase 3 GAP-4)
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Large
- **Verified by:** Phase3 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 3 PRD > US-4 > AC4.9; Phase 3 audit > GAP-4
- **Files to modify:** `renderer/stores/github/ai-triage-store.ts`, `renderer/components/github-issues/hooks/useAITriage.ts`
- **Problem:** `undoLastBatch` (line 132-136) only reverts `reviewItems` to snapshot. Does NOT call IPC to remove labels that were already applied to GitHub issues.
- **Fix:** Store `lastBatchApplied: Array<{ issueNumber: number; labelsAdded: string[]; labelsRemoved: string[] }>` in store. Undo iterates and calls removeLabels/addLabels mutations to reverse changes.
- **Tests:** Test undo calls correct IPC remove/add label calls
- **Test status:** —
- **Depends on:** None
- **Commit:** —

### VGAP-15: No enrichment comment duplicate detection (Phase 3 GAP-5)
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Verified by:** Phase3 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 3 PRD > US-5 > AC5.11; Phase 3 audit > GAP-5
- **Files to modify:** `renderer/components/github-issues/components/EnrichmentCommentPreview.tsx`, `renderer/components/github-issues/hooks/useAITriage.ts`
- **Problem:** No check for existing AI comments (containing `ENRICHMENT_COMMENT_FOOTER`) before showing preview. Can double-post enrichment comments.
- **Fix:** Before showing preview, check issue comments for `ENRICHMENT_COMMENT_FOOTER` string. Show warning banner if existing comment found.
- **Tests:** Test warning displays when existing AI comment detected
- **Test status:** —
- **Depends on:** None
- **Commit:** —

### VGAP-16: No cancel mechanism for batch triage subprocess (Phase 3 GAP-7)
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Verified by:** Phase3 agent + Verifier-1 (CONFIRMED)
- **Doc ref:** Phase 3 PRD > US-2 > AC2.6; Phase 3 audit > GAP-7
- **Files to modify:** `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Problem:** `runPythonSubprocess()` returns `{ process, promise }` but the process object is not stored for cancellation. Cancel button in TriageProgressOverlay has no kill mechanism.
- **Fix:** Store process reference in handler scope. Add IPC channel `github:triage:cancel` that sends SIGTERM to the stored process. Wire cancel button to call this channel.
- **Tests:** Test cancel IPC kills the subprocess
- **Test status:** —
- **Depends on:** None
- **Commit:** —

### VGAP-17: Review queue not persisted across sessions (Phase 3 GAP-9)
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Verified by:** Phase3 agent (CONFIRMED)
- **Doc ref:** Phase 3 audit > GAP-9
- **Files to modify:** `renderer/stores/github/ai-triage-store.ts`, `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Problem:** If user dismisses review queue without accepting/rejecting all, results are lost on next session.
- **Fix:** Persist review queue to `enrichment.json` under a `pendingReview` key. Load on startup.
- **Tests:** Test persistence and reload of pending review items
- **Test status:** —
- **Depends on:** None
- **Commit:** —

---

## Progress Summary

| Tier | Description | Total | Done | Remaining |
|------|-------------|-------|------|-----------|
| 1 | Critical Wiring | 2 | 2 | 0 |
| 2 | i18n Hardcoded Strings | 5 | 5 | 0 |
| 3 | Accessibility Keyboard | 2 | 2 | 0 |
| 4 | IPC Consistency | 3 | 3 | 0 |
| 5 | Phase 3 Audit Gaps | 5 | 0 | 5 |
| **Total** | | **17** | **12** | **5** |

Note: VGAP-03 through VGAP-07 contain 28+ individual hardcoded strings grouped by component file. The 17 gap count represents work units (one per component/file), not individual string count.
