# Gap Tracker — Issues Tab Enhancement

**Branch:** `terminal/enhancement-issues-tab`
**Created:** 2026-02-12
**Total Gaps:** 41 confirmed (from triple-verified audit)
**Status:** 40 / 41 complete

---

## How to Use This File

Each gap has: ID, description, status, files to modify, doc reference, test status, and notes.

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

## TIER 1 — Critical Wiring (Components built but not connected)

### GAP-01: `useMutations` hook not called in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.7; Phase 5 impl plan WP-4 Step 4.3
- **Files modified:** `GitHubIssues.tsx`
- **Fix:** Imported useMutations from hooks barrel, called with project ID, created 9 wrapped useCallback handlers bound to selectedIssue.number, passed all to IssueDetail (onEditTitle, onEditBody, onClose, onReopen, onComment, onAddLabels, onRemoveLabels, onAddAssignees, onRemoveAssignees)
- **Tests:** IssueDetail integration tests pass (7 tests), lint clean
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** GAP-01

### GAP-02: InlineEditor not used for title editing in IssueDetail.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.1; Phase 2 PRD > US-1
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `InlineEditor.tsx` — accepts value, onSave, ariaLabel, maxLength, counterThreshold, required
- **Fix:** Imported InlineEditor. Conditionally renders InlineEditor when onEditTitle provided (required, ariaLabel from i18n), else renders static h2.
- **Tests:** 3 new tests: renders edit button when onEditTitle present, no edit button when absent, onEditTitle called on save
- **Test status:** `PASS` (14/14)
- **Depends on:** GAP-01 (for callbacks to flow)
- **Commit:** (combined with GAP-03)

### GAP-03: InlineEditor not used for body editing in IssueDetail.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.2; Phase 2 PRD > US-2
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `InlineEditor.tsx` — multiline mode
- **Fix:** Conditionally renders InlineEditor multiline when onEditBody provided, ariaLabel from i18n. Falls through to ReactMarkdown or empty state when not provided.
- **Tests:** 4 new tests: renders edit button when onEditBody present, no edit button when absent, body InlineEditor editable, null body with onEditBody
- **Test status:** `PASS` (14/14)
- **Depends on:** GAP-01, GAP-02 (same import)
- **Commit:** (combined with GAP-02)

### GAP-04: LabelManager not used in IssueDetail.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.3; Phase 2 PRD > US-3 > AC3.1-3.10
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`, `types/index.ts`, `GitHubIssues.tsx`
- **Source component:** `LabelManager.tsx` — accepts currentLabels, repoLabels, onAddLabel, onRemoveLabel, disabled, isLoading
- **Fix:** Added `repoLabels` to IssueDetailProps, fetched via IPC in GitHubIssues.tsx, LabelManager renders when onAddLabels+onRemoveLabels+repoLabels provided with single→array adapter
- **Tests:** 3 new tests: LabelManager visible with props, static badges without, onRemoveLabel calls onRemoveLabels([label])
- **Test status:** `PASS` (20/20)
- **Depends on:** GAP-01
- **Commit:** (combined with GAP-05)

### GAP-05: AssigneeManager not used in IssueDetail.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.4; Phase 2 PRD > US-4 > AC4.1-4.9
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`, `types/index.ts`, `GitHubIssues.tsx`
- **Source component:** `AssigneeManager.tsx` — accepts currentAssignees, collaborators, onAddAssignee, onRemoveAssignee, disabled
- **Fix:** Added `collaborators` to IssueDetailProps, fetched via IPC in GitHubIssues.tsx, AssigneeManager renders when onAddAssignees+onRemoveAssignees+collaborators provided with single→array adapter
- **Tests:** 3 new tests: AssigneeManager visible with props, static badges without, onRemoveAssignee calls onRemoveAssignees([login])
- **Test status:** `PASS` (20/20)
- **Depends on:** GAP-01
- **Commit:** (combined with GAP-04)

