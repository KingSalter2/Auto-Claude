# Phase 4 Edge Case Analysis: Polish + Extras

Phase 4 introduces GitHub mutations (label sync), layout changes (3-panel), external API reads (GraphQL dependencies), and data aggregation (metrics). Each subsystem has distinct failure modes.

---

## 1. Label Sync Failures

### 1.1 Label Already Exists with Different Color

**Scenario:** User enables label sync, but repo already has an `ac:triage` label with a different color than the Auto-Claude scheme.

**What breaks:**
- `gh label create ac:triage` fails with "already exists" error
- Sync partially completes — some labels created, some fail

**Severity:** MAJOR

**Mitigation:**
- Before creating, check existing labels with `gh label list --search "ac:"`
- If label exists with wrong color, use `gh label edit ac:triage --color XXXXXX` to update
- If label exists and user didn't create it, warn before overwriting color

### 1.2 Rate Limit During Bulk Label Sync

**Scenario:** User enables label sync with 200+ issues in the repo. Syncing all workflow states triggers hundreds of `gh issue edit` calls.

**What breaks:**
- GitHub API returns 403 after rate limit exhaustion
- Partial sync state — some issues have labels, some don't

**Severity:** MAJOR

**Mitigation:**
- 2-second debounce per transition (design decision)
- Batch sync via GraphQL `addLabelsToLabelable` mutation (50 issues/request)
- Queue with exponential backoff on 403
- Progress indicator for bulk operations
- Resume from last successful issue on retry

### 1.3 Issue Closed on GitHub While Sync Pending

**Scenario:** Label sync is queued (debounce pending). Meanwhile, the issue is closed directly on GitHub.

**What breaks:**
- `gh issue edit` on a closed issue still works (labels can be modified on closed issues)
- No actual breakage, but label may be stale if workflow state was auto-transitioned to `done`

**Severity:** MINOR

**Mitigation:**
- Reconciliation on next fetch detects closed issues and auto-transitions to `done`
- Label sync follows the reconciled state, not the queued state

### 1.4 100-Label Limit Per Issue

**Scenario:** Issue already has 100 labels. Label sync tries to add `ac:triage`.

**What breaks:**
- `gh issue edit --add-label` fails silently or returns error
- Workflow state visually shows one thing locally, GitHub shows another

**Severity:** MEDIUM

**Mitigation:**
- Before adding, check current label count via issue data (already fetched)
- If at 100, skip sync and show warning: "Label limit reached"
- Remove old `ac:*` label before adding new one (net zero change)

### 1.5 User Disables Sync — Orphaned Labels

**Scenario:** User enables label sync, syncs 50 issues, then disables sync. `ac:*` labels remain on GitHub.

**What breaks:**
- Orphaned labels clutter the repo
- Other team members confused by labels that no longer update

**Severity:** MEDIUM

**Mitigation:**
- On disable, prompt: "Remove all ac: labels from GitHub?" (one-click cleanup)
- Cleanup uses `gh issue edit --remove-label` per issue + `gh label delete` for label definitions
- Show progress during cleanup

### 1.6 Label Prefix Collision

**Scenario:** Repo already uses `ac:` prefix for other purposes (unlikely but possible).

**What breaks:**
- Auto-Claude overwrites or conflicts with user labels

**Severity:** LOW

**Mitigation:**
- Settings allow configuring the prefix (default `ac:`, alternative `ac/`)
- During setup, scan existing labels for prefix collision and warn

---

## 2. 3-Panel Layout Failures

### 2.1 Window Too Narrow for 3 Panels

**Scenario:** User activates triage mode on a 1024px-wide window. Three panels at minimum useful widths don't fit.

**What breaks:**
- Panels overflow or become too narrow to read
- Text truncation makes content unusable

**Severity:** MAJOR

**Mitigation:**
- Min-width check (1200px) before enabling 3-panel mode
- Auto-fallback to 2-panel below threshold with toast notification
- CSS `min-width` on each panel prevents crushing

### 2.2 Triage Mode Activated with No Issue Selected

**Scenario:** User clicks "Triage Mode" toggle when no issue is selected in the list.

**What breaks:**
- Middle panel (editor) and right panel (triage sidebar) have no data to display

**Severity:** MINOR

**Mitigation:**
- Show placeholder/empty state in panels 2 and 3: "Select an issue to begin triage"
- Auto-select first issue in list when entering triage mode

### 2.3 Keyboard Navigation Between Panels

**Scenario:** User tries to navigate between panels using keyboard only.

**What breaks:**
- Without focus management, Tab key gets stuck in one panel
- Screen readers can't announce panel transitions

**Severity:** MEDIUM

