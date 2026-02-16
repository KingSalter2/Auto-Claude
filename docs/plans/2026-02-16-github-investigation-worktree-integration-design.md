# GitHub Investigation → Worktree Integration Design

**Date:** 2026-02-16
**Author:** Design exploration via brainstorming session
**Status:** Approved

## Problem Statement

GitHub issues are investigated with detailed reports, but when these issues are pushed to the Kanban board as tasks, the investigation data is **not accessible** to:
- ❌ AI agents working in worktrees (can't see root cause, evidence, fix approaches)
- ❌ Human reviewers (can't validate if the actual bug is fixed)
- ❌ QA system (can't verify the issue is resolved, only checks code quality)

## Current State

### Data Flow (Broken)

```
.auto-claude/issues/1801/                    ← Investigation data lives here
├── investigation_report.json
├── investigation_logs.json
└── activity_log.json
         ↓
         [Create Task button clicked]
         ↓
.auto-claude/specs/001-fix-bug/              ← Only summary copied
├── implementation_plan.json                 (description has investigation summary)
├── requirements.json
└── task_metadata.json
         ↓
         [Worktree created]
         ↓
.auto-claude/worktrees/tasks/001-fix-bug/    ← NO investigation data!
└── .auto-claude/specs/001-fix-bug/
    (implementation_plan.json, requirements.json, task_metadata.json)
```

### Key Issues

1. **Agents lack context** — Only get investigation summary, not full report with evidence and code paths
2. **Humans can't validate** — No visibility into investigation findings during review
3. **QA doesn't verify fix** — Checks code quality/tests, but not if the actual bug is resolved
4. **No feedback loop validation** — QA rejects → Fixer fixes → QA re-runs, but never validates against original issue

## Solution: Spec Directory Augmentation

**Approach:** Copy investigation files to spec directory at task creation. Worktree setup's existing `copy_spec_to_worktree()` naturally propagates everything.

### Why This Approach

✅ **Leverages existing patterns** — `copy_spec_to_worktree()` already handles copying spec files
✅ **Safest changes** — Modifications in IPC handlers, not core workspace setup
✅ **True isolation** — Worktrees are fully self-contained
✅ **Cross-platform** — No symlink headaches on Windows
✅ **YAGNI** — Investigation reports are static; no auto-sync needed

## Design

### 1. Data Flow (Fixed)

```
.auto-claude/issues/1801/
├── investigation_report.json
├── investigation_logs.json
└── activity_log.json
         ↓
         [Create Task button clicked]
         ↓
.auto-claude/specs/001-fix-bug/              ← NEW: Investigation files copied
├── implementation_plan.json
├── requirements.json
├── task_metadata.json (sourceType: github, githubIssueNumber, baseBranch)
├── investigation_report.json  ← NEW!
├── investigation_logs.json   ← NEW!
└── activity_log.json         ← NEW!
         ↓
         [Worktree created]
         ↓
.auto-claude/worktrees/tasks/001-fix-bug/
└── .auto-claude/specs/001-fix-bug/
    ├── implementation_plan.json
    ├── requirements.json
    ├── task_metadata.json
    ├── investigation_report.json  ← Automatically included!
    ├── investigation_logs.json   ← Automatically included!
    └── activity_log.json         ← Automatically included!
```

### 2. Agent Context Enhancement

**Goal:** Agents receive full investigation context when implementing fixes.

**Implementation:**

1. **Copy investigation files to spec directory**
   - File: `apps/frontend/src/main/ipc-handlers/github/spec-utils.ts`
   - Function: `createSpecForIssue()` (after line 184)
   - Copies: `investigation_report.json`, `investigation_logs.json`, `activity_log.json`

2. **Load investigation context in agent**
   - File: `apps/backend/agents/coder.py`
   - Function: `load_investigation_context(spec_dir: Path) -> dict | None`
   - Returns structured context (root cause, fix approaches, gotchas, reproducer)

3. **Inject into agent prompt using XML tags** (per Anthropic Opus 4.6 best practices)
   ```xml
   <github_investigation_context>
   <root_cause_analysis>...</root_cause_analysis>
   <fix_approaches>...</fix_approaches>
   <gotchas>...</gotchas>
   <patterns_to_follow>...</patterns_to_follow>
   <verification_steps>...</verification_steps>
   </github_investigation_context>

   <investigation_usage_guidance>
   Use the investigation context above to inform your implementation, but:
   - Verify findings independently before making changes
   - Prioritize the recommended fix approach unless you find a better solution
   - Reference the evidence and code paths when making changes
   - Use the verification steps to confirm your fix works
   </investigation_usage_guidance>
   ```

4. **Prevent overthinking** (Opus 4.6 specific)
   ```xml
   <focus_guidance>
   When implementing, choose an approach from the investigation and commit to it.
   Avoid revisiting decisions unless you encounter new information that contradicts your reasoning.
   If you need to course-correct, you can always adjust later.
   </focus_guidance>
   ```

### 3. Human Visibility Enhancement

**Goal:** Humans can see investigation findings when reviewing tasks.

**Implementation:**

1. **TaskCard enhancement**
   - File: `apps/frontend/src/renderer/components/task/TaskCard.tsx`
   - Shows: GitHub issue badge + "Show Investigation" button (if `sourceType === 'github'`)

2. **InvestigationSummary component** (new)
   - File: `apps/frontend/src/renderer/components/task/InvestigationSummary.tsx`
   - Displays:
     - Root cause summary
     - Recommended fix approach
     - Link to full report (opens in VSCode)

3. **useInvestigationData hook** (new)
   - File: `apps/frontend/src/renderer/hooks/useInvestigationData.ts`
   - Calls IPC handler to load investigation data

4. **IPC handler** (new)
   - File: `apps/frontend/src/main/ipc-handlers/task/investigation-handlers.ts`
   - Handler: `TASK_GET_INVESTIGATION_DATA`
   - Reads: `.auto-claude/specs/{specId}/investigation_report.json`

5. **Review modal enhancement**
   - File: `apps/frontend/src/renderer/components/task/TaskReviewModal.tsx`
   - Adds: Validation checklist
     - ☐ Root cause addressed?
     - ☐ Reproducer fixed?
     - ☐ Gotchas avoided?

### 4. QA Validation Enhancement

**Goal:** QA validates the bug is actually fixed, not just code quality.

**Implementation:**

1. **Load investigation context in QA**
   - File: `apps/backend/qa/reviewer.py`
   - Function: `load_qa_investigation_context(spec_dir, base_branch)`

2. **QA reviewer prompt enhancement**
   - File: `apps/backend/prompts/qa_reviewer.md`
   - Adds: `<github_issue_validation>` section with:
     - Root cause to validate
     - Evidence of the issue
     - Reproduction steps (if available)
     - Expected impact (before/after)
     - Validation checklist:
       1. Verify root cause is addressed
       2. Validate the issue is resolved
       3. Check for regressions
       4. Verify minimal changes

3. **QA signoff enhancement**
   - File: `apps/backend/qa/loop.py`
   - Adds: `investigation_validation` field to QA signoff
   ```json
   {
     "status": "approved",
     "investigation_validation": {
       "root_cause_addressed": true,
       "reproducer_passed": true,
       "expected_outcome_achieved": true,
       "validation_notes": "The fix correctly addresses the race condition..."
     }
   }
   ```

4. **QA fixer context**
   - File: `apps/backend/qa/fixer.py`
   - Passes: Investigation context (root cause, reproducer, fix approaches)
   - Guidance: "Ensure your fix actually addresses these findings. Don't just make QA errors go away."

## Files to Create/Modify

### Create (4 files)

1. `apps/frontend/src/renderer/components/task/InvestigationSummary.tsx`
2. `apps/frontend/src/renderer/hooks/useInvestigationData.ts`
3. `apps/frontend/src/main/ipc-handlers/task/investigation-handlers.ts`
4. `apps/backend/agents/investigation_context.py` (utility module)

### Modify (8 files)

1. `apps/frontend/src/main/ipc-handlers/github/spec-utils.ts` — Copy investigation files to spec
2. `apps/frontend/src/renderer/components/task/TaskCard.tsx` — Show investigation badge
3. `apps/frontend/src/renderer/components/task/TaskReviewModal.tsx` — Validation checklist
4. `apps/backend/agents/coder.py` — Load investigation context
5. `apps/backend/prompts/coder.md` — Investigation prompt section
6. `apps/backend/qa/reviewer.py` — Load investigation for QA
7. `apps/backend/prompts/qa_reviewer.md` — Investigation validation
8. `apps/backend/qa/fixer.py` — Pass investigation to fixer

**Total: 12 files, ~400 lines of code (estimated)**

## Success Criteria

- ✅ Agents can access full investigation report when implementing fixes
- ✅ Humans can see investigation findings during review
- ✅ QA validates the bug is fixed (not just code quality)
- ✅ Existing workflow unchanged for non-GitHub tasks
- ✅ Worktrees remain fully isolated
- ✅ Cross-platform compatibility maintained

## Future Enhancements (Out of Scope)

- Auto-comment GitHub issue during QA phases
- Auto-close GitHub issue when task marked 'done'
- Category-specific QA prompts (security, performance, UI/UX)
- QA feedback posted to GitHub issue

## References

- [Claude Opus 4.6 Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- Investigation deep dive report: Agent `a9b71f6` output
- Current GitHub→Kanban workflow investigation: Agent `aeb13e2` output