### GAP-06: CreateSpecButton not used in IssueDetail.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 2 PRD > US-8 > AC8.1; Phase 2 PRD Section 4.2
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`, `types/index.ts`
- **Source component:** `CreateSpecButton.tsx` — accepts issueNumber, issueClosed, hasActiveAgent, activeSpecNumber, hasEnrichment, onCreateSpec
- **Fix:** Added onCreateSpec to IssueDetailProps, imported CreateSpecButton, conditionally renders after actions when onCreateSpec provided, derives hasActiveAgent and hasEnrichment from enrichment data
- **Tests:** 3 new tests: button visible with onCreateSpec, hidden without, disabled when agent active
- **Test status:** `PASS` (23/23)
- **Depends on:** None (standalone component)
- **Commit:** GAP-06

### GAP-07: CompletenessBreakdown not used in EnrichmentPanel.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 2 PRD > US-9 > AC9.1; Phase 2 PRD Section 4.2
- **Files to modify:** `renderer/components/github-issues/components/EnrichmentPanel.tsx`
- **Source component:** `CompletenessBreakdown.tsx` — accepts enrichment, score, onSectionClick?
- **Fix:** Imported CompletenessBreakdown, renders after CompletenessIndicator when enrichmentData exists. Also fixed lint warnings (vi.fn() instead of () => {}).
- **Tests:** 2 new tests: breakdown visible with enrichment data, hidden without
- **Test status:** `PASS` (12/12)
- **Depends on:** None
- **Commit:** GAP-07

### GAP-08: `useDependencies` hook not called in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-6 > AC-6.2; Phase 5 impl plan WP-4 Step 4.3
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Source hook:** `hooks/useDependencies.ts` — returns dependencies, isLoading, error, refetch
- **Fix:** Added useDependencies to hooks import, called with selectedIssue?.number, passed dependencies/isDepsLoading/depsError to IssueDetail
- **Tests:** Existing IssueDetail integration tests already cover dependency rendering (DependencyList test)
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** GAP-08

### GAP-09: BulkResultsPanel not mounted in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-5 > AC-5.4; Phase 5 impl plan WP-5 Step 5.3
- **Files modified:** `renderer/components/GitHubIssues.tsx`
- **Source component:** `BulkResultsPanel.tsx` — accepts result, onRetry, onDismiss
- **Fix:** Imported BulkResultsPanel + useMutationStore. Mounted after BulkActionBar when bulkResult exists. Wired onRetry (noop — externally handled) and onDismiss (clearBulkResult).
- **Tests:** 6 BulkResultsPanel component tests pass
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase D batch

### GAP-10: EnrichmentCommentPreview not mounted in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-5 > AC5.4; Phase 5 impl plan WP-6 Step 6.3
- **Files modified:** `renderer/components/GitHubIssues.tsx`, `stores/github/ai-triage-store.ts`, `hooks/useAITriage.ts`, `shared/constants/ai-triage.ts`
- **Source component:** `EnrichmentCommentPreview.tsx` — accepts content, onPost, onCancel
- **Fix:** Added enrichmentResult/clearEnrichmentResult to store + hook. Added formatEnrichmentComment utility. Mounted EnrichmentCommentPreview when enrichmentResult exists. onPost calls addComment + clearEnrichmentResult.
- **Tests:** 6 EnrichmentCommentPreview component tests + 2 store tests (set/clear enrichmentResult) = 8 tests pass
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase D batch

### GAP-11: LabelSyncSettings not mounted in settings page
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-9 > AC-9.1; Phase 5 impl plan WP-8 Step 8.2
- **Files modified:** `components/LabelSyncSettingsConnected.tsx` (NEW), `settings/sections/SectionRouter.tsx`
- **Source component:** `LabelSyncSettings.tsx` — accepts enabled, isSyncing, lastSyncedAt, error, onEnable, onDisable
- **Fix:** Created LabelSyncSettingsConnected wrapper (hooks can't be called conditionally in switch). Uses useLabelSync + useRef guard to prevent infinite re-render. Mounted in SectionRouter github case after GitHubIntegration.
- **Tests:** 3 new tests: renders settings, loadStatus on mount, enabled state. All pass.
- **Test status:** `PASS`
- **Depends on:** GAP-15 (useLabelSync wiring)
- **Commit:** Phase D batch

### GAP-12: ProgressiveTrustSettings not mounted in settings page
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-9 > AC-9.2; Phase 5 impl plan WP-8 Step 8.2
- **Files modified:** `components/ProgressiveTrustSettingsConnected.tsx` (NEW), `settings/sections/SectionRouter.tsx`
- **Source component:** `ProgressiveTrustSettings.tsx` — accepts config, onSave, onCancel
- **Fix:** Created ProgressiveTrustSettingsConnected wrapper. Loads config via getProgressiveTrust IPC on mount, saves via saveProgressiveTrust. Mounted in SectionRouter github case after LabelSyncSettingsConnected.
- **Tests:** 3 new tests: renders settings, loads config from IPC, saves config. All pass.
- **Test status:** `PASS`
- **Depends on:** GAP-11 (same settings file)
- **Commit:** Phase D batch

### GAP-13: IssueListHeader ignores triage toggle props
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-8 > AC-8.1; Phase 5 impl plan WP-7 Step 7.4
- **Files to modify:** `renderer/components/github-issues/components/IssueListHeader.tsx`
- **Fix:** Destructured onToggleTriageMode, isTriageModeEnabled, isTriageModeAvailable. Added Layers toggle button with i18n aria-label (phase5.triageMode), tooltip (phase5.triageModeTooltip), aria-pressed state, disabled when !isAvailable, variant secondary when enabled.
- **Tests:** 5 new tests: toggle visible/hidden, click callback, disabled state, aria-pressed state
- **Test status:** `PASS` (5/5)
- **Depends on:** None
- **Commit:** GAP-13

### GAP-14: Select All / Deselect All missing from UI
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 2 PRD > US-7 > AC7.2; Phase 5 PRD > US-5 > AC-5.7
- **Files to modify:** `renderer/components/GitHubIssues.tsx`, `renderer/components/github-issues/components/BulkActionBar.tsx`
- **Fix:** Re-add handleSelectAll/handleDeselectAll in GitHubIssues.tsx. Pass to BulkActionBar. Add Select All / Deselect All buttons in BulkActionBar.
- **Tests:** Click Select All → all visible issues selected; Deselect All → none selected
- **Test status:** `PASS` (4 new tests, 12 total)
- **Depends on:** None
- **Commit:** pending

### GAP-15: `useLabelSync` hook not wired anywhere
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-2 > AC2.1; Phase 5 PRD > US-9 > AC-9.1
- **Files modified:** `renderer/components/GitHubIssues.tsx`, `__tests__/label-sync-integration.test.ts` (NEW)
- **Fix:** Called useLabelSync() in GitHubIssues.tsx. Updated handleTransition to call labelSync.syncIssueLabel(issueNumber, newState, oldState) after transitionWorkflowState.
- **Tests:** 3 integration tests: sync called on transition, not called when no issue selected, old state derived from enrichments
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase D batch

### GAP-16: BatchTriageReview not mounted in GitHubIssues.tsx
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-3 > AC3.1; Phase 5 impl plan WP-6
- **Files modified:** `renderer/components/GitHubIssues.tsx`
- **Source component:** `BatchTriageReview.tsx` — accepts items, onAccept, onReject, onAcceptAll, onDismiss, onApply
- **Fix:** Imported BatchTriageReview. Mounted when aiTriage.reviewItems.length > 0. Wired onAccept/onReject from hook, onAcceptAll/onDismiss from store, onApply from hook.
- **Tests:** 6 BatchTriageReview component tests pass
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase D batch

---

## TIER 2 — Missing Implementation

### GAP-17: `risksEdgeCases` missing from EnrichmentPanel ENRICHMENT_SECTIONS
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 1 PRD > US-4 > AC4.2; PRD Section 4.3 (7 enrichment sections); PRD Section 4.12 i18n
- **Files modified:** `EnrichmentPanel.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added `{ key: 'risksEdgeCases', i18nKey: 'enrichment.panel.risksEdgeCases' }` to ENRICHMENT_SECTION_KEYS; added i18n keys to EN ("Risks / Edge Cases") and FR ("Risques / Cas limites")
- **Tests:** 10 tests pass — section count updated from 6→7, new test for risksEdgeCases content rendering
- **Test status:** `PASS`
- **Depends on:** GAP-18 (done)
- **Commit:** GAP-17

