# AI Issue Investigation System — Design Document

> **Status:** Design Complete (98 gap decisions resolved)
> **Date:** 2026-02-13
> **Branch:** `feat/issues`
> **Target:** `develop`

## 1. Vision

Transform GitHub issues from passive tickets into actionable intelligence. When a user clicks **"AI Investigate"** on an issue, Auto-Claude spins up a worktree, deploys 4 specialist agents in parallel to explore the codebase, and produces a detailed investigation report. The report can be posted to GitHub and one-click converted into a kanban task that flows through the existing build pipeline.

**Future vision:** Full auto-fix loop — investigate → build fix → verify fix against investigation worktree → auto PR review → loop until resolved.

### Core Principles

- **GitHub is the source of truth** — all state synced via lifecycle labels and comments
- **Two parallel workflows** — normal task creation stays untouched; issue-based tasks get their own pipeline
- **One worktree, two phases** — investigation explores read-only, then the build phase writes the fix in the same worktree
- **DRY with PR review system** — extract shared patterns (parallel orchestrator, specialist agents, stream processing, structured output)
- **Investigation replaces triage** — the old enrichment/triage system is superseded by deep investigation

---

## 2. User-Facing Workflow

### 2.1 Single-Issue Investigation

1. User opens an issue in the GitHub Issues tab
2. Clicks **"AI Investigate"** button (primary CTA in detail view)
3. Button transitions: `AI Investigate` → `Investigating...` (animated) → `View Results` → `Create Task`
4. 4 specialist agents explore the codebase in parallel (progress bar on issue card in list)
5. Results panel replaces the old enrichment panel (mirrors PR review layout)
6. Optionally auto-posted to GitHub as a branded comment (follows PR follow-up "full auto" pattern)
7. User clicks **"Create Task"** (replaces the investigate button) → one-click task creation
8. Task appears on kanban board → build pipeline reuses the investigation worktree

### 2.2 Bulk Investigation

- Checkbox selection on individual issues + "Investigate Selected" button
- "Investigate All Matching" button for current filter results
- Both feed into the parallel queue (max N concurrent, configurable)
- Batch cancel (cancel all) + individual cancel available

### 2.3 Button State Machine

```
[AI Investigate] → [Investigating... ⏳] → [View Results ✓] → [Create Task]
     (blue)          (animated/disabled)       (green)          (purple)
                          ↓
                    [Cancel Investigation]
                    (appears alongside)
```

- **No separate "Create Task" button** — it only appears after investigation completes
- **Triage button removed** — investigation replaces triage entirely
- **Create Spec button removed** — investigation is the only path from issue to task

### 2.4 Results Display

- Mirrors PR review layout (same component patterns)
- Collapsible sections per specialist agent (Root Cause, Impact, Fix Advice, Reproduction)
- AI summary replaces the raw GitHub issue body (raw body available via "Show original" toggle)
- Minimal activity log: key events with timestamps (e.g., "Investigated Feb 13", "Task created Feb 13")
- Agent-suggested labels shown with accept/reject UI

### 2.5 Issue List Indicators

- Mini progress bar on each issue card (0-100% during investigation)
- After completion: checkmark + task link badge
- Investigation state filter chips alongside existing label/status filters
- Dismissed issues hidden by default (toggle to show)

---

## 3. Architecture

### 3.1 Two Parallel Workflows

```
NORMAL WORKFLOW (unchanged):
  User creates task manually → .auto-claude/specs/{specId}/ → Start build → New worktree → Pipeline

ISSUE-BASED WORKFLOW (new):
  AI Investigate → Pre-allocate specId → Worktree created → Read-only investigation
       ↓
  Create Task → .auto-claude/specs/{specId}/ created from investigation → Task on kanban
       ↓
  Build starts → Reuses existing worktree → Pipeline with investigation context injected
```

### 3.2 Investigation-to-Task Flow (Detailed)

