# Gap Tracker — Issues Tab Enhancement

**Branch:** `terminal/enhancement-issues-tab`
**Created:** 2026-02-12
**Total Gaps:** 41 confirmed (from triple-verified audit)
**Status:** 5 / 41 complete

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
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.1; Phase 2 PRD > US-1
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `InlineEditor.tsx` — accepts value, onSave, ariaLabel, maxLength, counterThreshold, required
- **Fix:** Import InlineEditor. At line 99-101 (plain h2), conditionally render InlineEditor when onEditTitle provided, else render static h2. Props: maxLength=256, counterThreshold=200, required, ariaLabel="Edit issue title"
- **Tests:** Render IssueDetail with onEditTitle → InlineEditor visible; without → static h2
- **Test status:** `PENDING`
- **Depends on:** GAP-01 (for callbacks to flow)
- **Commit:** —

### GAP-03: InlineEditor not used for body editing in IssueDetail.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.2; Phase 2 PRD > US-2
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `InlineEditor.tsx` — multiline mode
- **Fix:** At line 222-237 (body ReactMarkdown), conditionally render InlineEditor multiline when onEditBody provided. Props: maxLength=65536, counterThreshold=60000, multiline, ariaLabel="Edit issue body"
- **Tests:** Render with onEditBody → InlineEditor multiline; without → static markdown
- **Test status:** `PENDING`
- **Depends on:** GAP-01, GAP-02 (same import)
- **Commit:** —

### GAP-04: LabelManager not used in IssueDetail.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.3; Phase 2 PRD > US-3 > AC3.1-3.10
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `LabelManager.tsx` — accepts currentLabels, repoLabels, onAddLabel, onRemoveLabel, disabled, isLoading
- **Fix:** Import LabelManager. At lines 123-139 (static badges), conditionally render LabelManager when onAddLabels/onRemoveLabels provided. Pass currentLabels from issue.labels.map(l => l.name). NOTE: repoLabels needs fetching via IPC or passing from parent.
- **Tests:** Render with onAddLabels → LabelManager visible; without → static badges
- **Test status:** `PENDING`
- **Depends on:** GAP-01
- **Commit:** —

### GAP-05: AssigneeManager not used in IssueDetail.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-4 > AC-4.4; Phase 2 PRD > US-4 > AC4.1-4.9
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `AssigneeManager.tsx` — accepts currentAssignees, collaborators, onAddAssignee, onRemoveAssignee, disabled
- **Fix:** Import AssigneeManager. At lines 274-291 (static badges), conditionally render when onAddAssignees/onRemoveAssignees provided. NOTE: collaborators list needs fetching.
- **Tests:** Render with onAddAssignees → AssigneeManager visible; without → static badges
- **Test status:** `PENDING`
- **Depends on:** GAP-01
- **Commit:** —

### GAP-06: CreateSpecButton not used in IssueDetail.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 2 PRD > US-8 > AC8.1; Phase 2 PRD Section 4.2
- **Files to modify:** `renderer/components/github-issues/components/IssueDetail.tsx`
- **Source component:** `CreateSpecButton.tsx` — accepts issueNumber, issueClosed, hasActiveAgent, activeSpecNumber, hasEnrichment, onCreateSpec
- **Fix:** Import CreateSpecButton. Add inside actions div (after Investigate button, ~line 163). Wire props from enrichment data.
- **Tests:** Render with onCreateSpec → button visible; check disabled when hasActiveAgent
- **Test status:** `PENDING`
- **Depends on:** None (standalone component)
- **Commit:** —