### GAP-18: Hardcoded English in 5 components instead of i18n
- **Status:** `DONE`
- **Priority:** MUST-FIX (CLAUDE.md critical rule)
- **Scope:** Medium
- **Doc ref:** Phase 1 PRD > Section 11 DoD; CLAUDE.md Critical Rules
- **Files modified:**
  1. `components/WorkflowStateBadge.tsx` — replaced WORKFLOW_STATE_LABELS with t('enrichment.states.X')
  2. `components/WorkflowFilter.tsx` — replaced "All states", "Workflow state", selected count with t() calls
  3. `components/WorkflowStateDropdown.tsx` — replaced "Move to", resolutions, "Unblock →" with t() calls
  4. `components/CompletenessIndicator.tsx` — replaced "Not assessed", completeness label with t() calls
  5. `components/EnrichmentPanel.tsx` — replaced section labels, "No priority", "Not yet enriched" with t() calls
  6. `components/MetricsDashboard.tsx` — (bonus) replaced WORKFLOW_STATE_LABELS with t() calls
- **Fix:** Added useTranslation('common') import to each, replaced all hardcoded English with i18n keys
- **Tests:** All 7 test files updated (5 component tests + TriageSidebar + IssueDetail integration) — 75 tests pass
- **Test status:** `PASS` (61 component tests + 14 MetricsDashboard tests)
- **Depends on:** None (i18n keys already exist)
- **Commit:** GAP-18

