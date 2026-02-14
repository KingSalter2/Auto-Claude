# Investigation Pipeline Redesign: Two-Phase Execution with Per-Specialist Settings

## Problem

The GitHub Issues investigation pipeline runs all 4 specialist agents (root cause, impact, fix advisor, reproducer) fully in parallel. None of them receive results from the others — they each independently analyze the issue from scratch.

This causes two problems:

1. **Root cause analysis is too shallow** — it finishes quickly without digging deep enough because it uses a hardcoded thinking budget multiplier rather than a user-configurable model and thinking level.
2. **Downstream agents produce weak results** — the fix advisor suggests fixes without knowing the root cause, and the impact assessor estimates blast radius without knowing what's actually broken.

## Solution

### Two-Phase Execution

Split the 4 agents into two sequential phases:

```
Phase 1 (parallel):  Root Cause Agent + Reproducer Agent
Phase 2 (parallel):  Impact Agent + Fix Advisor Agent
                     (both receive root cause output in their prompts)
```

Phase 2 agents wait for Phase 1 to complete, then receive the root cause structured output injected into their prompts. This gives them concrete code locations, evidence, and confidence levels to work with.

The Reproducer Agent runs alongside root cause in Phase 1 because reproduction steps and test coverage assessment are independent of root cause findings.

### Per-Specialist Agent Settings

Replace the single `featureModels.githubIssues` / `featureThinking.githubIssues` setting with per-specialist configuration, following the same pattern as the task pipeline's per-phase config.

New types:

```typescript
interface InvestigationModelConfig {
  rootCause: ModelTypeShort;
  impact: ModelTypeShort;
  fixAdvisor: ModelTypeShort;
  reproducer: ModelTypeShort;
}

interface InvestigationThinkingConfig {
  rootCause: ThinkingLevel;
  impact: ThinkingLevel;
  fixAdvisor: ThinkingLevel;
  reproducer: ThinkingLevel;
}
```

Defaults:

| Specialist | Model | Thinking |
|---|---|---|
| Root Cause Agent | opus | high |
| Impact Agent | sonnet | medium |
| Fix Advisor Agent | sonnet | medium |
| Reproducer Agent | sonnet | low |

No hardcoded thinking budget multipliers or max turn limits. Each agent gets its configured model and thinking level, and is free to work within those parameters.

### Settings UI

In App Settings > General > Feature Model Configuration, the single "GitHub Issues" row is replaced with 4 specialist rows under the "GitHub Issues" heading:

```
GitHub Issues                         Issue investigation agents
  Root Cause Agent      [Opus ▾]     [High ▾]
  Impact Agent          [Sonnet ▾]   [Medium ▾]
  Fix Advisor Agent     [Sonnet ▾]   [Medium ▾]
  Reproducer Agent      [Sonnet ▾]   [Low ▾]
```

Always visible (no collapsible dropdown). Same visual treatment as other feature model rows but with indented sub-rows.

### Root Cause Prompt Enhancement

Add depth requirements to `investigation_root_cause.md`:

- Must trace at least 3 levels deep in the call chain before concluding
- Must explore at least 2 competing hypotheses before settling on a root cause
- Must not conclude with medium/low confidence if unexplored code paths remain
- If the issue mentions UI behavior, trace from React component through store, IPC, and backend
- If likely cause is found early, keep investigating to verify

### Context Injection for Phase 2

After Phase 1, the root cause structured output is serialized and appended to Phase 2 agent prompts:

```python
if root_cause_result:
    prompt += f"""
## Root Cause Analysis (from prior investigation)

{root_cause_result.identified_root_cause}

**Code paths:** {root_cause_result.code_paths}
**Confidence:** {root_cause_result.confidence}
**Evidence:** {root_cause_result.evidence}

Use this root cause analysis to inform your assessment. Do NOT re-investigate
the root cause — focus on your specialty using these findings as ground truth.
"""
```

### Progress Reporting

Two-phase progress:

| Progress | Event |
|---|---|
| 10% | Starting investigation |
| 20% | Launching Phase 1 (Root Cause Agent + Reproducer Agent) |
| 35% | Reproducer Agent complete |
| 50% | Root Cause Agent complete |
| 55% | Launching Phase 2 with root cause context |
| 65% | First Phase 2 agent complete |
| 80% | Second Phase 2 agent complete |
| 100% | Report built |

