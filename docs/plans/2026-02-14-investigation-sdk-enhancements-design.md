# Investigation SDK Enhancements Design

Date: 2026-02-14
Branch: feat/issues
Approach: Incremental SDK integration (Approach A)

## Overview

Enhance the GitHub issue investigation system by layering Claude Agent SDK features into the existing `ParallelAgentOrchestrator` architecture. Each enhancement is independent and shippable on its own.

Goals:
- Better investigation quality (deeper root cause analysis, thinking visibility)
- Cost and scope control (max_turns, model/thinking from settings)
- Richer progress UX (structured events via hooks, replace stdout parsing)
- New capabilities (controlled Bash access, resumable sessions)

## 1. Controlled Bash Access via PreToolUse Hooks

**Problem:** Investigation specialists only have Read/Grep/Glob. They can't run tests, check git history, or inspect dependencies.

**Solution:** Add `"Bash"` to specialist tool lists, gated by a `PreToolUse` hook with an investigation-specific allowlist.

### Allowlisted commands

- `git log`, `git show`, `git blame`, `git diff`, `git status` -- code history
- `pytest`, `npm test`, `vitest`, `cargo test` -- test runners (read-only validation)
- `pip list`, `npm ls`, `node -v`, `python --version` -- dependency inspection
- `ls`, `find`, `wc` -- filesystem exploration beyond Read/Grep

### Blocked commands

- Any write operation: `git commit`, `git push`, `rm`, `mv`, `cp`, `echo >`, editors
- Package install: `pip install`, `npm install`, `apt`, `brew`
- Shell control: `sudo`, `su`, `chmod`, `chown`

### Implementation

New file: `apps/backend/runners/github/services/investigation_hooks.py`

```python
INVESTIGATION_BASH_ALLOWLIST = [
    "git log", "git show", "git blame", "git diff", "git status",
    "pytest", "npm test", "vitest", "cargo test",
    "pip list", "npm ls", "node -v", "python --version",
    "ls", "find", "wc",
]

async def investigation_bash_guard(input_data, tool_use_id, context):
    """PreToolUse hook: validate Bash commands for investigation safety."""
    command = input_data.get("tool_input", {}).get("command", "")
    if not any(command.strip().startswith(allowed) for allowed in INVESTIGATION_BASH_ALLOWLIST):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Command not allowed during investigation: {command[:100]}"
            }
        }
    return {}
```

In `parallel_agent_base.py._run_specialist_session()`:

```python
if "Bash" in config.tools:
    client_kwargs["hooks"] = {
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[investigation_bash_guard])]
    }
```

### Files affected

- `apps/backend/runners/github/services/investigation_hooks.py` (new)
- `apps/backend/runners/github/services/issue_investigation_orchestrator.py` (add Bash to tools)
- `apps/backend/runners/github/services/parallel_agent_base.py` (wire hooks)

## 2. Cost & Scope Controls

**Problem:** No max_turns or budget limits. Specialists run until output or the 500-message circuit breaker.

### max_turns per specialist

Add `max_turns` field to `SpecialistConfig`:

| Specialist | max_turns | Rationale |
|---|---|---|
| root_cause | 40 | Deep: search, read, follow call chains |
| impact | 25 | Moderate: component scanning |
| fix_advisor | 30 | Read patterns and examples |
| reproducer | 35 | Find tests, check coverage |

Passed through `_run_specialist_session()` to `process_sdk_stream(max_messages=...)`.

### Model/thinking from settings

The existing `featureModels.githubIssues` and `featureThinking.githubIssues` settings are already read by `getGitHubIssuesSettings()` in the frontend and passed to the subprocess. The backend uses `resolve_model_id()` and `get_thinking_budget()`.

Gap: ensure the settings UI exposes the `githubIssues` entry in feature model/thinking dropdowns (if not already present).

### Files affected

- `apps/backend/runners/github/services/parallel_agent_base.py` (SpecialistConfig.max_turns)
- `apps/backend/runners/github/services/issue_investigation_orchestrator.py` (set per-specialist values)
- Frontend settings component (wire githubIssues model/thinking if missing)

## 3. Structured Progress via SDK Hooks

**Problem:** Progress flows via stdout prefix parsing (`[Investigation:root_cause] ...`). Fragile regex, no typing, no thinking visibility.

**Solution:** Add SDK hooks that emit structured JSON events to stdout alongside existing text lines. Frontend parses both formats.

### Event protocol

JSON events emitted to stdout (one per line):

```json
{"event":"tool_start","agent":"root_cause","tool":"Read","detail":"Reading auth.py","ts":"2026-02-14T10:30:00Z"}
{"event":"tool_end","agent":"root_cause","tool":"Read","success":true,"ts":"2026-02-14T10:30:01Z"}
{"event":"thinking","agent":"root_cause","chars":4200,"preview":"The issue traces back to...","ts":"2026-02-14T10:30:02Z"}
```