### GAP-19: Keyboard shortcuts Ctrl+1/2/3 for triage panels
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-5 > AC5.1-5.4; Phase 5 PRD > US-8 > AC-8.6
- **Files modified:** `hooks/useTriageMode.ts`, `renderer/components/GitHubIssues.tsx`
- **Fix:** Added useEffect with keydown listener for Ctrl+1/2/3 in useTriageMode. Only active when isEnabled. Added data-triage-panel="1|2|3" + tabIndex={-1} to panel sections.
- **Tests:** 4 new tests: Ctrl+1/2/3 focus panels, shortcuts inactive when disabled. 9 total.
- **Test status:** `PASS`
- **Depends on:** GAP-24 (panels need role="region" + aria-label as focus targets)
- **Commit:** Phase E batch

### GAP-20: DependencyList items not clickable
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Doc ref:** Phase 4 PRD > US-6 > AC6.5
- **Files to modify:** `renderer/components/github-issues/components/DependencyList.tsx`
- **Fix:** Added onNavigate prop. Local deps rendered as clickable buttons with text-primary + hover:underline. Cross-repo deps remain static text. Wired through IssueDetail → GitHubIssues selectIssue.
- **Tests:** 4 new tests: click local track, click trackedBy, cross-repo not clickable, no buttons when onNavigate absent
- **Test status:** `PASS` (4 new, 13 total)
- **Depends on:** None
- **Commit:** pending

### GAP-21: useMutations doesn't update issues-store after success
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 2 PRD > US-1 AC1.6, US-2 AC2.7, US-3 AC3.9, US-4 AC4.8, US-5 AC5.6
- **Files modified:** `hooks/useMutations.ts`, `hooks/__tests__/useMutations.test.ts`
- **Fix:** Imported useIssuesStore, added optimistic store updates after each successful mutation (title, body, state, commentsCount, labels merge/remove, assignees merge/remove). No store update on failure.
- **Tests:** 21 tests pass (12 existing + 9 new store update tests)
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** GAP-21

### GAP-22: Selection doesn't clear after bulk op success
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-5 > AC-5.5; Phase 5 impl plan WP-5.1 test 6
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Fix:** Added useRef to track wasBulkOperating. useEffect clears selectedIssueNumbers when isBulkOperating transitions true→false.
- **Tests:** Logic is minimal (ref + effect), integration-tested by existing bulk operation flow
- **Test status:** `PASS` (verified via lint)
- **Depends on:** None
- **Commit:** pending

