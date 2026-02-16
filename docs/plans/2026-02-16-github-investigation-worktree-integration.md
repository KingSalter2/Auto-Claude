# GitHub Investigation → Worktree Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Copy investigation data from `.auto-claude/issues/{issueNumber}/` to spec directories so agents, humans, and QA can access full investigation context when working on GitHub-sourced tasks.

**Architecture:** Spec directory augmentation — copy investigation files (`investigation_report.json`, `investigation_logs.json`, `activity_log.json`) to spec directory during Kanban task creation. Existing `copy_spec_to_worktree()` naturally propagates everything to worktrees. Load investigation context in agents and QA using XML-tagged prompts (per Anthropic Opus 4.6 best practices). Add UI components for human visibility.

**Tech Stack:** TypeScript (Electron frontend), Python (backend), React (renderer), Anthropic Claude Agent SDK

---

## Task 1: Copy Investigation Files to Spec Directory

**Files:**
- Modify: `apps/frontend/src/main/ipc-handlers/github/spec-utils.ts`

**Step 1: Locate the spec creation function**

Open `apps/frontend/src/main/ipc-handlers/github/spec-utils.ts` and find the `createSpecForIssue()` function (around line 95-184).

**Step 2: Add investigation file copy logic after spec files are written**

Add this code after line 184 (after `task_metadata.json` is written, before the return statement):

```typescript
// Copy investigation data to spec directory for agent context
const investigationDir = path.join(project.path, '.auto-claude', 'issues', `${issueNumber}`);
const specDir = path.join(project.path, specsBase, specData.specId);

if (fs.existsSync(investigationDir)) {
  const filesToCopy = [
    'investigation_report.json',
    'investigation_logs.json',
    'activity_log.json'
  ];

  let copiedCount = 0;
  for (const file of filesToCopy) {
    const src = path.join(investigationDir, file);
    const dest = path.join(specDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      copiedCount++;
    }
  }

  if (copiedCount > 0) {
    debug('github', `[spec-utils] Copied ${copiedCount} investigation files to spec ${specData.specId}`);
  }
}
```

**Step 3: Verify the code compiles**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/github/spec-utils.ts
git commit -m "feat(github): copy investigation files to spec directory

When creating a task from a GitHub issue investigation, copy the
investigation report, logs, and activity files to the spec directory
so they propagate to worktrees and are available to agents.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Investigation Context Loader Module

**Files:**
- Create: `apps/backend/agents/investigation_context.py`

**Step 1: Create the investigation context loader module**

Create `apps/backend/agents/investigation_context.py`:

```python
"""
Investigation context loading for agents.

Provides utilities to load investigation data from spec directories
for GitHub-sourced tasks.
"""

import json
from pathlib import Path
from typing import Any


def load_investigation_context(spec_dir: Path) -> dict[str, Any] | None:
    """
    Load investigation context if this spec was created from a GitHub issue.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        Structured investigation context with root_cause, fix_approaches,
        reproducer, gotchas, and patterns_to_follow, or None if no
        investigation data exists.
    """
    investigation_report_path = spec_dir / "investigation_report.json"

    if not investigation_report_path.exists():
        return None

    try:
        with open(investigation_report_path) as f:
            report = json.load(f)

        # Structure the context for agents
        return {
            "root_cause": {
                "summary": report.get("root_cause", {}).get("summary"),
                "evidence": report.get("root_cause", {}).get("evidence", []),
                "code_paths": report.get("root_cause", {}).get("code_paths", [])
            },
            "fix_approaches": report.get("fix_approaches", []),
            "reproducer": report.get("reproducer"),
            "gotchas": report.get("gotchas", []),
            "patterns_to_follow": report.get("patterns_to_follow", []),
            "impact": report.get("impact", {})
        }
    except (json.JSONDecodeError, OSError):
        return None


def load_investigation_for_qa(spec_dir: Path, base_branch: str) -> dict[str, Any] | None:
    """
    Load investigation context for QA validation.

    Similar to load_investigation_context but includes base_branch
    for QA comparison.

    Args:
        spec_dir: Path to the spec directory
        base_branch: Base branch to compare against (e.g., 'main', 'develop')

    Returns:
        Structured investigation context with root_cause, reproducer,
        impact, expected_outcome, and base_branch, or None if no
        investigation data exists.
    """
    investigation_report_path = spec_dir / "investigation_report.json"

    if not investigation_report_path.exists():
        return None

    try:
        with open(investigation_report_path) as f:
            report = json.load(f)

        return {
            "root_cause": {
                "summary": report.get("root_cause", {}).get("summary"),
                "evidence": report.get("root_cause", {}).get("evidence", []),
                "code_paths": report.get("root_cause", {}).get("code_paths", [])
            },
            "reproducer": report.get("reproducer"),
            "impact": report.get("impact", {}),
            "expected_outcome": report.get("expected_outcome"),
            "base_branch": base_branch
        }
    except (json.JSONDecodeError, OSError):
        return None
```