### GAP-07: CompletenessBreakdown not used in EnrichmentPanel.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 2 PRD > US-9 > AC9.1; Phase 2 PRD Section 4.2
- **Files to modify:** `renderer/components/github-issues/components/EnrichmentPanel.tsx`
- **Source component:** `CompletenessBreakdown.tsx` — accepts enrichment, score, onSectionClick?
- **Fix:** Import CompletenessBreakdown. Add after CompletenessIndicator div (after line 68). Render when enrichmentData exists.
- **Tests:** Render EnrichmentPanel with enrichment data → CompletenessBreakdown visible
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-08: `useDependencies` hook not called in GitHubIssues.tsx
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-6 > AC-6.2; Phase 5 impl plan WP-4 Step 4.3
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Source hook:** `hooks/useDependencies.ts` — returns dependencies, isLoading, error, refetch
- **Fix:** Add useDependencies to hooks import. Call with selectedIssue?.number. Pass dependencies, isDepsLoading, depsError to IssueDetail.
- **Tests:** Verify dependency props passed to IssueDetail when issue selected
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-09: BulkResultsPanel not mounted in GitHubIssues.tsx
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-5 > AC-5.4; Phase 5 impl plan WP-5 Step 5.3
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Source component:** `BulkResultsPanel.tsx` — accepts result, onRetry, onDismiss
- **Fix:** Add BulkResultsPanel to imports. Import useMutationStore for bulkResult/clearBulkResult. Mount after BulkActionBar when bulkResult exists.
- **Tests:** Verify BulkResultsPanel renders when bulkResult present
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-10: EnrichmentCommentPreview not mounted in GitHubIssues.tsx
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-5 > AC5.4; Phase 5 impl plan WP-6 Step 6.3
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Source component:** `EnrichmentCommentPreview.tsx` — accepts content, onPost, onCancel
- **Fix:** Add to imports. Mount when aiTriage.enrichmentResult exists. Wire onPost to comment mutation.
- **Tests:** Verify preview renders when enrichmentResult present
- **Test status:** `PENDING`
- **Depends on:** Verify aiTriage store exposes enrichmentResult field
- **Commit:** —

### GAP-11: LabelSyncSettings not mounted in settings page
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-9 > AC-9.1; Phase 5 impl plan WP-8 Step 8.2
- **Files to modify:** `renderer/components/settings/sections/SectionRouter.tsx`
- **Source component:** `LabelSyncSettings.tsx` — accepts enabled, isSyncing, lastSyncedAt, error, onEnable, onDisable
- **Fix:** Import LabelSyncSettings + useLabelSync. Wire in github case after GitHubIntegration. NOTE: hook-calling constraint — may need wrapper component.
- **Tests:** Verify LabelSyncSettings renders in github settings section
- **Test status:** `PENDING`
- **Depends on:** GAP-15 (useLabelSync wiring)
- **Commit:** —

### GAP-12: ProgressiveTrustSettings not mounted in settings page
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 5 PRD > US-9 > AC-9.2; Phase 5 impl plan WP-8 Step 8.2
- **Files to modify:** `renderer/components/settings/sections/SectionRouter.tsx`
- **Source component:** `ProgressiveTrustSettings.tsx` — accepts config, onSave, onCancel
- **Fix:** Import ProgressiveTrustSettings. Wire in github case. Needs trust config from AI triage store.
- **Tests:** Verify ProgressiveTrustSettings renders in github settings section
- **Test status:** `PENDING`
- **Depends on:** GAP-11 (same settings file)
- **Commit:** —