```
Step 1: "AI Investigate" clicked
  ├── Allocate specId (spec number lock, pre-reserve)
  ├── Create worktree: .auto-claude/worktrees/tasks/{specId}/
  ├── Create branch: auto-claude/{specId}
  ├── Create issue dir: .auto-claude/issues/{issueNumber}/
  │   └── Store: specId, issueNumber, state=investigating
  ├── Add GitHub label: "auto-claude: investigating"
  └── Launch 4 specialist agents (read-only, parallel)

Step 2: Investigation completes
  ├── Save investigation_report.json to .auto-claude/issues/{issueNumber}/
  ├── Update GitHub label: "auto-claude: findings-ready"
  ├── Post GitHub comment (if auto-post enabled)
  ├── In-app notification (toast/badge)
  └── Derived state → "findings_ready"

Step 3: "Create Task" clicked (or auto-create if enabled)
  ├── Create .auto-claude/specs/{specId}/ (template-based from investigation data)
  │   ├── spec.md (from investigation report)
  │   ├── requirements.json (from structured investigation data)
  │   ├── task_metadata.json (GitHub issue link, category, investigation source)
  │   └── investigation_report.json (copied from issues dir)
  ├── Update .auto-claude/issues/{issueNumber}/ with linked_spec_id
  ├── Task appears on kanban in "backlog" status
  ├── Update GitHub label: "auto-claude: task-created"
  └── Derived state → "task_created"

Step 4: Build starts
  ├── run.py --spec {specId} --issue-workflow
  ├── setup_workspace() finds EXISTING worktree (idempotent get_or_create_worktree)
  ├── Spec files copied into worktree
  ├── Investigation report injected into coder prompt + kept as file
  ├── Pipeline runs: planner → coder → QA (configurable phases per gap 25)
  ├── Update GitHub label: "auto-claude: building"
  └── Derived state → "building" (auto-synced from kanban task status)

Step 5: Build completes
  ├── Task moves to "done" on kanban
  ├── Post completion comment on GitHub: "Resolved by Auto-Claude task #XXX. PR: #YYY"
  ├── Auto-close GitHub issue (if setting enabled)
  ├── Update GitHub label: "auto-claude: done"
  └── Derived state → "done"
```

### 3.3 Specialist Agents

4 parallel agents, each a separate Claude SDK session:

| Agent | Purpose | Tools |
|-------|---------|-------|
| **Root Cause Analyzer** | Trace the bug/issue to its source. Follow references in the issue body. Identify the exact code paths. | Read, Grep, Glob |
| **Impact Assessor** | Determine blast radius. What other code/features are affected? What breaks if this isn't fixed? | Read, Grep, Glob |
| **Fix Advisor** | Suggest concrete fix approaches. Identify files to modify, patterns to follow, gotchas. | Read, Grep, Glob |
| **Reproducer** | Determine if/how the issue can be reproduced. Check test coverage, find related test files. | Read, Grep, Glob |

**Tool enforcement:** Read/Grep/Glob only. No Write/Edit/Bash. Enforced at tool grant level, not prompt-only.

**Structured output:** Pydantic models + JSON schema (same pattern as PR review specialists).

**Shared infrastructure with PR review:**
- `process_sdk_stream()` from `sdk_utils.py` for stream processing
- `SpecialistConfig` dataclass pattern for agent definition
- `asyncio.gather()` for parallel execution
- Pydantic models for structured output
- `create_client()` from `core/client.py` for SDK sessions

### 3.4 Data Model

#### `.auto-claude/issues/{issueNumber}/` (new directory)

```
.auto-claude/issues/
  1805/
    investigation_report.json    # Full findings from all 4 agents
    investigation_state.json     # { specId, issueNumber, status, startedAt, completedAt, ... }
    agent_logs/                  # Per-agent log files
      root_cause_analyzer.log
      impact_assessor.log
      fix_advisor.log
      reproducer.log
    github_comment_id            # ID of posted GitHub comment (for editing/referencing)
    suggested_labels.json        # AI-suggested labels with accept/reject status
```

#### Investigation State (derived, not manually managed)