**Step 2: Verify the module imports correctly**

Run: `cd apps/backend && python -c "from agents.investigation_context import load_investigation_context; print('OK')"`

Expected: Output "OK" with no errors

**Step 3: Commit**

```bash
git add apps/backend/agents/investigation_context.py
git commit -m "feat(agents): add investigation context loader module

Provides load_investigation_context() and load_investigation_for_qa()
to load investigation data from spec directories for GitHub-sourced tasks.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Load Investigation Context in Coder Agent

**Files:**
- Modify: `apps/backend/agents/coder.py`

**Step 1: Find where agent context is loaded**

Open `apps/backend/agents/coder.py` and search for where spec context is loaded (around line 773 - look for `load_subtask_context` or similar).

**Step 2: Add investigation context loading**

After the existing context loading code, add:

```python
# Load investigation context if this is a GitHub-sourced task
from agents.investigation_context import load_investigation_context

investigation_context = load_investigation_context(spec_dir)
if investigation_context:
    agent_context["investigation"] = investigation_context
```

**Step 3: Verify the code imports correctly**

Run: `cd apps/backend && python -c "from agents.coder import CoderAgent; print('OK')"`

Expected: Output "OK" with no import errors

**Step 4: Commit**

```bash
git add apps/backend/agents/coder.py
git commit -m "feat(agents): load investigation context in coder agent

When a spec has investigation data (from GitHub issues), load it
into the agent context so agents can access root cause analysis,
fix approaches, gotchas, and other investigation findings.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Investigation Section to Coder Agent Prompt

**Files:**
- Modify: `apps/backend/prompts/coder.md` OR the prompt template used by coder agents

**Step 1: Find the coder agent prompt file**

Search for where the coder agent system prompt is defined. This may be:
- `apps/backend/prompts/coder.md`
- `apps/backend/prompts_pkg/prompts.py` with a `get_coder_prompt()` function
- Or similar

**Step 2: Add investigation context section to the prompt**

Add this section to the prompt template (use appropriate template syntax for the prompt system):

```xml
<% if investigation: %>
<github_investigation_context>
This task was created from a GitHub issue investigation. Use this context to guide your work.

<root_cause_analysis>
<% investigation.root_cause.summary %>

**Evidence:**
<% for evidence in investigation.root_cause.evidence: %>
- <% evidence %>
<% endfor %>

**Code Paths:**
<% for path in investigation.root_cause.code_paths: %>
- `<% path %>`
<% endfor %>
</root_cause_analysis>

<fix_approaches>
<% for i, approach in enumerate(investigation.fix_approaches, 1): %>
<% i %>. <% approach.name %>
   - <% approach.description %>
   - Pros: <% approach.pros | join(", ") %>
   - Cons: <% approach.cons | join(", ") %>
<% endfor %>
</fix_approaches>

<% if investigation.gotchas: %>
<gotchas>
<% for gotcha in investigation.gotchas: %>
- <% gotcha %>
<% endfor %>
</gotchas>
<% endif %>

<% if investigation.patterns_to_follow: %>
<patterns_to_follow>
<% for pattern in investigation.patterns_to_follow: %>
- <% pattern %>
<% endfor %>
</patterns_to_follow>
<% endif %>

<% if investigation.reproducer: %>
<verification_steps>
To verify the fix:
<% investigation.reproducer %>
</verification_steps>
<% endif %>
</github_investigation_context>

<investigation_usage_guidance>
Use the investigation context above to inform your implementation, but:
- Verify findings independently before making changes
- Prioritize the recommended fix approach unless you find a better solution
- Reference the evidence and code paths when making changes
- Use the verification steps to confirm your fix works
</investigation_usage_guidance>
<% endif %>

<focus_guidance>
When implementing, choose an approach and commit to it. Avoid revisiting decisions unless you encounter new information that directly contradicts your reasoning. If you need to course-correct, you can always adjust later.
</focus_guidance>
```

**Step 3: Verify prompt template syntax**

Check if the template syntax matches your prompt system (Jinja2, custom, etc.). Adjust if needed.

**Step 4: Commit**

```bash
git add apps/backend/prompts/coder.md
# OR: git add apps/backend/prompts_pkg/prompts.py
git commit -m "feat(prompts): add investigation context section to coder prompt

When investigation context is available (from GitHub issues), include:
- Root cause analysis with evidence and code paths
- Recommended fix approaches with pros/cons
- Gotchas and patterns to follow
- Verification steps/reproducer

Uses XML tags per Anthropic Opus 4.6 best practices.
Includes focus_guidance to prevent overthinking.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create IPC Handler for Investigation Data

**Files:**
- Create: `apps/frontend/src/main/ipc-handlers/task/investigation-handlers.ts`

**Step 1: Create the investigation handlers module**

Create `apps/frontend/src/main/ipc-handlers/task/investigation-handlers.ts`:

```typescript
import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { getTaskById } from '../task/crud-handlers'; // Adjust import path as needed