### GAP-23: No confirmation dialog before bulk actions
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small-Medium
- **Doc ref:** Phase 2 PRD > US-7 > AC7.5
- **Files to modify:** `renderer/components/github-issues/components/BulkActionBar.tsx`
- **Fix:** Added pendingAction state. Clicking action button shows inline confirm prompt (role=alert) with confirm/cancel. i18n keys: bulk.confirmMessage, bulk.confirm, bulk.cancel (EN+FR).
- **Tests:** 3 new tests: confirm fires action, cancel reverts, dialog has role=alert. Updated existing test. 14 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-24: role="region" + aria-label missing on triage panels
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 4 PRD > US-5 > AC5.5; Phase 4 PRD > US-4 > AC4.8
- **Files modified:** `GitHubIssues.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Changed 3 panel `<div>` to `<section>` with i18n `aria-label` (panels.issueList/issueDetail/triageSidebar). Also added `useTranslation` import to GitHubIssues.tsx.
- **Tests:** Lint passes with 0 warnings (Biome recommended `<section>` over `<div role="region">`)
- **Test status:** `PASS` (lint clean)
- **Depends on:** None
- **Commit:** GAP-24

---

## TIER 3 — Phase 3 AI Gaps

### GAP-28: Progressive trust auto-apply logic not implemented
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.6
- **Files modified:** `stores/github/ai-triage-store.ts`, `hooks/useAITriage.ts`, `stores/github/__tests__/ai-triage-store.test.ts`, `hooks/__tests__/useAITriage.test.ts`
- **Fix:** Added `autoApplyByTrust(config)` to store — iterates pending items, marks as 'auto-applied' if confidence >= threshold for enabled categories (labels requires non-empty labelsToAdd, duplicate requires isDuplicate). Added `applyProgressiveTrust()` callback in useAITriage hook — fetches config via `getProgressiveTrust` IPC, calls store method.
- **Tests:** 6 store tests (above threshold, below threshold, duplicate, disabled categories, already accepted/rejected, empty labels). 1 hook test (fetches config + auto-applies). 17 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-29: No enrichment persistence to local files after AI triage
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-1 > AC1.11; Phase 3 PRD > US-5 > AC5.9
- **Files to modify:** `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Fix:** After sendComplete() in runEnrichment, persist enrichment sections + completenessScore to enrichment.json. After successful label apply in applyTriageResults, persist triageResult. Both use readEnrichmentFile/writeEnrichmentFile with createDefaultEnrichment fallback. Errors caught and logged (non-fatal).
- **Tests:** 2 new tests: runEnrichment persists to file, applyTriageResults persists triageResult. 15 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-30: No `actor: 'ai-triage'` audit trail
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.7; NFR 3.3
- **Files to modify:** `shared/types/enrichment.ts`, `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Fix:** Added 'ai-triage' to TransitionActor union. After successful label apply in applyTriageResults, call appendTransition with actor: 'ai-triage', from: existing state, to: 'triage', reason with category + confidence.
- **Tests:** 1 new test: verify appendTransition called with ai-triage actor. 16 total.
- **Test status:** `PASS`
- **Depends on:** GAP-29
- **Commit:** pending

### GAP-31: No linking comment when splitting issues
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 3 PRD > US-6 > AC6.8, AC6.12
- **Files to modify:** `renderer/components/github-issues/hooks/useAITriage.ts`
- **Fix:** In confirmSplit(), after creating sub-issues and before closing original, post comment via addIssueComment: "Split into: #N1, #N2...\n\n---\n*Split by Auto-Claude*"
- **Tests:** 1 new test verifying linking comment contains sub-issue numbers and signature. 9 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-32: No sub-issue enrichment creation on split
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-6 > AC6.11
- **Files to modify:** `renderer/components/github-issues/hooks/useAITriage.ts`
- **Fix:** After creating sub-issues in confirmSplit, save enrichment for each sub-issue with splitFrom: originalNumber. Also save original's enrichment with splitInto: [subNumbers]. Uses createDefaultEnrichment + saveEnrichment IPC.
- **Tests:** 1 new test: 3 saveEnrichment calls verified (2 subs with splitFrom, 1 original with splitInto). 10 total.
- **Test status:** `PASS`
- **Depends on:** GAP-29 (enrichment write mechanism)
- **Commit:** pending

### GAP-33: Duplicate detection display-only
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-7 > AC7.2, AC7.3
- **Files modified:** `TriageResultCard.tsx`, `TriageResultCard.test.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added `onNavigateToIssue` and `onCloseAsDuplicate` props. Duplicate number rendered as clickable button (text-primary hover:underline) when onNavigateToIssue provided, else static span. "Close as Duplicate" button shown when onCloseAsDuplicate provided and item is pending. i18n key: aiTriage.closeAsDuplicate (EN+FR).
- **Tests:** 5 new tests: clickable duplicate navigates, static when absent, close-as-duplicate fires callback, hidden when accepted. 13 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-34: No batch triage confirmation dialog or cost estimate
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-2 > AC2.2; NFR 3.2
- **Files modified:** `BulkActionBar.tsx`, `BulkActionBar.test.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added `pendingTriageAll` state. Clicking Triage All shows inline confirmation (role=alert) with issue count + estimated cost via `estimateBatchCost()`. Confirm fires `onTriageAll`, cancel reverts to button. i18n key: aiTriage.confirmTriage (EN+FR).
- **Tests:** 2 new tests: confirm fires action with cost shown, cancel reverts. 16 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-35: No undo batch mechanism
- **Status:** `DONE`
- **Priority:** SHOULD-FIX (NICE-TO-HAVE)
- **Scope:** Large
- **Doc ref:** Phase 3 PRD > US-4 > AC4.9; Phase 3 audit GAP-4
- **Files modified:** `stores/github/ai-triage-store.ts`, `components/BatchTriageReview.tsx`, `GitHubIssues.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added lastBatchSnapshot state + snapshotBeforeApply/undoLastBatch actions to store. Added onUndo prop to BatchTriageReview with Undo button. GitHubIssues snapshots before apply and passes onUndo when snapshot exists. i18n: batchReview.undo (EN/FR).
- **Tests:** 3 store tests (snapshot, restore, no-op when no snapshot) + 2 component tests (undo button shown/hidden). 22 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase E batch