Frontend needs no structural changes — it already tracks per-agent events independently. Phase 2 agent `agent_started` events simply arrive later.

## Files Changed

### Frontend

| File | Change |
|---|---|
| `src/shared/types/settings.ts` | Add `InvestigationModelConfig`, `InvestigationThinkingConfig`, add fields to `AppSettings` |
| `src/shared/constants/models.ts` | Add defaults, specialist keys, labels |
| `src/renderer/components/settings/GeneralSettings.tsx` | Replace single githubIssues row with 4 specialist rows |
| `src/main/ipc-handlers/github/investigation-handlers.ts` | `getGitHubIssuesSettings()` reads per-specialist config, passes as `--specialist-config` JSON CLI arg |
| `src/shared/i18n/locales/en/settings.json` | Add specialist label keys |
| `src/shared/i18n/locales/fr/settings.json` | Add specialist label keys |

### Backend

| File | Change |
|---|---|
| `runners/github/runner.py` | Add `--specialist-config` argparse, parse JSON, pass to config |
| `runners/github/services/issue_investigation_orchestrator.py` | Two-phase execution, per-specialist model/thinking, root cause context injection |
| `runners/github/services/parallel_agent_base.py` | Remove `thinking_budget_multiplier` from `SpecialistConfig` |
| `prompts/github/investigation_root_cause.md` | Add depth requirements section |
| `prompts/github/investigation_impact.md` | Add instruction to leverage root cause context |
| `prompts/github/investigation_fix_advice.md` | Add instruction to leverage root cause context |

## Code Removed

| What | Where | Why |
|---|---|---|
| `thinking_budget_multiplier` field | `SpecialistConfig` in `parallel_agent_base.py` | Replaced by per-specialist thinking level |
| `_effective_budget` calculation | `_make_specialist_factory()` in orchestrator | No longer needed |
| Single `model` param | `_run_investigation_specialists()` | Replaced by per-specialist config |
| Single `thinking_budget` param | `_run_investigation_specialists()` | Replaced by per-specialist config |
| ~~`featureModels.githubIssues`~~ | ~~`FeatureModelConfig`~~ | **NOT removed** — still used by triage/enrich/split handlers. `investigationModels` is additive. |
| ~~`featureThinking.githubIssues`~~ | ~~`FeatureThinkingConfig`~~ | **NOT removed** — still used by triage handlers. `investigationThinking` is additive. |

## Unchanged (No Breakage)

- `InvestigationReport` and all Pydantic schemas
- `_build_report()`, `_parse_specialist_result()`, `_generate_summary()`
- Frontend investigation store, IPC channels, progress/complete/error flow
- `InvestigationSettings.tsx` (project-level settings)
- Resume support (`--resume-sessions`)
- Log collection, `agent_started`/`agent_done` events
- `transformPythonReport()` result parsing
- `_run_parallel_specialists()` base class method (reused twice, once per phase)

## Settings Flow

```
GeneralSettings UI (4 specialist rows)
        ↓
settings-store → IPC SETTINGS_SAVE → settings.json
        ↓ (on investigation start)
investigation-handlers.ts reads investigationModels + investigationThinking
        ↓
CLI: --specialist-config '{"root_cause":{"model":"opus","thinking":"high"},...}'
        ↓
runner.py parses JSON → GitHubRunnerConfig.specialist_config
        ↓
IssueInvestigationOrchestrator.investigate()
        ↓
Phase 1: create_client(model=opus, thinking=high)   ← Root Cause Agent
         create_client(model=sonnet, thinking=low)   ← Reproducer Agent
        ↓ (root cause result)
Phase 2: create_client(model=sonnet, thinking=medium) ← Impact Agent (+ root cause context)
         create_client(model=sonnet, thinking=medium) ← Fix Advisor Agent (+ root cause context)
```

## Migration

No migration needed. `featureModels.githubIssues` and `featureThinking.githubIssues` remain in place for triage/enrich/split handlers. The new `investigationModels`/`investigationThinking` keys are additive — they read with sensible defaults if the new keys aren't present in settings.