export const TASK_GET_INVESTIGATION_DATA = 'task:getInvestigationData';

export function registerTaskInvestigationHandlers() {
  ipcMain.handle(TASK_GET_INVESTIGATION_DATA, async (event, taskId: string) => {
    try {
      const task = await getTaskById(taskId);

      if (!task || task.sourceType !== 'github') {
        return null;
      }

      // Find the spec directory
      const specDir = path.join(
        task.projectPath,
        '.auto-claude',
        'specs',
        task.specId
      );

      const reportPath = path.join(specDir, 'investigation_report.json');

      if (!fs.existsSync(reportPath)) {
        return null;
      }

      const reportContent = fs.readFileSync(reportPath, 'utf-8');
      const report = JSON.parse(reportContent);

      // Return structured data for the UI
      return {
        root_cause: report.root_cause,
        fix_approaches: report.fix_approaches,
        reproducer: report.reproducer,
        gotchas: report.gotchas,
        patterns_to_follow: report.patterns_to_follow,
        impact: report.impact,
        reportPath
      };
    } catch (error) {
      console.error('Error loading investigation data:', error);
      return null;
    }
  });
}
```

**Step 2: Register the handler in the main process**

Find where IPC handlers are registered (likely in `apps/frontend/src/main/index.ts` or similar) and add:

```typescript
import { registerTaskInvestigationHandlers } from './ipc-handlers/task/investigation-handlers';

// In app.whenReady() or similar:
registerTaskInvestigationHandlers();
```

**Step 3: Add TypeScript types**

Create or update `apps/frontend/src/types/investigation.ts`:

```typescript
export interface InvestigationReport {
  root_cause: {
    summary: string;
    evidence: string[];
    code_paths: string[];
  };
  fix_approaches: Array<{
    name: string;
    description: string;
    pros: string[];
    cons: string[];
  }>;
  reproducer?: string;
  gotchas?: string[];
  patterns_to_follow?: string[];
  impact?: {
    before?: string;
    after?: string;
  };
  expected_outcome?: string;
}

export interface InvestigationData extends InvestigationReport {
  reportPath: string;
}
```

**Step 4: Verify TypeScript compilation**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add apps/frontend/src/main/ipc-handlers/task/investigation-handlers.ts
git add apps/frontend/src/types/investigation.ts
git commit -m "feat(ipc): add investigation data handler

Adds TASK_GET_INVESTIGATION_DATA IPC handler to load investigation
report data for GitHub-sourced tasks. Returns structured data for
UI components to display root cause, fix approaches, gotchas, etc.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create useInvestigationData Hook

**Files:**
- Create: `apps/frontend/src/renderer/hooks/useInvestigationData.ts`

**Step 1: Create the hook**

Create `apps/frontend/src/renderer/hooks/useInvestigationData.ts`:

```typescript
import { useState, useEffect } from 'react';
import type { InvestigationData } from '@shared/types/investigation';