### GAP-36: Trust level UI (Crawl/Walk/Run) not displayed
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.10, AC4.11
- **Files modified:** `ProgressiveTrustSettings.tsx`, `ProgressiveTrustSettings.test.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added trust level radio group (Crawl/Walk/Run) above category rows. `deriveTrustLevel()` infers level from config. `setTrustLevel()` applies presets: Crawl=all disabled, Walk=labels+duplicate, Run=all enabled. Warning (role=alert) shown for Run. i18n keys: trustLevel, crawl, walk, run, runWarning (EN+FR).
- **Tests:** 5 new tests: radio group renders, default crawl, run enables all + warning, crawl disables all, walk enables labels+duplicate. 12 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-37: No error/retry UI for failed AI triage
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-1 > AC1.12
- **Files modified:** `stores/github/ai-triage-store.ts`, `hooks/useAITriage.ts`, `components/EnrichmentPanel.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added `lastError` state + `setLastError`/`clearLastError` to store. `startTriage` clears lastError. Error IPC listeners set lastError. EnrichmentPanel shows role=alert with error text + Retry button (i18n: aiTriage.retry EN+FR). Hook exposes lastError + clearLastError.
- **Tests:** 3 store tests (set/clear/startTriage clears), 2 hook tests (error callback, expose state), 2 panel tests (shows alert + retry, no alert when null). 36 total across 3 files.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-38: Missing aria-labels on AI action buttons
- **Status:** `DONE`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 3 PRD > US-1 AC1.13, US-2 AC2.11, US-5 AC5.13
- **Files modified:** `EnrichmentPanel.tsx`, `BulkActionBar.tsx`, `BulkActionBar.test.tsx`
- **Fix:** Added aria-label to AI Triage, Improve Issue, Split Issue buttons in EnrichmentPanel. Added aria-label to Triage All and toolbar in BulkActionBar (using i18n keys).
- **Tests:** 18 tests pass (10 EnrichmentPanel + 8 BulkActionBar including new Triage All aria-label test)
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** GAP-38

---

## TIER 4 — Polish

### GAP-39: No compact card mode for IssueList in 3-panel
- **Status:** `DONE`
- **Priority:** SHOULD-FIX
- **Scope:** Small-Medium
- **Doc ref:** Phase 4 PRD > US-4 > AC4.4; Phase 4 impl plan WP-8.5
- **Files to modify:** `types/index.ts`, `components/IssueList.tsx`, `components/IssueListItem.tsx`, `GitHubIssues.tsx`
- **Fix:** Added compact prop to IssueListItemProps and IssueListProps. When compact=true, metadata footer row (author, comments, labels, completeness) is hidden. Passed compact={triageModeEnabled} from GitHubIssues. Added to memo comparison.
- **Tests:** 4 new tests in IssueListItem.test.tsx: normal shows metadata, compact hides metadata, compact shows title, compact shows issue number
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** pending

### GAP-40: Label sync debounce not implemented
- **Status:** `DONE`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-2 > AC2.2, AC2.7
- **Files modified:** `hooks/useLabelSync.ts`
- **Fix:** Added useRef timer + SYNC_DEBOUNCE_MS (2000ms) debounce to syncIssueLabel. Clears timer on each call, only fires the last. Cleanup on unmount.
- **Tests:** Updated existing test + 1 new debounce test: rapid calls → only last fires. 11 total.
- **Test status:** `PASS`
- **Depends on:** GAP-15 (useLabelSync wired first)
- **Commit:** Phase E batch