### GAP-13: IssueListHeader ignores triage toggle props
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-8 > AC-8.1; Phase 5 impl plan WP-7 Step 7.4
- **Files to modify:** `renderer/components/github-issues/components/IssueListHeader.tsx`
- **Fix:** Destructure onToggleTriageMode, isTriageModeEnabled, isTriageModeAvailable from props. Add toggle button with Layers icon in header actions area. Use i18n keys phase5.triageMode/triageModeTooltip. aria-pressed state.
- **Tests:** Render header with triage props → toggle button visible; click fires callback; disabled when !isAvailable
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-14: Select All / Deselect All missing from UI
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 2 PRD > US-7 > AC7.2; Phase 5 PRD > US-5 > AC-5.7
- **Files to modify:** `renderer/components/GitHubIssues.tsx`, `renderer/components/github-issues/components/BulkActionBar.tsx`
- **Fix:** Re-add handleSelectAll/handleDeselectAll in GitHubIssues.tsx. Pass to BulkActionBar. Add Select All / Deselect All buttons in BulkActionBar.
- **Tests:** Click Select All → all visible issues selected; Deselect All → none selected
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-15: `useLabelSync` hook not wired anywhere
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-2 > AC2.1; Phase 5 PRD > US-9 > AC-9.1
- **Files to modify:** `renderer/components/settings/sections/SectionRouter.tsx`, `renderer/components/GitHubIssues.tsx`
- **Fix:** Primary: Call useLabelSync() in settings (for LabelSyncSettings). Secondary: Call in GitHubIssues.tsx, use syncIssueLabel after handleTransition.
- **Tests:** Verify sync called after workflow transition when enabled
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-16: BatchTriageReview not mounted in GitHubIssues.tsx
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-3 > AC3.1; Phase 5 impl plan WP-6
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Source component:** `BatchTriageReview.tsx` — accepts items, onAccept, onReject, onAcceptAll, onDismiss, onApply
- **Fix:** Add to imports. Mount after TriageProgressOverlay when aiTriage.reviewItems exists. Wire callbacks.
- **Tests:** Verify review panel renders when reviewItems present
- **Test status:** `PENDING`
- **Depends on:** Verify aiTriage store exposes reviewItems/accept/reject/etc.
- **Commit:** —

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
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-5 > AC5.1-5.4; Phase 5 PRD > US-8 > AC-8.6
- **Files to modify:** `hooks/useTriageMode.ts`, `renderer/components/GitHubIssues.tsx`
- **Fix:** Add useEffect with keydown listener in useTriageMode for Ctrl+1/2/3. Only active when isEnabled. Need panel refs/IDs in GitHubIssues.tsx for focus targeting.
- **Tests:** Simulate Ctrl+1 → focuses list panel; Ctrl+2 → detail; Ctrl+3 → sidebar; only in triage mode
- **Test status:** `PENDING`
- **Depends on:** GAP-24 (panels need role="region" + aria-label as focus targets)
- **Commit:** —