**Mitigation:**
- Each panel has `role="region"` with `aria-label`
- `Ctrl+1/2/3` keyboard shortcuts to jump between panels
- Focus trap within each panel with escape to cycle

### 2.4 Resize/Drag During Active Edit

**Scenario:** User is editing an enrichment field in the triage sidebar, then resizes the window or drags a panel divider.

**What breaks:**
- Textarea may lose focus or scroll position
- Unsaved content could be lost if component unmounts during resize

**Severity:** MINOR

**Mitigation:**
- Panel width changes don't unmount components (CSS-only resize)
- Debounce resize handlers to avoid rapid re-renders

---

## 3. Dependencies (GraphQL) Failures

### 3.1 GraphQL API Not Available

**Scenario:** User's GitHub plan doesn't support the GraphQL `trackedBy`/`trackedIn` fields (older GitHub Enterprise Server versions).

**What breaks:**
- GraphQL query returns field error
- Dependencies section shows error instead of data

**Severity:** MEDIUM

**Mitigation:**
- Graceful fallback: catch GraphQL field errors, show "Dependencies not available on this GitHub version"
- Feature-flag dependencies display based on initial capability probe

### 3.2 Issue Has Many Dependencies (100+)

**Scenario:** Large project issue tracks 100+ sub-issues.

**What breaks:**
- GraphQL response is large, pagination needed
- UI becomes sluggish rendering 100+ dependency links

**Severity:** LOW

**Mitigation:**
- Paginate GraphQL query (first 20, show "Load more")
- Virtualize dependency list if > 50 items

### 3.3 Dependency Target Issue Deleted or Transferred

**Scenario:** Issue #42 tracks issue #99, but #99 was deleted or transferred to another repo.

**What breaks:**
- GraphQL returns null for the tracked issue reference
- UI shows broken link or crashes on null dereference

**Severity:** MINOR

**Mitigation:**
- Null-check all dependency references
- Show "Issue not found" with strikethrough for deleted references

---

## 4. Metrics Dashboard Failures

### 4.1 No Transition Data Available

**Scenario:** User opens metrics dashboard on a project with no enrichment data (all issues in `new` state, no transitions recorded).

**What breaks:**
- All charts empty, averages return NaN or 0

**Severity:** MINOR

**Mitigation:**
- Show empty state: "No triage activity yet. Start triaging issues to see metrics."
- Guard all computations against empty arrays (avoid division by zero)

### 4.2 Large Transition History (10,000+ Records)

**Scenario:** Active project with thousands of transitions over months.

**What breaks:**
- Aggregation in renderer blocks UI thread
- Dashboard takes seconds to render

**Severity:** MEDIUM

**Mitigation:**
- Compute aggregations in main process IPC handler, return pre-computed results
- Cache metrics with TTL (refresh on new transitions)
- Time-window filter: "Last 7 days", "Last 30 days", "All time"

### 4.3 Clock Skew in Timestamps

**Scenario:** Transition timestamps are inconsistent due to system clock changes or timezone issues.

**What breaks:**
- "Time in state" calculations produce negative values
- Metrics show impossible durations

**Severity:** LOW

**Mitigation:**
- Clamp negative durations to 0
- Use UTC timestamps consistently (already the case in enrichment-persistence)
- Show warning icon for suspicious durations (> 365 days)

---

## 5. Cross-Feature Interactions

### 5.1 Label Sync During Bulk Triage (Phase 3)

**Scenario:** Phase 3 batch triage auto-applies results on 30 issues simultaneously. Each transition triggers label sync.

**What breaks:**
- 30 label sync calls overwhelm rate limit
- Debounce per-issue doesn't help when all transitions happen at once

**Severity:** MAJOR

**Mitigation:**
- Batch label sync: collect all transitions in a time window (2s), sync as single GraphQL mutation
- Deduplicate: if same issue transitions twice in window, only sync final state

### 5.2 3-Panel Mode with Bulk Operations

**Scenario:** User enters triage mode, selects multiple issues, triggers bulk close. Layout needs to handle the BulkActionBar in 3-panel context.

**What breaks:**
- BulkActionBar position ambiguous in 3-panel mode
- Panel widths shift during bulk operation progress

**Severity:** MINOR

**Mitigation:**
- BulkActionBar stays at top of the issue list panel (panel 1), same as 2-panel mode
- No layout shift during bulk operations

### 5.3 Metrics Dashboard During Active Triage

**Scenario:** User views metrics while another agent is actively triaging issues, causing rapid state transitions.

**What breaks:**
- Metrics become stale immediately after rendering
- Real-time updates cause chart flickering

**Severity:** MINOR

**Mitigation:**
- Metrics are a snapshot, not real-time. Show "Last updated: X" timestamp
- Manual refresh button, no auto-refresh