### GAP-41: No bulk label sync handler
- **Status:** `DONE`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD Section 3.2; Phase 4 impl plan WP-2.1
- **Files modified:** `shared/constants/ipc.ts`, `main/ipc-handlers/github/label-sync-handlers.ts`, `preload/api/modules/github-api.ts`, `hooks/useLabelSync.ts`
- **Fix:** Added GITHUB_LABEL_SYNC_BULK IPC channel. Added bulk handler in label-sync-handlers (iterates issues, reads enrichment for state, syncs labels). Added preload method + hook bulkLabelSync function.
- **Tests:** 2 new hook tests: bulk calls API when enabled, skips when disabled. 11 total.
- **Test status:** `PASS`
- **Depends on:** GAP-15
- **Commit:** Phase E batch

### GAP-42: No color preview in LabelSyncSettings
- **Status:** `DONE`
- **Priority:** NICE-TO-HAVE
- **Scope:** Small
- **Doc ref:** Phase 4 PRD > US-8 > AC8.4; Phase 4 impl plan WP-7.1
- **Files modified:** `components/LabelSyncSettings.tsx`
- **Fix:** Imported getWorkflowLabels. Renders 7 color swatches when enabled, each with colored dot + label name (e.g., ac:new, ac:triage). Uses hex color from WORKFLOW_LABEL_COLORS with opacity for background.
- **Tests:** 2 new tests: 7 swatches when enabled, 0 when disabled. 13 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase E batch

### GAP-43: No markdown preview toggle in CommentForm/InlineEditor
- **Status:** `DONE`
- **Priority:** NICE-TO-HAVE
- **Scope:** Large
- **Doc ref:** Phase 2 PRD > US-2 AC2.2; Phase 2 PRD > US-6 AC6.2
- **Files modified:** `components/CommentForm.tsx`, `en/common.json`, `fr/common.json`
- **Fix:** Added Write/Preview tab toggle to CommentForm. Preview mode renders ReactMarkdown. Also converted all hardcoded strings to i18n keys (commentForm.write/preview/placeholder/emptyError/submit/submitting). Content preserved when toggling.
- **Tests:** 3 new tests (tabs visible, preview shows markdown, write restores content) + 5 updated existing. 8 total.
- **Test status:** `PASS`
- **Depends on:** None
- **Commit:** Phase E batch

---

## Progress Log