### Hook implementation

In `_run_specialist_session()`, pass callbacks to `process_sdk_stream`:

```python
stream_result = await process_sdk_stream(
    client=client,
    on_thinking=lambda text: emit_json_event("thinking", config.name, chars=len(text), preview=text[:200]),
    on_tool_use=lambda name, tid, inp: emit_json_event("tool_start", config.name, tool=name, detail=_get_tool_detail(name, inp)),
    on_tool_result=lambda tid, err, _: emit_json_event("tool_end", config.name, success=not err),
    ...
)
```

### Frontend changes

- `parseInvestigationLogLine()`: if line starts with `{`, try JSON.parse, map to existing entry types
- `InvestigationLogEntry` type: add optional `toolName`, `thinkingPreview`, `isStructured` fields
- Live log panel: show "Thinking (4,200 chars)..." and tool details

### Files affected

- `apps/backend/runners/github/services/parallel_agent_base.py` (emit functions)
- `apps/backend/runners/github/services/sdk_utils.py` (callbacks already exist, wire them)
- `apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts` (JSON parser)
- `apps/frontend/src/shared/types/` (InvestigationLogEntry extension)
- Frontend log panel component (render enriched entries)

## 4. Resumable Sessions

**Problem:** Interrupted investigations re-run from scratch. Context from partial investigations is lost.

**Solution:** Save SDK session IDs per specialist. On resume, pass `resume=session_id` to recreate the session with prior context.

### Session persistence

After `client.query()`, capture session ID:

```python
session_id = getattr(client, 'session_id', None)
```

Save to `investigation_state.json`:

```json
{
  "issue_number": 42,
  "status": "investigating",
  "sessions": {
    "root_cause": "session-abc123",
    "impact": "session-def456",
    "fix_advisor": null,
    "reproducer": null
  }
}
```

### Resume flow

1. App restarts, detects interrupted investigation (status = "investigating")
2. Reads session IDs from investigation_state.json
3. Passes session IDs to subprocess via CLI args or env vars
4. Backend passes `resume=session_id` to `create_client()` for specialists with saved sessions
5. Specialists without sessions run fresh
6. If resume fails (session expired, CLI updated), gracefully fall back to fresh run

### Fallback

SDK session resume requires the same Claude Code CLI instance. If resume fails, catch the error and restart from scratch with a log message.

### Files affected

- `apps/backend/runners/github/services/parallel_agent_base.py` (resume_session_id param)
- `apps/backend/runners/github/services/issue_investigation_orchestrator.py` (save/read sessions)
- `apps/backend/runners/github/services/investigation_persistence.py` (session fields)
- `apps/frontend/src/main/ipc-handlers/github/investigation-handlers.ts` (pass session IDs)

## 5. Investigation Quality: Extended Thinking

**Problem:** All specialists get the same thinking budget. Root cause analysis benefits most from deeper reasoning.

### Per-specialist thinking multiplier

Add `thinking_budget_multiplier` to `SpecialistConfig`:

| Specialist | Multiplier | Effective budget (medium=4096) |
|---|---|---|
| root_cause | 1.5x | 6144 |
| impact | 1.0x | 4096 |
| fix_advisor | 1.0x | 4096 |
| reproducer | 1.0x | 4096 |

Applied in `_run_investigation_specialists()`:

```python
effective_budget = int(thinking_budget * config.thinking_budget_multiplier)
```

### Thinking preview in UI

The `on_thinking` callback (from Section 3) emits a preview of thinking content. The frontend log panel renders this as a collapsible "Thinking..." entry with the preview text.

### Files affected

- `apps/backend/runners/github/services/parallel_agent_base.py` (SpecialistConfig field)
- `apps/backend/runners/github/services/issue_investigation_orchestrator.py` (set multipliers)

## Out of Scope (Future)

- **MCP servers** (Context7, Puppeteer) for extended tool capabilities per specialist
- **Per-specialist model overrides** (e.g., Haiku for impact, Opus for root cause)
- **File checkpointing** for try-and-verify fix patterns
- **Two-phase investigation** (quick triage then deep-dive on same session)
- **Cross-issue deduplication** via Graphiti memory integration

## Dependency Order

1. **SpecialistConfig extensions** (max_turns, thinking_multiplier) -- no dependencies
2. **Investigation hooks module** -- no dependencies
3. **Bash access** -- depends on (2)
4. **Structured progress events** -- depends on (2), frontend type changes
5. **Resumable sessions** -- depends on persistence changes, frontend CLI arg passing
6. **Settings UI wiring** -- independent frontend task

Items 1-3 can ship together. Item 4 can ship independently. Item 5 requires more integration testing.