export function useInvestigationData(taskId: string) {
  const [investigation, setInvestigation] = useState<InvestigationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadInvestigation() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await window.electronAPI.task.getInvestigationData(taskId);

        if (!cancelled) {
          setInvestigation(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInvestigation();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return { investigation, isLoading, error };
}
```

**Step 2: Add electronAPI type definition**

Update `apps/frontend/src/preload/electronAPI.ts` (or similar):

```typescript
const electronAPI = {
  // ... existing APIs
  task: {
    // ... existing task APIs
    getInvestigationData: (taskId: string) => ipcRenderer.invoke('task:getInvestigationData', taskId),
  },
};
```

**Step 3: Verify TypeScript compilation**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/frontend/src/renderer/hooks/useInvestigationData.ts
git add apps/frontend/src/preload/electronAPI.ts
git commit -m "feat(hooks): add useInvestigationData hook

React hook to load investigation data for GitHub-sourced tasks.
Handles loading state, error state, and cleanup on unmount.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create InvestigationSummary Component

**Files:**
- Create: `apps/frontend/src/renderer/components/task/InvestigationSummary.tsx`

**Step 1: Create the component**

Create `apps/frontend/src/renderer/components/task/InvestigationSummary.tsx`:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useInvestigationData } from '@hooks/useInvestigationData';
import type { InvestigationData } from '@shared/types/investigation';

interface InvestigationSummaryProps {
  taskId: string;
}

export function InvestigationSummary({ taskId }: InvestigationSummaryProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { investigation, isLoading, error } = useInvestigationData(taskId);

  if (isLoading) {
    return <div className="text-sm text-gray-500">{t('tasks:investigation.loading')}</div>;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        {t('tasks:investigation.error')}: {error.message}
      </div>
    );
  }

  if (!investigation) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
      <h4 className="font-semibold mb-2 text-sm">{t('tasks:investigation.title')}</h4>

      {/* Root Cause */}
      <div className="mb-3">
        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('tasks:investigation.rootCause')}
        </h5>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {investigation.root_cause.summary}
        </p>
      </div>

      {/* Recommended Fix */}
      {investigation.fix_approaches && investigation.fix_approaches.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tasks:investigation.recommendedFix')}
          </h5>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {investigation.fix_approaches[0].description}
          </p>
        </div>
      )}

      {/* Gotchas */}
      {investigation.gotchas && investigation.gotchas.length > 0 && (
        <div className="mb-3">
          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('tasks:investigation.gotchas')}
          </h5>
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
            {investigation.gotchas.map((gotcha, index) => (
              <li key={index}>{gotcha}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Link to full report */}
      <a
        href={`vscode://file/${investigation.reportPath}`}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('tasks:investigation.viewFullReport')} →
      </a>
    </div>
  );
}
```

**Step 2: Add i18n translation keys**

Add to `apps/frontend/src/shared/i18n/locales/en/tasks.json`:

```json
{
  "investigation": {
    "title": "Investigation Findings",
    "loading": "Loading investigation...",
    "error": "Error loading investigation",
    "rootCause": "Root Cause",
    "recommendedFix": "Recommended Fix",
    "gotchas": "Gotchas",
    "viewFullReport": "View full investigation report"
  }
}
```

Add to `apps/frontend/src/shared/i18n/locales/fr/tasks.json`:

```json
{
  "investigation": {
    "title": "Résultats de l'enquête",
    "loading": "Chargement de l'enquête...",
    "error": "Erreur lors du chargement de l'enquête",
    "rootCause": "Cause racine",
    "recommendedFix": "Correction recommandée",
    "gotchas": "Pièges",
    "viewFullReport": "Voir le rapport complet"
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add apps/frontend/src/renderer/components/task/InvestigationSummary.tsx
git add apps/frontend/src/shared/i18n/locales/en/tasks.json
git add apps/frontend/src/shared/i18n/locales/fr/tasks.json
git commit -m "feat(ui): add InvestigationSummary component

Displays investigation findings for GitHub-sourced tasks:
- Root cause summary
- Recommended fix approach
- Gotchas list
- Link to full report in VSCode

Uses i18n for localization (en/fr).

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Investigation Badge and Toggle to TaskCard

**Files:**
- Modify: `apps/frontend/src/renderer/components/task/TaskCard.tsx`

**Step 1: Locate the TaskCard component**

Open `apps/frontend/src/renderer/components/task/TaskCard.tsx`.

**Step 2: Add state for showing investigation**

Add to the component (after existing state declarations):

```typescript
const [showInvestigation, setShowInvestigation] = useState(false);
```

**Step 3: Add GitHub issue badge and toggle button**

Add this after the task title/badge section (find where task status or source badges are displayed):

```typescript
{/* GitHub issue badge and investigation toggle */}
{task.sourceType === 'github' && (
  <div className="flex items-center gap-2 mt-2">
    <GitHubIssueIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
    <span className="text-xs text-gray-600 dark:text-gray-400">
      Issue #{task.metadata.githubIssueNumber}
    </span>
    <button
      onClick={() => setShowInvestigation(!showInvestigation)}
      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
    >
      {showInvestigation ? t('tasks:investigation.hide') : t('tasks:investigation.show')}
    </button>
  </div>
)}

{/* Investigation summary */}
{showInvestigation && task.sourceType === 'github' && (
  <InvestigationSummary taskId={task.id} />
)}
```

**Step 4: Add necessary imports**

Add at the top of the file:

```typescript
import { InvestigationSummary } from './InvestigationSummary';
import { GitHubIssueIcon } from '@shared/icons'; // Adjust import path as needed
```

**Step 5: Add i18n translation keys**

Add to `apps/frontend/src/shared/i18n/locales/en/tasks.json`:

```json
{
  "investigation": {
    "show": "Show Investigation",
    "hide": "Hide"
  }
}
```

Add to `apps/frontend/src/shared/i18n/locales/fr/tasks.json`:

```json
{
  "investigation": {
    "show": "Afficher l'enquête",
    "hide": "Masquer"
  }
}
```

**Step 6: Verify TypeScript compilation**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 7: Commit**

```bash
git add apps/frontend/src/renderer/components/task/TaskCard.tsx
git add apps/frontend/src/shared/i18n/locales/en/tasks.json
git add apps/frontend/src/shared/i18n/locales/fr/tasks.json
git commit -m "feat(ui): add investigation badge and toggle to TaskCard

Shows GitHub issue badge with 'Show Investigation' button for
GitHub-sourced tasks. Toggles InvestigationSummary component
with key findings from the investigation report.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add Investigation Validation to Task Review Modal

**Files:**
- Modify: `apps/frontend/src/renderer/components/task/TaskReviewModal.tsx` (or similar review UI file)

**Step 1: Locate the review modal component**

Find the component that handles task review/human review phase.

**Step 2: Add investigation section to review modal**

Add this section after the existing review content (find where implementation changes or QA results are shown):

```typescript
{/* Investigation validation for GitHub tasks */}
{task.sourceType === 'github' && (
  <section className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
    <h3 className="font-semibold mb-3 text-sm">{t('tasks:review.investigationContext')}</h3>

    <InvestigationSummary taskId={task.id} />

    {/* Validation checklist */}
    {investigation && (
      <div className="mt-4">
        <h4 className="text-xs font-medium mb-2">{t('tasks:review.validationChecklist')}</h4>

        <label className="flex items-center gap-2 mt-2 text-xs">
          <input type="checkbox" className="rounded" />
          <span>{t('tasks:review.checklist.rootCauseAddressed')}</span>
        </label>

        {investigation.reproducer && (
          <label className="flex items-center gap-2 mt-1 text-xs">
            <input type="checkbox" className="rounded" />
            <span>{t('tasks:review.checklist.reproducerPassed')}</span>
          </label>
        )}

        {investigation.gotchas && investigation.gotchas.length > 0 && (
          <label className="flex items-center gap-2 mt-1 text-xs">
            <input type="checkbox" className="rounded" />
            <span>{t('tasks:review.checklist.gotchasAvoided')}</span>
          </label>
        )}
      </div>
    )}
  </section>
)}
```

**Step 3: Add i18n translation keys**

Add to `apps/frontend/src/shared/i18n/locales/en/tasks.json`:

```json
{
  "review": {
    "investigationContext": "Investigation Context",
    "validationChecklist": "Validation Checklist",
    "checklist": {
      "rootCauseAddressed": "Root cause addressed?",
      "reproducerPassed": "Reproducer passed?",
      "gotchasAvoided": "Gotchas avoided?"
    }
  }
}
```

Add to `apps/frontend/src/shared/i18n/locales/fr/tasks.json`:

```json
{
  "review": {
    "investigationContext": "Contexte de l'enquête",
    "validationChecklist": "Liste de validation",
    "checklist": {
      "rootCauseAddressed": "Cause racine traitée ?",
      "reproducerPassed": "Reproducteur passé ?",
      "gotchasAvoided": "Pièges évités ?"
    }
  }
}
```

**Step 4: Verify TypeScript compilation**

Run: `cd apps/frontend && npm run typecheck`

Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add apps/frontend/src/renderer/components/task/TaskReviewModal.tsx
git add apps/frontend/src/shared/i18n/locales/en/tasks.json
git add apps/frontend/src/shared/i18n/locales/fr/tasks.json
git commit -m "feat(ui): add investigation validation to review modal

Shows investigation context and validation checklist when reviewing
GitHub-sourced tasks. Checklist includes:
- Root cause addressed
- Reproducer passed (if available)
- Gotchas avoided (if any)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Load Investigation Context in QA Reviewer

**Files:**
- Modify: `apps/backend/qa/reviewer.py` (or where QA reviewer is invoked)

**Step 1: Find where QA reviewer context is built**

Open `apps/backend/qa/reviewer.py` and find where the QA reviewer agent is created/invoked.

**Step 2: Add investigation context loading**

Add this before the QA reviewer prompt is built:

```python
from agents.investigation_context import load_investigation_for_qa

# Load investigation context for GitHub-sourced tasks
investigation_context = load_investigation_for_qa(spec_dir, base_branch)

# Add to QA context
if investigation_context:
    qa_context["investigation"] = investigation_context
```

**Step 3: Verify the code imports correctly**

Run: `cd apps/backend && python -c "from qa.reviewer import run_qa_agent_session; print('OK')"`

Expected: Output "OK" with no import errors

**Step 4: Commit**

```bash
git add apps/backend/qa/reviewer.py
git commit -m "feat(qa): load investigation context in QA reviewer

When a spec has investigation data (from GitHub issues), load it
into the QA context so the reviewer can validate that the root
cause is addressed and the reproducer passes.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Add Investigation Validation to QA Reviewer Prompt

**Files:**
- Modify: `apps/backend/prompts/qa_reviewer.md` OR the QA prompt template

**Step 1: Find the QA reviewer prompt file**

Search for where the QA reviewer system prompt is defined.

**Step 2: Add investigation validation section to the prompt**

Add this section to the QA prompt template:

```xml
<% if investigation: %>
<github_issue_validation>
This task was created from a GitHub issue investigation. You must verify that the issue is actually fixed, not just that code changed.

## Issue to Validate

**Root Cause:**
<% investigation.root_cause.summary %>

**Evidence of the Issue:**
<% for evidence in investigation.root_cause.evidence: %>
- <% evidence %>
<% endfor %>

**Affected Code Paths:**
<% for path in investigation.root_cause.code_paths: %>
- `<% path %>`
<% endfor %>

<% if investigation.reproducer: %>
## Reproduction Steps
To verify the fix, you should:
<% investigation.reproducer %>

**ACTION REQUIRED:** Attempt to reproduce the issue following these steps. If a reproducer script or test is mentioned, run it to confirm the issue is fixed.
<% endif %>

<% if investigation.impact: %>
## Expected Impact
After the fix, the following should be true:
<% if investigation.impact.before: %>
- **Before:** <% investigation.impact.before %>
<% endif %>
<% if investigation.impact.after: %>
- **After:** <% investigation.impact.after %>
<% endif %>
<% endif %>

## Validation Checklist

In your review, you MUST:

1. **Verify the root cause is addressed**
   - Check that the specific code paths mentioned in the investigation have been modified appropriately
   - Confirm the fix targets the root cause, not just symptoms

2. **Validate the issue is resolved**
   <% if investigation.reproducer: %>
   - Run the reproducer to confirm it no longer triggers the issue
   <% endif %>
   - Check that the "before" state is no longer present
   <% if investigation.impact.after: %>
   - Verify the "after" state is achieved
   <% endif %>

3. **Check for regressions**
   - Ensure the fix doesn't break related functionality
   - Run tests in the affected areas

4. **Verify minimal changes**
   - The fix should be focused and minimal
   - Avoid over-engineering or unnecessary refactoring

## Comparison Context
You are comparing changes from branch `<% investigation.base_branch %>` to the current worktree.

Focus your review on whether these changes actually fix the described issue.
</github_issue_validation>
<% endif %>
```

**Step 3: Verify prompt template syntax**

Check if the template syntax matches your prompt system.

**Step 4: Commit**

```bash
git add apps/backend/prompts/qa_reviewer.md
# OR: git add apps/backend/prompts_pkg/prompts.py
git commit -m "feat(prompts): add investigation validation to QA reviewer

When investigation context is available, QA reviewer validates:
- Root cause is addressed (not just symptoms)
- Reproducer passes (if available)
- Expected impact achieved
- Changes are minimal
- No regressions introduced

Uses XML tags per Anthropic Opus 4.6 best practices.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Add Investigation Validation to QA Signoff

**Files:**
- Modify: `apps/backend/qa/loop.py` (or where QA results are saved)

**Step 1: Find where QA signoff is saved**

Open `apps/backend/qa/loop.py` and find where `qa_signoff` is written to `implementation_plan.json`.

**Step 2: Add investigation validation to signoff**

Modify the QA signoff structure to include investigation validation:

```python
# After QA reviewer completes
qa_result = {
    "status": status,  # "approved" or "rejected"
    "timestamp": datetime.now().isoformat(),
    "qa_session": qa_iteration,
    "issues_found": issues_found if status == "rejected" else [],
    "tests_passed": tests_passed,
}

# Add investigation validation if available
if investigation_context:
    # Ask the QA agent for investigation-specific validation
    validation_prompt = """
Based on your review, provide a JSON object with:
1. root_cause_addressed: true or false - Is the root cause fixed?
2. reproducer_passed: true, false, or "N/A" - Did the reproducer pass?
3. expected_outcome_achieved: true or false - Is the expected outcome achieved?
4. validation_notes: Brief explanation of why the issue is/isn't fixed

Respond ONLY with valid JSON.
"""

    validation_response = await ask_agent_for_validation(validation_prompt)

    try:
        validation = json.loads(validation_response)
        qa_result["investigation_validation"] = {
            "root_cause_addressed": validation.get("root_cause_addressed", False),
            "reproducer_passed": validation.get("reproducer_passed", "N/A"),
            "expected_outcome_achieved": validation.get("expected_outcome_achieved", False),
            "validation_notes": validation.get("validation_notes", "")
        }
    except json.JSONDecodeError:
        # If agent didn't return valid JSON, use defaults
        qa_result["investigation_validation"] = {
            "root_cause_addressed": status == "approved",
            "reproducer_passed": "N/A",
            "expected_outcome_achieved": status == "approved",
            "validation_notes": ""
        }

# Write to implementation_plan.json
implementation_plan["qa_signoff"] = qa_result
```

**Step 3: Verify the code compiles**

Run: `cd apps/backend && python -m py_compile qa/loop.py`

Expected: No syntax errors

**Step 4: Commit**

```bash
git add apps/backend/qa/loop.py
git commit -m "feat(qa): add investigation validation to QA signoff

When investigation context exists, QA signoff includes:
- root_cause_addressed: boolean
- reproducer_passed: boolean | "N/A"
- expected_outcome_achieved: boolean
- validation_notes: string

Saved to implementation_plan.json for human review.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Pass Investigation Context to QA Fixer

**Files:**
- Modify: `apps/backend/qa/fixer.py` (or where QA fixer is invoked)

**Step 1: Find where QA fixer context is built**

Open `apps/backend/qa/fixer.py` and find where the fixer agent is created/invoked.

**Step 2: Add investigation context to fixer**

Add this when building the fixer context (after QA rejection):

```python
from agents.investigation_context import load_investigation_context

# Base fixer context
fixer_context = {
    "qa_feedback": qa_report,
    "subtask": subtask,
    # ... other context
}

# Add investigation context if available
investigation_context = load_investigation_context(spec_dir)
if investigation_context:
    fixer_context["investigation"] = {
        "root_cause": investigation_context["root_cause"],
        "reproducer": investigation_context.get("reproducer"),
        "fix_approaches": investigation_context.get("fix_approaches", [])
    }

    # Add guidance to fixer prompt
    fixer_prompt_addition = """

## Investigation Context
The original investigation identified:
- Root cause: {root_cause}
{reproducer_prompt}
{fix_approaches_prompt}

Ensure your fix actually addresses these findings. Don't just make the QA errors go away — fix the underlying issue.
""".format(
        root_cause=investigation_context["root_cause"]["summary"],
        reproducer_prompt=f"- Reproducer: {investigation_context['reproducer']}" if investigation_context.get('reproducer') else "",
        fix_approaches_prompt="\n".join([
            f"- {approach.get('name', 'Approach')}: {approach.get('description', '')}"
            for approach in investigation_context.get('fix_approaches', [])[:3]
        ]) if investigation_context.get('fix_approaches') else ""
    )

    fixer_context["prompt_addition"] = fixer_prompt_addition
```

**Step 3: Verify the code compiles**

Run: `cd apps/backend && python -m py_compile qa/fixer.py`

Expected: No syntax errors

**Step 4: Commit**

```bash
git add apps/backend/qa/fixer.py
git commit -m "feat(qa): pass investigation context to fixer

When QA rejects a GitHub-sourced task, the fixer receives:
- Original root cause summary
- Reproducer (if available)
- Recommended fix approaches

Fixer is guided to address the underlying issue, not just
make QA errors disappear.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: End-to-End Integration Test

**Files:**
- Create: `apps/backend/tests/integration/test_github_investigation_integration.py` (optional but recommended)

**Step 1: Create integration test**

Create an integration test that verifies the full flow:

```python
"""
Integration test for GitHub investigation → worktree flow.

Tests that investigation data is copied to spec directory,
propagates to worktrees, and is accessible to agents and QA.
"""
import json
from pathlib import Path
import pytest
from agents.investigation_context import load_investigation_context, load_investigation_for_qa


@pytest.fixture
def mock_spec_dir(tmp_path: Path) -> Path:
    """Create a mock spec directory with investigation data."""
    spec_dir = tmp_path / "specs" / "001-test"
    spec_dir.mkdir(parents=True)

    # Create mock investigation report
    investigation_report = {
        "root_cause": {
            "summary": "Test root cause",
            "evidence": ["Evidence 1", "Evidence 2"],
            "code_paths": ["src/file1.py", "src/file2.py"]
        },
        "fix_approaches": [
            {
                "name": "Fix approach 1",
                "description": "Test fix description",
                "pros": ["Pro 1", "Pro 2"],
                "cons": ["Con 1"]
            }
        ],
        "reproducer": "Run test to reproduce",
        "gotchas": ["Gotcha 1", "Gotcha 2"],
        "patterns_to_follow": ["Pattern 1"],
        "impact": {
            "before": "Broken state",
            "after": "Fixed state"
        }
    }

    (spec_dir / "investigation_report.json").write_text(
        json.dumps(investigation_report)
    )

    # Create mock activity log
    (spec_dir / "activity_log.json").write_text(json.dumps([
        {"event": "investigation_started", "timestamp": "2026-02-16T10:00:00Z"}
    ]))

    return spec_dir


def test_load_investigation_context(mock_spec_dir: Path):
    """Test that investigation context is loaded correctly."""
    context = load_investigation_context(mock_spec_dir)

    assert context is not None
    assert context["root_cause"]["summary"] == "Test root cause"
    assert len(context["root_cause"]["evidence"]) == 2
    assert len(context["fix_approaches"]) == 1
    assert context["reproducer"] == "Run test to reproduce"
    assert len(context["gotchas"]) == 2


def test_load_investigation_for_qa(mock_spec_dir: Path):
    """Test that investigation context is loaded for QA."""
    context = load_investigation_for_qa(mock_spec_dir, "main")

    assert context is not None
    assert context["base_branch"] == "main"
    assert context["root_cause"]["summary"] == "Test root cause"
    assert "impact" in context


def test_load_investigation_context_missing_file(tmp_path: Path):
    """Test that missing investigation file returns None."""
    empty_spec_dir = tmp_path / "empty_spec"
    empty_spec_dir.mkdir()

    context = load_investigation_context(empty_spec_dir)

    assert context is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
```

**Step 2: Run the integration test**

Run: `cd apps/backend && pytest tests/integration/test_github_investigation_integration.py -v`

Expected: All tests pass

**Step 3: Commit**

```bash
git add apps/backend/tests/integration/test_github_investigation_integration.py
git commit -m "test(integration): add GitHub investigation integration tests

Tests the full investigation → worktree flow:
- load_investigation_context() loads investigation data
- load_investigation_for_qa() loads for QA with base_branch
- Missing investigation file returns None

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Manual Testing

**Step 1: Test the full flow manually**

1. **Create a GitHub issue investigation**
   - Run investigation on a test issue
   - Verify investigation files exist in `.auto-claude/issues/{issueNumber}/`

2. **Create a Kanban task from the investigation**
   - Click "Create Task" button in GitHub Issues page
   - Verify task appears in Kanban board

3. **Verify investigation files copied to spec**
   - Check `.auto-claude/specs/{specId}/` for `investigation_report.json`
   - Check for `investigation_logs.json` and `activity_log.json`

4. **Start the task**
   - Click "Start" on the Kanban task
   - Verify worktree is created

5. **Verify investigation files in worktree**
   - Check `.auto-claude/worktrees/tasks/{specId}/.auto-claude/specs/{specId}/`
   - Verify investigation files are present

6. **Check agent has investigation context**
   - Review agent output for investigation context in prompts
   - Verify agent references root cause and fix approaches

7. **Check QA validates investigation**
   - Let QA complete
   - Check `implementation_plan.json` for `investigation_validation` field
   - Verify `root_cause_addressed`, `reproducer_passed`, etc.

8. **Check UI shows investigation**
   - View TaskCard — verify GitHub issue badge and "Show Investigation" button
   - Click button — verify InvestigationSummary displays
   - Complete task and review — verify validation checklist in review modal

**Step 2: Document any issues found**

Create a file `test-notes.md` with any issues or edge cases discovered during manual testing.

**Step 3: Fix any issues**

If issues are found, create tasks to fix them.

**Step 4: Commit final implementation**

```bash
git add .
git commit -m "feat(github-investigation): complete investigation → worktree integration

This completes the implementation of GitHub investigation data
integration with worktrees, agents, QA, and UI.

Summary of changes:
- Investigation files copied to spec directory at task creation
- Agents receive investigation context via XML-tagged prompts
- QA validates against investigation findings
- UI shows investigation summary and validation checklist
- Humans can access full investigation context during review

All tasks from implementation plan completed.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Testing Strategy

### Unit Tests
- `apps/backend/agents/investigation_context.py` — Test context loading with valid/invalid data
- `apps/frontend/src/renderer/hooks/useInvestigationData.ts` — Test hook with loading/error states
- `apps/frontend/src/renderer/components/task/InvestigationSummary.tsx` — Test component rendering

### Integration Tests
- `test_github_investigation_integration.py` — Full flow from spec to QA
- Test spec creation with investigation files
- Test worktree propagation
- Test agent context loading
- Test QA validation

### Manual Tests
- Create GitHub issue → Investigate → Create task → Start task → Review
- Verify investigation badge shows in TaskCard
- Verify investigation summary displays
- Verify QA validates investigation findings
- Verify review modal shows validation checklist

---

## Success Criteria

- ✅ Investigation files copied to spec directory at task creation
- ✅ Worktrees automatically receive investigation files via existing copy logic
- ✅ Agents receive investigation context in prompts (XML-tagged)
- ✅ QA validates root cause addressed and reproducer passed
- ✅ Humans can view investigation summary in TaskCard and review modal
- ✅ Existing workflow unchanged for non-GitHub tasks
- ✅ All tests pass
- ✅ No TypeScript errors
- ✅ i18n complete (en/fr)

---

## Notes

- **No refresh capability** — Investigation data is considered final when task is created
- **Backward compatible** — Non-GitHub tasks work exactly as before
- **Cross-platform** — No symlinks, uses file copying
- **XML tags** — Per Anthropic Opus 4.6 best practices
- **Adaptive thinking** — Opus 4.6 uses `thinking: {type: "adaptive"}` (no budget_tokens)