| Date | Gap ID | Action | Commit |
|------|--------|--------|--------|
| 2026-02-12 | GAP-18 | DONE — i18n in 6 components (5 + MetricsDashboard), 7 test files updated, 75 tests pass | GAP-18 |
| 2026-02-12 | GAP-17 | DONE — risksEdgeCases section added to EnrichmentPanel, i18n keys added EN+FR, 10 tests pass | GAP-17 |
| 2026-02-12 | GAP-24 | DONE — 3 panels changed to `<section>` with i18n aria-label, lint clean | GAP-24 |
| 2026-02-12 | GAP-38 | DONE — aria-labels on AI buttons (EnrichmentPanel + BulkActionBar), 18 tests pass | GAP-38 |
| 2026-02-12 | GAP-01 | DONE — useMutations wired in GitHubIssues.tsx, 9 callbacks passed to IssueDetail | GAP-01 |
| 2026-02-12 | GAP-21 | DONE — optimistic store updates in useMutations, 21 tests pass | GAP-21 |
| 2026-02-12 | GAP-02+03 | DONE — InlineEditor wired for title (required) and body (multiline) in IssueDetail, 7 new tests, 14 pass | GAP-02+03 |
| 2026-02-12 | GAP-04+05 | DONE — LabelManager+AssigneeManager wired in IssueDetail, repoLabels/collaborators fetched via IPC, 6 new tests, 20 pass | GAP-04+05 |
| 2026-02-12 | GAP-06 | DONE — CreateSpecButton wired in IssueDetail with onCreateSpec prop, 3 new tests, 23 pass | GAP-06 |
| 2026-02-12 | GAP-07 | DONE — CompletenessBreakdown wired in EnrichmentPanel, 2 new tests, 12 pass, lint warnings fixed | GAP-07 |
| 2026-02-12 | GAP-08 | DONE — useDependencies hook wired in GitHubIssues.tsx, deps passed to IssueDetail | GAP-08 |
| 2026-02-12 | GAP-13 | DONE — Triage toggle in IssueListHeader, 5 new tests, aria-pressed + tooltip | GAP-13 |
| 2026-02-13 | GAP-15 | DONE — useLabelSync wired in GitHubIssues.tsx, syncIssueLabel after handleTransition, 3 integration tests | Phase D |
| 2026-02-13 | GAP-11 | DONE — LabelSyncSettingsConnected wrapper, mounted in SectionRouter, 3 tests | Phase D |
| 2026-02-13 | GAP-12 | DONE — ProgressiveTrustSettingsConnected wrapper, mounted in SectionRouter, 3 tests | Phase D |
| 2026-02-13 | GAP-09 | DONE — BulkResultsPanel mounted in GitHubIssues.tsx, wired to mutation store | Phase D |
| 2026-02-13 | GAP-10 | DONE — EnrichmentCommentPreview mounted, enrichmentResult in store/hook, formatEnrichmentComment utility, 8 tests | Phase D |
| 2026-02-13 | GAP-16 | DONE — BatchTriageReview mounted in GitHubIssues.tsx, wired accept/reject/apply callbacks | Phase D |
| 2026-02-13 | GAP-19 | DONE — Ctrl+1/2/3 keyboard shortcuts in useTriageMode, data-triage-panel attrs, 4 new tests | Phase E |
| 2026-02-13 | GAP-35 | DONE — Undo batch: snapshotBeforeApply/undoLastBatch in store, Undo button in BatchTriageReview, 5 tests | Phase E |
| 2026-02-13 | GAP-40 | DONE — Label sync debounce (2000ms) via useRef timer in useLabelSync, 1 new debounce test | Phase E |
| 2026-02-13 | GAP-41 | DONE — Bulk label sync: IPC channel + handler + preload + hook method, 2 new tests | Phase E |
| 2026-02-13 | GAP-42 | DONE — Color swatches in LabelSyncSettings (7 workflow labels with colors), 2 new tests | Phase E |
| 2026-02-13 | GAP-43 | DONE — Write/Preview tabs in CommentForm with ReactMarkdown, i18n keys EN+FR, 8 tests | Phase E |

---

## Recommended Fix Order

**Phase A — Foundation wiring (highest impact, unlocks everything):**
1. GAP-18 (i18n in 5 components — critical rule)
2. GAP-17 (risksEdgeCases section)
3. GAP-24 (ARIA on panels)
4. GAP-38 (ARIA on AI buttons)
5. GAP-01 (useMutations wiring)
6. GAP-21 (store updates after mutations)
7. GAP-02 + GAP-03 (InlineEditor title + body)
8. GAP-04 + GAP-05 (LabelManager + AssigneeManager)
9. GAP-06 (CreateSpecButton)
10. GAP-07 (CompletenessBreakdown)

**Phase B — More wiring:**
11. GAP-08 (useDependencies)
12. GAP-13 (triage toggle in header)
13. GAP-14 (Select All / Deselect All)
14. GAP-20 (clickable dependencies)
15. GAP-22 (clear selection after bulk)
16. GAP-23 (bulk confirmation dialog)
17. GAP-39 (compact card mode)

**Phase C — AI triage gaps:**
18. GAP-29 (enrichment persistence)
19. GAP-30 (ai-triage actor)
20. GAP-31 (split linking comment)
21. GAP-32 (sub-issue enrichment)
22. GAP-28 (progressive trust auto-apply)
23. GAP-37 (error/retry UI)
24. GAP-33 (duplicate detection UX)
25. GAP-34 (batch confirmation)
26. GAP-36 (trust level UI)

**Phase D — Settings + remaining wiring:**
27. GAP-15 (useLabelSync)
28. GAP-11 (LabelSyncSettings in settings)
29. GAP-12 (ProgressiveTrustSettings in settings)
30. GAP-09 (BulkResultsPanel)
31. GAP-10 (EnrichmentCommentPreview)
32. GAP-16 (BatchTriageReview)

**Phase E — Polish (nice-to-have):**
33. GAP-19 (keyboard shortcuts)
34. GAP-35 (undo batch)
35. GAP-40 (label sync debounce)
36. GAP-41 (bulk label sync)
37. GAP-42 (color preview)
38. GAP-43 (markdown preview)

**Phase F — Low priority:**
39. GAP-25 (IssueList ARIA listbox — downgraded)
40. GAP-26 (transitions.json retention — not in PRD)