### GAP-20: DependencyList items not clickable
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Doc ref:** Phase 4 PRD > US-6 > AC6.5
- **Files to modify:** `renderer/components/github-issues/components/DependencyList.tsx`
- **Fix:** Add onNavigate prop. Wrap dependency items in button or add onClick. Add cursor-pointer. Wire from IssueDetail/GitHubIssues to selectIssue.
- **Tests:** Click dependency item → onNavigate called with issue number
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-21: useMutations doesn't update issues-store after success
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 2 PRD > US-1 AC1.6, US-2 AC2.7, US-3 AC3.9, US-4 AC4.8, US-5 AC5.6
- **Files to modify:** `renderer/components/github-issues/hooks/useMutations.ts`
- **Fix:** Import useIssuesStore. After each successful IPC mutation call, call updateIssue(issueNumber, { field: newValue }). For editTitle → {title}, editBody → {body}, closeIssue → {state:'closed'}, reopenIssue → {state:'open'}, labels/assignees → update arrays.
- **Tests:** Call mutation → verify issues-store updated with new data
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-22: Selection doesn't clear after bulk op success
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Small
- **Doc ref:** Phase 5 PRD > US-5 > AC-5.5; Phase 5 impl plan WP-5.1 test 6
- **Files to modify:** `renderer/components/GitHubIssues.tsx`
- **Fix:** Make handleBulkAction async, await executeBulk, then call setSelectedIssueNumbers(new Set()). Or: useEffect watching bulk completion.
- **Tests:** Execute bulk op → selectedIssueNumbers becomes empty set
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-23: No confirmation dialog before bulk actions
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Small-Medium
- **Doc ref:** Phase 2 PRD > US-7 > AC7.5
- **Files to modify:** `renderer/components/github-issues/components/BulkActionBar.tsx`
- **Fix:** Add confirmation state. On action click, show confirm dialog with count. Only execute after confirm. Add i18n key for confirm message.
- **Tests:** Click bulk action → confirm dialog shown; confirm → action fires; cancel → no action
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

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
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.6
- **Files to modify:** `renderer/components/github-issues/hooks/useAITriage.ts`
- **Fix:** After batch triage results arrive, fetch trust config, iterate results, auto-mark items where confidence >= threshold and category enabled as status: 'auto-applied'.
- **Tests:** Batch triage with trust config → high-confidence items auto-marked
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-29: No enrichment persistence to local files after AI triage
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-1 > AC1.11; Phase 3 PRD > US-5 > AC5.9
- **Files to modify:** `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Fix:** After sendComplete(), import readEnrichmentFile/writeEnrichmentFile from enrichment-persistence. Persist triageResult and lastTriagedAt to enrichment.json. Same in applyTriageResults.
- **Tests:** Run enrichment → enrichment.json contains triageResult + lastTriagedAt
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-30: No `actor: 'ai-triage'` audit trail
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.7; NFR 3.3
- **Files to modify:** `shared/types/enrichment.ts`, `main/ipc-handlers/github/ai-triage-handlers.ts`
- **Fix:** Add 'ai-triage' to TransitionActor union. In applyTriageResults, call appendTransition with actor: 'ai-triage' after each label application.
- **Tests:** Apply triage results → transitions.json has entry with actor='ai-triage'
- **Test status:** `PENDING`
- **Depends on:** GAP-29
- **Commit:** —

### GAP-31: No linking comment when splitting issues
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Small
- **Doc ref:** Phase 3 PRD > US-6 > AC6.8, AC6.12
- **Files to modify:** `renderer/components/github-issues/hooks/useAITriage.ts`
- **Fix:** In confirmSplit(), after creating all sub-issues and before closing original (~line 117-123), post comment: "Split into: #101, #102...\n\n---\n*Split by Auto-Claude*"
- **Tests:** Split issue → original gets linking comment with sub-issue numbers
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-32: No sub-issue enrichment creation on split
- **Status:** `PENDING`
- **Priority:** MUST-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-6 > AC6.11
- **Files to modify:** `renderer/components/github-issues/hooks/useAITriage.ts`
- **Fix:** After creating each sub-issue, create enrichment with splitFrom: originalNumber, triageState: 'new'. Also update original's enrichment with splitInto array.
- **Tests:** Split issue → sub-issues have enrichment with splitFrom; original has splitInto
- **Test status:** `PENDING`
- **Depends on:** GAP-29 (enrichment write mechanism)
- **Commit:** —

### GAP-33: Duplicate detection display-only
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-7 > AC7.2, AC7.3
- **Files to modify:** `renderer/components/github-issues/components/TriageResultCard.tsx`
- **Fix:** Make #{duplicateOf} a clickable button with onNavigateToIssue prop. Add "Close as Duplicate" button with onCloseAsDuplicate prop.
- **Tests:** Click duplicate link → onNavigateToIssue called; Close as Duplicate → onCloseAsDuplicate called
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-34: No batch triage confirmation dialog or cost estimate
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-2 > AC2.2; NFR 3.2
- **Files to modify:** `renderer/components/github-issues/components/BulkActionBar.tsx`
- **Fix:** Add confirmation state. Import estimateBatchCost. Show dialog with count + estimated cost before triaging. Only call onTriageAll after confirm.
- **Tests:** Click Triage All → confirm dialog with cost; confirm → action; cancel → no action
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-35: No undo batch mechanism
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX (NICE-TO-HAVE)
- **Scope:** Large
- **Doc ref:** Phase 3 PRD > US-4 > AC4.9; Phase 3 audit GAP-4
- **Files to modify:** `renderer/stores/github/ai-triage-store.ts`, `main/ipc-handlers/github/ai-triage-handlers.ts`, `renderer/components/github-issues/hooks/useAITriage.ts`, `renderer/components/github-issues/components/BatchTriageReview.tsx`
- **Fix:** Track lastBatchApplied in store. Store what labels were added/removed per issue. Add undoLastBatch action that reverses changes. Add "Undo" button in BatchTriageReview.
- **Tests:** Apply batch → undo → labels reverted
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-36: Trust level UI (Crawl/Walk/Run) not displayed
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-4 > AC4.10, AC4.11
- **Files to modify:** `renderer/components/github-issues/components/ProgressiveTrustSettings.tsx`
- **Fix:** Import TrustLevel/TRUST_LEVEL_LABELS. Add radio group for Crawl/Walk/Run above category rows. Changing level toggles category enabled states. Show warning for "Fully Automated".
- **Tests:** Select Crawl → all disabled; Walk → some enabled; Run → all enabled + warning
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-37: No error/retry UI for failed AI triage
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Medium
- **Doc ref:** Phase 3 PRD > US-1 > AC1.12
- **Files to modify:** `renderer/stores/github/ai-triage-store.ts`, `renderer/components/github-issues/hooks/useAITriage.ts`, `renderer/components/github-issues/components/EnrichmentPanel.tsx`
- **Fix:** Add lastError state to store. On error, set it. In EnrichmentPanel, show inline error with Retry button when error present.
- **Tests:** AI triage fails → error shown in panel; click Retry → re-runs
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

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
- **Status:** `PENDING`
- **Priority:** SHOULD-FIX
- **Scope:** Small-Medium
- **Doc ref:** Phase 4 PRD > US-4 > AC4.4; Phase 4 impl plan WP-8.5
- **Files to modify:** `types/index.ts`, `components/IssueList.tsx`, `components/IssueListItem.tsx`, `GitHubIssues.tsx`
- **Fix:** Add compact prop to IssueListProps/IssueListItemProps. When compact, hide metadata footer row. Pass compact={triageModeEnabled} from GitHubIssues.
- **Tests:** Render IssueListItem compact=true → metadata footer hidden
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-40: Label sync debounce not implemented
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD > US-2 > AC2.2, AC2.7
- **Files to modify:** `renderer/components/github-issues/hooks/useLabelSync.ts`
- **Fix:** Wrap syncIssueLabel in debounce using SYNC_DEBOUNCE_MS. Batch pending syncs.
- **Tests:** Rapid transitions → only one sync call per debounce window
- **Test status:** `PENDING`
- **Depends on:** GAP-15 (useLabelSync wired first)
- **Commit:** —

### GAP-41: No bulk label sync handler
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Medium
- **Doc ref:** Phase 4 PRD Section 3.2; Phase 4 impl plan WP-2.1
- **Files to modify:** `shared/constants/ipc.ts`, `main/ipc-handlers/github/label-sync-handlers.ts`, `preload/api/modules/github-api.ts`
- **Fix:** Add GITHUB_LABEL_SYNC_BULK + PROGRESS IPC channels. Add bulk handler. Add preload method.
- **Tests:** Bulk sync 5 issues → all labeled; progress events fired
- **Test status:** `PENDING`
- **Depends on:** GAP-15
- **Commit:** —

### GAP-42: No color preview in LabelSyncSettings
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Small
- **Doc ref:** Phase 4 PRD > US-8 > AC8.4; Phase 4 impl plan WP-7.1
- **Files to modify:** `renderer/components/github-issues/components/LabelSyncSettings.tsx`
- **Fix:** Import WORKFLOW_LABEL_COLORS/WORKFLOW_LABEL_MAP. Render color swatches for each workflow state when enabled.
- **Tests:** Render enabled → 7 color swatches visible
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

### GAP-43: No markdown preview toggle in CommentForm/InlineEditor
- **Status:** `PENDING`
- **Priority:** NICE-TO-HAVE
- **Scope:** Large
- **Doc ref:** Phase 2 PRD > US-2 AC2.2; Phase 2 PRD > US-6 AC6.2
- **Files to modify:** `renderer/components/github-issues/components/CommentForm.tsx`, `renderer/components/github-issues/components/InlineEditor.tsx`, i18n files
- **Fix:** Add Write/Preview tab toggle. In Preview mode render markdown (ReactMarkdown already in project). Add i18n keys for tabs.
- **Tests:** Click Preview → markdown rendered; click Write → textarea shown; toggle preserves content
- **Test status:** `PENDING`
- **Depends on:** None
- **Commit:** —

---

## Progress Log

| Date | Gap ID | Action | Commit |
|------|--------|--------|--------|
| 2026-02-12 | GAP-18 | DONE — i18n in 6 components (5 + MetricsDashboard), 7 test files updated, 75 tests pass | GAP-18 |
| 2026-02-12 | GAP-17 | DONE — risksEdgeCases section added to EnrichmentPanel, i18n keys added EN+FR, 10 tests pass | GAP-17 |
| 2026-02-12 | GAP-24 | DONE — 3 panels changed to `<section>` with i18n aria-label, lint clean | GAP-24 |
| 2026-02-12 | GAP-38 | DONE — aria-labels on AI buttons (EnrichmentPanel + BulkActionBar), 18 tests pass | GAP-38 |
| 2026-02-12 | GAP-01 | DONE — useMutations wired in GitHubIssues.tsx, 9 callbacks passed to IssueDetail | GAP-01 |

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