```
No investigation data          → "new"
Investigation running          → "investigating"
Investigation complete, no task → "findings_ready"
Investigation found likely fixed → "resolved"
Investigation failed           → "failed"
Task exists, in backlog/queue  → "task_created"
Task in_progress/ai_review     → "building"      (auto-synced from kanban)
Task done/pr_created           → "done"           (auto-synced from kanban)
```

State is **fully derived** — computed from investigation data + linked task status. Never manually set. GitHub labels auto-sync from derived state (debounced 5-10s).

#### Worktree Layout

```
.auto-claude/
  worktrees/
    tasks/
      042-fix-login-bug/            # One worktree, used for both phases
        .auto-claude/
          specs/042-fix-login-bug/  # Spec files (copied in during build phase)
          issues/1805/              # Investigation data (available to build agents)
        src/                        # Project source code
        ...
  issues/
    1805/                           # Investigation home (main project, authoritative)
      investigation_report.json
      investigation_state.json
      agent_logs/
      ...
  specs/
    042-fix-login-bug/              # Created ONLY when "Create Task" clicked
      spec.md
      requirements.json
      task_metadata.json
      investigation_report.json     # Copied from issues dir
```

---

## 4. GitHub Sync

### 4.1 Lifecycle Labels (5 labels, auto-created with consent)

| Label | Color | When Applied |
|-------|-------|-------------|
| `auto-claude: investigating` | Blue (#1d76db) | Investigation starts |
| `auto-claude: findings-ready` | Purple (#7057ff) | Investigation completes |
| `auto-claude: task-created` | Green (#0e8a16) | Task created on kanban |
| `auto-claude: building` | Orange (#e4e669) | Build pipeline running |
| `auto-claude: done` | Dark Green (#006b75) | Task completed |

- **One-way sync**: Auto-Claude pushes labels to GitHub but does not read them back. App state is authoritative.
- **Auto-create with consent**: First use shows dialog: "Auto-Claude needs to create status labels in your repo. Allow?"
- **Debounced**: Label updates batched with 5-10s delay to avoid rapid API calls during fast state transitions.
- **Auto-Claude owns its labels**: Users can manage their own labels freely; Auto-Claude only manages `auto-claude:` prefixed labels.

### 4.2 GitHub Comments

**Investigation Report Comment:**
- Branded header: "Auto-Claude Investigation Report" with emoji + timestamp
- Collapsible sections per agent (matches PR review comment format)
- Severity badge at top
- Posted automatically when "full auto" setting is enabled (follows PR follow-up pattern)
- Manual "Post to GitHub" button when auto-post is disabled
- Re-investigation: new comment posted, old one left as-is (both stay visible)
- Only current investigation can be posted — no backfill of past un-posted results

**Completion Comment:**
- Posted when linked task reaches "done": "This issue was resolved by Auto-Claude task #XXX. PR: #YYY"
- Auto-close issue if setting enabled (configurable toggle, default off)

### 4.3 Linked PR Detection

Investigation checks for linked/referenced PRs on the issue. If found, includes in report: "Existing PR #456 addresses this issue. Status: open/merged."

---

## 5. Settings Configuration

New **"AI Investigation"** subsection within the existing GitHub settings page.

### 5.1 Settings List

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Auto-create tasks from investigations | Toggle | Off | When enabled, auto-creates kanban tasks after investigation. Tasks collect in batch staging area for review. |
| Auto-start tasks when created | Toggle (global) | Off | Auto-start build pipeline when tasks are created (applies to ALL task sources). |
| Pipeline mode for investigation tasks | Dropdown | Full | `Full` / `Skip to planning` / `Minimal` — controls how much spec pipeline runs for investigation-created tasks. |
| Auto-post investigation to GitHub | Toggle | Off | Follows PR follow-up "full auto" pattern. When enabled, posts results automatically. |
| Auto-close issues when task completes | Toggle | Off | Closes GitHub issue with completion comment when linked task reaches "done". |
| Max parallel investigations | Number input | 3 | Range 1-10. Controls how many investigations run simultaneously. |
| Label include filter | Multi-select dropdown | (empty = all) | Synced from repo labels. Only auto-create tasks for issues with these labels. |
| Label exclude filter | Multi-select dropdown | (empty = none) | Synced from repo labels. Never auto-create tasks for issues with these labels. |

### 5.2 Notification Settings

- In-app only (badges/toasts) for investigation events (completed, failed, task auto-created)
- Start investigation-specific, but schema designed to extend into app-wide notification system later

### 5.3 Auto-Create Batch Staging

When auto-create is enabled, tasks don't go directly to kanban. Instead:
- Collapsible inline banner at top of issues view
- Shows pending task creations with approve/reject per item
- Configurable limit before queuing (prevents task flood)

---

## 6. Existing System Changes

### 6.1 Triage System → Replaced

- **Remove triage button** entirely from issue detail view
- Investigation replaces triage as the AI analysis feature
- Old enrichment panel replaced with investigation results panel
- Existing workflow states (`new`, `triaged`, `in_progress`, etc.) replaced with derived investigation states
- Enrichment data for already-triaged issues kept for backwards compatibility but no new triage operations

### 6.2 Create Spec Button → Removed

- **Remove "Create Spec" button** from issue detail view
- Investigation is the only path from GitHub issue to kanban task
- Existing `createSpecForIssue` handler replaced entirely with investigation-based task creation

### 6.3 Enrichment Panel → Replaced

- Old enrichment panel (problem statement, goal, acceptance criteria, completeness %) removed
- Replaced with investigation results panel matching PR review layout
- AI summary replaces raw GitHub issue body as primary view ("Show original" toggle for raw body)

### 6.4 Issue List Updates

- Completeness % replaced with investigation progress bar
- Label pills (already implemented) stay as-is
- New filter chips for investigation state
- Dismissed issues hidden by default with "Show dismissed" toggle

### 6.5 Kanban Task Store

- No changes to normal task workflow
- Task store continues scanning `.auto-claude/specs/` only (not `.auto-claude/issues/`)
- Investigation data lives separately until "Create Task" promotes it

### 6.6 Build Pipeline Extensions

- New `--issue-workflow` flag for `run.py`
- Full issue mode: loads investigation data, skips phases per setting, injects context, tracks lifecycle
- `setup_workspace()` behavior unchanged — `get_or_create_worktree()` is already idempotent and returns existing worktrees

---

## 7. Edge Cases & Failure Handling

### 7.1 App Crash During Investigation

- Auto-resume on restart: detect incomplete investigations, re-run from scratch (full re-run, not resume)
- Worktree already exists, so setup is fast
- Previous partial results discarded

### 7.2 Investigation Failure

- Auto-retry once if all agents error
- If still fails: show "Investigation failed" with error details and "Retry" button
- GitHub label: stays on `auto-claude: investigating` (or removed on cleanup)

### 7.3 Cancellation

- User can cancel running investigation
- Partial results saved and viewable
- Worktree stays (for potential re-investigation)
- Agents terminated gracefully

### 7.4 Closed/Stale Issues

- Investigation allowed on closed issues with warning banner: "This issue is closed"
- Useful for post-mortems and historical analysis

### 7.5 Connection Loss

- Agents continue locally (they only need the worktree/codebase)
- "Post to GitHub" step skipped if connection unavailable
- User can post manually later when connection restores

### 7.6 Already-Resolved Issues

- If investigation finds issue is likely already fixed: "Likely resolved" badge
- Suggest closing the GitHub issue (prominent banner with one-click close)
- "Create Task" button still available if user disagrees

### 7.7 Task Deletion

- If user deletes linked kanban task, issue reverts to "findings_ready" state
- Investigation data preserved in `.auto-claude/issues/`
- User can re-create task from existing findings

### 7.8 Repo Switch

- Investigations are tied to the project, not the repo setting
- Running investigations continue if user switches GitHub repo in settings
- New investigations use the new repo

### 7.9 Re-Investigation

- User can re-run investigation on any issue (even with existing findings)
- Previous results kept (history pattern)
- New GitHub comment posted (old one left as-is)
- If task exists: new findings appended to existing task description

### 7.10 Stale Findings

- No automatic staleness tracking (point-in-time snapshot)
- Investigation timestamp shown prominently
- User's responsibility to re-investigate if codebase changed significantly

### 7.11 Dismiss Flow

- "Dismiss" button with reason dropdown: Won't fix, Duplicate, Cannot reproduce, Out of scope
- Closes issue on GitHub with selected reason as comment
- Dismissed issues hidden from list (toggle to show)

### 7.12 Deleted/Transferred Issues

- If issue disappears from GitHub sync, marked as "stale/removed" in app
- Investigation data preserved locally with warning badge

---

## 8. Shared Infrastructure (DRY with PR Review)

### 8.1 Extract from PR Review System

| Component | Current Location | Shared Pattern |
|-----------|-----------------|----------------|
| `ParallelOrchestratorReviewer` | `runners/github/services/parallel_orchestrator_reviewer.py` | Extract `ParallelAgentOrchestrator` base class |
| `SpecialistConfig` | `parallel_orchestrator_reviewer.py` | Move to shared module |
| `process_sdk_stream()` | `runners/github/services/sdk_utils.py` | Already shared |
| Pydantic structured output | `runners/github/services/pydantic_models.py` | Add investigation models |
| `create_client()` | `core/client.py` | Already shared |
| `AGENT_CONFIGS` | `agents/tools_pkg/models.py` | Add investigation agent configs |
| Finding validation pipeline | `parallel_orchestrator_reviewer.py` | Extract for reuse |
| `createIPCCommunicators` | Frontend IPC handlers | Reuse for investigation progress/complete/error |

### 8.2 New Backend Components

| Component | Purpose |
|-----------|---------|
| `runners/github/services/issue_investigation_orchestrator.py` | Parallel orchestrator for 4 investigation agents |
| `runners/github/services/investigation_models.py` | Pydantic models for investigation structured output |
| `prompts/github/investigation_*.md` | 4 specialist prompt files |
| `runners/github/services/investigation_report_builder.py` | Combines agent outputs into unified report |
| `runners/github/services/investigation_persistence.py` | Read/write `.auto-claude/issues/` data |

### 8.3 New Frontend Components

| Component | Purpose |
|-----------|---------|
| IPC handler: `investigation-handlers.ts` | Start, cancel, status, create-task |
| Store: `investigation-store.ts` | Investigation state, results, progress |
| Component: `InvestigationPanel.tsx` | Results display (mirrors PR review panel) |
| Component: `InvestigateButton.tsx` | State machine button (investigate → running → results → create task) |
| Component: `BatchStagingBanner.tsx` | Inline auto-create staging area |
| Settings section: `InvestigationSettings.tsx` | All investigation toggles |

### 8.4 New IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `GITHUB_INVESTIGATION_START` | Renderer → Main | Start investigation on issue(s) |
| `GITHUB_INVESTIGATION_CANCEL` | Renderer → Main | Cancel running investigation |
| `GITHUB_INVESTIGATION_PROGRESS` | Main → Renderer | Real-time progress updates |
| `GITHUB_INVESTIGATION_COMPLETE` | Main → Renderer | Investigation finished with results |
| `GITHUB_INVESTIGATION_ERROR` | Main → Renderer | Investigation failed |
| `GITHUB_INVESTIGATION_CREATE_TASK` | Renderer → Main | Create kanban task from findings |
| `GITHUB_INVESTIGATION_DISMISS` | Renderer → Main | Dismiss issue with reason |
| `GITHUB_INVESTIGATION_POST_GITHUB` | Renderer → Main | Post results to GitHub |

---

## 9. Testing Strategy

**Integration-first TDD** — test the full flow, then add unit tests for individual components.

### 9.1 Backend Tests

- Investigation orchestrator: mock SDK, verify 4 agents spawned in parallel
- Investigation persistence: read/write `.auto-claude/issues/` data
- Report builder: combine agent outputs into unified report
- Pipeline integration: `--issue-workflow` flag loads investigation context
- Worktree reuse: verify `get_or_create_worktree()` returns existing investigation worktree

### 9.2 Frontend Tests

- Investigation store: state transitions, progress tracking
- InvestigateButton: state machine (investigate → running → results → create task)
- Task creation from investigation: template-based spec generation
- Settings: all toggles persist and apply
- Batch staging: approve/reject flow

### 9.3 E2E Tests

- Full flow: investigate → view results → create task → verify on kanban
- Bulk investigate: select multiple → queue → parallel execution
- Cancel: start investigation → cancel → verify partial results saved
- Auto-create: enable setting → investigate → verify batch staging appears

---

## 10. Gap Analysis Reference

All 98 design decisions are documented below for traceability.

<details>
<summary>Click to expand full gap analysis (98 decisions)</summary>

### Core Architecture (1-10)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Concurrency | Multiple parallel investigations |
| 2 | Agent failure | Retry once, then partial results |
| 3 | Re-investigation | Keep history (previousResult pattern) |
| 4 | Issue types | All types, agents adapt |
| 5 | Button conflict | One smart "Create Task" button (appears after investigation) |
| 6 | Worktree cleanup | Tied to task lifecycle + age-based GC |
| 7 | Context size | Full issue context |
| 8 | Progress UX | Real-time log stream (PRLogs pattern) |
| 9 | Rate limits | Existing multi-account profile swapping |
| 10 | Testing | Integration-first TDD |

### UX & Interaction (11-24)

| # | Topic | Decision |
|---|-------|----------|
| 11 | Button placement | Same layout as PR review system |
| 12 | Navigation during run | Background + badge on issue list |
| 13 | App crash/close | Auto-resume (full re-run on restart) |
| 14 | Duplicate comments | Post new, leave old as-is |
| 15 | Task flood | Batch confirmation inline banner |
| 16 | Existing linked task | Update existing task description |
| 17 | Cancellation | Cancel + keep partial, worktree stays |
| 18 | Closed issues | Allow with warning banner |
| 19 | Connection loss | Agents continue locally, skip GH post |
| 20 | Results UI | Mirror PR review layout |
| 21 | Resume mode | Re-run full (fresh agents, worktree exists) |
| 22 | Queue system | Parallel up to N limit, rest queued |
| 23 | Auto-build | Optional "auto-start" setting |
| 24 | Sharing/export | GitHub comment is the artifact |

### Investigation to Task Transition (25-37)

| # | Topic | Decision |
|---|-------|----------|
| 25 | Spec pipeline | Configurable: Full / Skip to planning / Minimal |
| 26 | Report in task | Full investigation report as description |
| 27 | Auto-run scope | Global toggle (all task sources) |
| 28 | Filter rules | Labels only (synced from repo) |
| 29 | Report storage | New `investigation_report.json` in spec dir |
| 30 | Staging UI | Inline banner in issues view |
| 31 | Settings layout | New "AI Investigation" subsection in GitHub settings |
| 32 | Filter config | Synced label dropdowns (include/exclude) |
| 33 | Parallel limit | Configurable (1-10, default 3) |
| 34 | Already fixed | Flag "Likely resolved" + optional task button |
| 35 | Manual create | One-click create, edit in kanban after |
| 36 | Task linking | Badge + link on issue (bidirectional) |
| 37 | Re-investigate done | Allow, append findings to existing task |

### Settings & Lifecycle (38-44)

| # | Topic | Decision |
|---|-------|----------|
| 38 | Auto-post to GH | Follows PR follow-up "full auto" pattern |
| 39 | Auto-close issue | Configurable toggle (default off) |
| 40 | Bulk investigate | Checkbox selection + filter-based |
| 41-42 | Notifications | In-app only (badges/toasts) |
| 43 | Notification arch | Start specific, plan for app-wide later |
| 44 | Settings complete | Confirmed |

### Existing Issue System Integration (45-68)

| # | Topic | Decision |
|---|-------|----------|
| 45 | Triage vs investigation | Investigation replaces triage |
| 46 | GitHub status labels | Yes, full lifecycle (5 labels) |
| 47 | Button layout | Single "AI Investigate" button, "Create Task" appears after |
| 48 | Live GH changes | Ignore during investigation run |
| 49 | Button states | Investigate → Running → Results → Create Task |
| 50 | Create Task location | Replaces the investigate button after completion |
| 51 | Triage button fate | Removed entirely |
| 52 | Label creation | Auto-create with user consent dialog |
| 53 | Label names | 5 labels: investigating, findings-ready, task-created, building, done |
| 54 | Workflow states | Replace with derived investigation states |
| 55 | Completion sync | Comment + close (if auto-close enabled) |
| 56 | Reverse sync | One-way only (app → GitHub). Auto-Claude owns its labels. |
| 57 | Create Spec fate | Removed entirely |
| 58 | Enrichment panel | Replaced with investigation results panel |
| 59 | Auto-label suggestions | Yes, suggest labels (user accepts/rejects) |
| 60 | List indicators | Progress bar per issue card |
| 61 | Comment format | Match PR review format (collapsible sections) |
| 62 | Bot branding | Branded header at top |
| 63 | Old comments | Leave both (no editing/deleting old comments) |
| 64 | Backfill posting | Only current investigation results |
| 65 | State filters | Filter chips alongside existing filters |
| 66 | Deleted issues | Mark as stale, keep local data |
| 67 | Linked PRs | Detect and show in investigation report |
| 68 | State persistence | Full local persistence |

### Derived State & Dismiss (69-83)

| # | Topic | Decision |
|---|-------|----------|
| 69 | State machine | Fully derived from investigation + task data |
| 70 | Task sync | Auto-sync from kanban (issue state mirrors task status) |
| 71 | Activity log | Minimal log (key events + timestamps) |
| 72 | Summary view | AI summary replaces body ("Show original" toggle) |
| 73 | State list | 7 derived states + "failed" = 8 states total |
| 74 | Label sync timing | Debounced (5-10s delay) |
| 75 | Dismiss action | In-app dismiss + close on GitHub with reason |
| 76 | Task deleted | Revert to findings_ready |
| 77 | Repo switch | Investigations keep running |
| 78 | Stale findings | No staleness tracking (point-in-time) |
| 79 | Batch cancel | Both batch and individual cancel |
| 80 | Dismissed view | Hidden with filter toggle |
| 81 | Failed state | Auto-retry once, then fail with "Retry" button |
| 82 | Resolved action | Suggest closing GitHub issue |
| 83 | Completeness | Confirmed complete |

### Kanban/Pipeline Redesign (84-98)

| # | Topic | Decision |
|---|-------|----------|
| 84 | Worktree strategy | One worktree, two phases (investigate read-only → build writes) |
| 85 | Pipeline entry | Extend existing run.py with --issue-workflow flag |
| 86 | Naming/numbering | Pre-allocate specId at investigation start |
| 87 | Data storage | New `.auto-claude/issues/{issueNumber}/` directory |
| 88 | Issue dir contents | Full investigation home (report, state, logs, comment ID) |
| 89 | Context for build | File in worktree + key findings in coder prompt |
| 90 | Read-only enforcement | Tool grants only (Read/Grep/Glob) |
| 91 | Spec pipeline config | Honors gap 25 configurable setting |
| 92 | Handler approach | Replace existing createSpecForIssue entirely |
| 93 | File merge on build | Copy spec, keep investigation data alongside |
| 94 | Kanban visibility | Separate until "Create Task" promotes to specs dir |
| 95 | Full flow confirmed | Allocate specId → worktree → investigate → Create Task → specs → kanban → build reuses worktree |
| 96 | Spec generation | Template-based (deterministic, no AI cost) |
| 97 | Pipeline flag behavior | Full issue mode (load investigation, skip phases, inject context) |
| 98 | Completeness | Confirmed complete |

</details>
