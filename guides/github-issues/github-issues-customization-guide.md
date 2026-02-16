# GitHub Issues Customization Guide

> Extend and customize the GitHub Issues integration for your specific needs

**Last updated:** 2026-02-16
**Audience:** Developers extending Auto Claude | **Prerequisites:** [Advanced AI Configuration](github-issues-advanced-ai-configuration.md)

---

## Table of Contents

1. [Overview](#overview)
2. [Prompt System Architecture](#prompt-system-architecture)
3. [Context Injection System](#context-injection-system)
4. [Customizing Agent Prompts](#customizing-agent-prompts)
5. [Context Configuration](#context-configuration)
6. [Adding Custom Specialists](#adding-custom-specialists)
7. [Extending the Integration](#extending-the-integration)
8. [Examples & Recipes](#examples--recipes)

---

## Overview

This guide is for developers who want to extend, customize, or integrate with Auto Claude's GitHub Issues investigation system.

### Who This Guide Is For

- **Auto Claude contributors** adding new features to the GitHub integration
- **Internal teams** customizing investigations for their codebase
- **Integration developers** connecting Auto Claude to other systems
- **Prompt engineers** tuning agent behavior

### What You'll Learn

- How the prompt system works
- How context is built and injected into prompts
- How to modify specialist prompts
- How to add custom investigation specialists
- How to extend the integration with hooks

### Assumptions

- You're comfortable with Python and TypeScript
- You've read the [User Guide](github-issues-user-guide.md) and [Advanced AI Config](github-issues-advanced-ai-configuration.md)
- You're familiar with Auto Claude's architecture (see [CLAUDE.md](../CLAUDE.md))

---

## Prompt System Architecture

### Prompt Location

Investigation prompts are stored in:
```
apps/backend/prompts/github/
├── root_cause_analyzer.md
├── impact_assessor.md
├── fix_advisor.md
└── reproducer.md
```

### Prompt Structure

Each prompt follows this structure:

```markdown
# Role Definition
You are a [specialist name] specializing in [purpose].

# Task
Your task is to [specific task description].

# Context
You will receive:
- Issue details
- Repository context
- Code search results
- [specialist-specific context]

# Instructions
1. [Step 1]
2. [Step 2]
...

# Output Format
[Expected output format, often JSON or structured text]

# Constraints
- [Constraint 1]
- [Constraint 2]
```

### Prompt Variables

Prompts use variable substitution for dynamic content:

| Variable | Purpose | Example |
|----------|---------|---------|
| `{{issue_title}}` | Issue title | "Fix authentication bug" |
| `{{issue_description}}` | Issue body | Full issue description |
| `{{repo_path}}` | Repository path | `/path/to/repo` |
| `{{code_context}}` | Relevant code | File contents, search results |
| `{{specialist_config}}` | Specialist config | Token limits, model settings |

### Template Engine

Auto Claude uses a simple template engine for variable substitution:

**Python (`apps/backend/runners/github/services/prompt_builder.py`):**
```python
def build_prompt(template_path: str, variables: dict) -> str:
    """Build prompt from template with variable substitution."""
    with open(template_path) as f:
        template = f.read()

    for key, value in variables.items():
        template = template.replace(f"{{{{{key}}}}}", str(value))

    return template
```

---

## Context Injection System

### Context Builder

**Location:** `apps/backend/runners/github/context_gatherer.py`

**Purpose:** Builds context for each specialist by:
1. Parsing the issue
2. Searching codebase for relevant files
3. Extracting code snippets
4. Building structured context object

### Context Flow

```
┌──────────────────┐
│  Issue Details   │
│  (from GitHub)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Context Builder │
│  - Parse issue   │
│  - Search code   │
│  - Extract files │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Context Object  │
│  {              │
│    issue: {...}, │
│    repo: {...},  │
│    code: [...]   │
│  }              │
└────────┬─────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
    │  Root   │    │ Impact  │    │   Fix   │    │ Reprod  │
    │  Cause  │    │ Assessor│    │ Advisor │    │  ucer   │
    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### Context Structure

```python
class InvestigationContext:
    """Context passed to each specialist."""

    issue: IssueDetails  # Title, description, comments
    repo: RepositoryContext  # Path, structure, main files
    code: List[CodeSnippet]  # Relevant code files
    specialist_config: SpecialistConfig  # Per-specialist settings

class IssueDetails:
    title: str
    description: str
    comments: List[Comment]
    labels: List[str]
    author: str
    created_at: datetime

class RepositoryContext:
    path: str
    structure: Dict[str, Any]  # Directory tree
    main_files: List[str]  # Key files (package.json, etc.)
    git_info: GitInfo

class CodeSnippet:
    file_path: str
    content: str
    language: str
    relevance_score: float  # How relevant to the issue
```

### Customizing Context

**1. Add Custom Context Sources**

Edit `context_gatherer.py`:

```python
def build_context(issue: Issue, repo_path: str) -> InvestigationContext:
    """Build investigation context."""
    context = InvestigationContext()

    # Standard context
    context.issue = parse_issue(issue)
    context.repo = analyze_repo(repo_path)
    context.code = search_relevant_code(issue, repo_path)

    # Custom context sources
    context.docs = search_documentation(issue, repo_path)
    context.tests = find_related_tests(issue, repo_path)
    context.similar_issues = find_similar_issues(issue)

    return context
```

**2. Filter Code Results**

```python
def search_relevant_code(
    issue: Issue,
    repo_path: str,
    max_files: int = 20
) -> List[CodeSnippet]:
    """Search for code relevant to the issue."""
    results = code_search.search(issue.keywords, repo_path)

    # Filter by relevance
    filtered = [r for r in results if r.relevance_score > 0.7]

    # Limit to top N files
    return sorted(filtered, key=lambda x: x.relevance_score)[:max_files]
```

**3. Add Specialist-Specific Context**

```python
def build_specialist_context(
    specialist: str,
    base_context: InvestigationContext
) -> dict:
    """Add specialist-specific context."""
    context = base_context.dict()

    if specialist == "root_cause":
        context["focus"] = "error_sources"
        context["include_tests"] = True

    elif specialist == "impact":
        context["focus"] = "api_surfaces"
        context["include_dependencies"] = True

    return context
```

---

## Customizing Agent Prompts

### Finding Prompt Files

Prompts are in `apps/backend/prompts/github/`:

```bash
$ ls apps/backend/prompts/github/
root_cause_analyzer.md
impact_assessor.md
fix_advisor.md
reproducer.md
```

### Prompt Variables Reference

| Variable | Type | Description |
|----------|------|-------------|
| `{{issue_title}}` | string | Issue title |
| `{{issue_description}}` | string | Issue body/description |
| `{{issue_comments}}` | list | All issue comments |
| `{{repo_path}}` | string | Absolute path to repository |
| `{{repo_structure}}` | dict | Directory structure |
| `{{code_context}}` | list | Relevant code snippets |
| `{{max_tokens}}` | int | Token limit for this specialist |
| `{{model}}` | string | Model name (e.g., "claude-opus-4-6") |

### Modifying a Prompt

**Example: Enhance Root Cause Analyzer**

Edit `apps/backend/prompts/github/root_cause_analyzer.md`:

```markdown
# Role Definition
You are a Root Cause Analyzer specializing in debugging software issues.

# Task
Your task is to analyze GitHub issues and identify their root causes.

# Context
You will receive:
- Issue: {{issue_title}}
- Description: {{issue_description}}
- Comments: {{issue_comments}}
- Repository: {{repo_path}}
- Code Context: {{code_context}}

# Instructions
1. Read and understand the issue
2. Analyze the provided code context
3. Search for error patterns, bugs, or logical issues
4. Identify the exact location of the root cause
5. Provide file paths and line numbers when possible

# Custom Instructions (Added)
- Prioritize recently modified files
- Check for common patterns:
  - Null/undefined reference errors
  - Race conditions
  - Configuration issues
  - Dependency version conflicts
- Consider edge cases and boundary conditions

# Output Format
Return a JSON object:
{
  "root_cause": "description of root cause",
  "location": "file:line or description",
  "explanation": "detailed explanation",
  "confidence": 0.0-1.0,
  "evidence": ["list of supporting evidence"]
}

# Constraints
- Max tokens: {{max_tokens}}
- Use only the provided context
- If uncertain, state low confidence
```

### Testing Prompt Changes

1. **Save the modified prompt**
2. **Restart Auto Claude** (prompts are loaded at startup)
3. **Run an investigation** on a test issue
4. **Review the output** to verify changes work as expected

### Creating Custom Prompts

**Example: Security-Focused Root Cause Analyzer**

Create `apps/backend/prompts/github/root_cause_security.md`:

```markdown
# Role Definition
You are a Security Specialist analyzing issues for security vulnerabilities.

# Task
Identify security vulnerabilities including:
- SQL injection
- XSS attacks
- Authentication/authorization bypasses
- Sensitive data exposure
- Injection attacks

# Context
[Same as standard root cause analyzer]

# Instructions
1. Prioritize security-relevant code
2. Check for OWASP Top 10 vulnerabilities
3. Analyze authentication and authorization flows
4. Review data handling and sanitization
5. Identify sensitive data exposure

# Output Format
{
  "security_findings": ["list of security issues"],
  "severity": "critical/high/medium/low",
  "cwe_ids": ["list of relevant CWE IDs"],
  "remediation": "security-focused fix recommendations"
}
```

---

## Context Configuration

### File Selection Patterns

Control which files are included in context via `context_gatherer.py`:

```python
# File selection patterns
FILE_PATTERNS = {
    "include": [
        "*.py",
        "*.ts",
        "*.tsx",
        "*.js",
        "*.json",
        "package.json",
        "requirements.txt",
    ],
    "exclude": [
        "*.test.*",
        "*.spec.*",
        "node_modules/**",
        ".venv/**",
        "__pycache__/**",
        "dist/**",
        "build/**",
    ]
}
```

**Customize for Your Project:**

```python
# In your project's .auto-claude/config.json
{
  "context": {
    "include_patterns": [
      "src/**/*.py",
      "apps/backend/**/*.py"
    ],
    "exclude_patterns": [
      "**/test_*.py",
      "**/*.test.ts",
      "node_modules/**"
    ],
    "max_files": 30,
    "max_file_size": 50000  # 50KB
  }
}
```

### Context Window Management

**Token Budgeting:**

```python
def allocate_context_tokens(total_tokens: int) -> dict:
    """Allocate tokens across context sources."""
    return {
        "issue": min(2000, total_tokens * 0.1),
        "code": min(10000, total_tokens * 0.5),
        "repo": min(3000, total_tokens * 0.15),
        "comments": min(2000, total_tokens * 0.1),
        "reserved": total_tokens * 0.15  # For output
    }
```

**Context Pruning:**

```python
def prune_context(context: dict, max_tokens: int) -> dict:
    """Prune context to fit token budget."""
    # Calculate current token count
    current_tokens = count_tokens(context)

    if current_tokens <= max_tokens:
        return context

    # Prune least relevant items
    context["code"] = context["code"][:int(len(context["code"]) * 0.7)]
    context["comments"] = context["comments"][:3]

    return context
```

### Repository Context Settings

**Auto-Discovery:**

```python
def discover_repo_structure(repo_path: str) -> dict:
    """Discover repository structure and key files."""
    return {
        "type": detect_project_type(repo_path),  # python, node, etc.
        "framework": detect_framework(repo_path),  # django, react, etc.
        "main_files": find_main_files(repo_path),
        "entry_points": find_entry_points(repo_path),
        "config_files": find_config_files(repo_path),
    }
```

**Custom Discovery Rules:**

```python
# In .auto-claude/config.json
{
  "repo": {
    "type": "python",
    "main_files": [
      "apps/backend/main.py",
      "apps/backend/cli.py"
    ],
    "entry_points": [
      "apps/backend/api/",
      "apps/backend/agents/"
    ],
    "test_dirs": [
      "tests/",
      "apps/backend/tests/"
    ]
  }
}
```

---

## Adding Custom Specialists

### Specialist Definition

Each specialist is defined in:

**Backend:** `apps/backend/runners/github/services/issue_investigation_orchestrator.py`
**Prompt:** `apps/backend/prompts/github/{specialist_name}.md`

### Step 1: Create the Prompt

Create `apps/backend/prompts/github/performance_analyzer.md`:

```markdown
# Role Definition
You are a Performance Analyst specializing in software performance optimization.

# Task
Analyze GitHub issues for performance problems and provide optimization recommendations.

# Context
[Standard context variables]

# Instructions
1. Identify performance bottlenecks
2. Analyze algorithmic complexity
3. Check for N+1 queries
4. Review caching strategies
5. Suggest optimizations

# Output Format
{
  "performance_issues": ["list of issues"],
  "bottlenecks": ["identified bottlenecks"],
  "optimization_suggestions": [
    {
      "issue": "description",
      "solution": "recommended fix",
      "expected_improvement": "estimate"
    }
  ],
  "complexity_analysis": "algorithmic complexity assessment"
}
```

### Step 2: Register the Specialist

Edit `apps/backend/runners/github/services/issue_investigation_orchestrator.py`:

```python
# Add to SPECIALISTS dictionary
SPECIALISTS = {
    "root_cause": {
        "name": "Root Cause Analyzer",
        "prompt": "prompts/github/root_cause_analyzer.md",
        "max_tokens": 127_999,
    },
    "impact": {
        "name": "Impact Assessor",
        "prompt": "prompts/github/impact_assessor.md",
        "max_tokens": 63_999,
    },
    # ... existing specialists ...

    # New specialist
    "performance": {
        "name": "Performance Analyzer",
        "prompt": "prompts/github/performance_analyzer.md",
        "max_tokens": 63_999,
        "optional": True,  # Not run by default
    }
}
```

### Step 3: Add Runner Logic

```python
async def run_performance_analyzer(
    context: InvestigationContext
) -> dict:
    """Run the Performance Analyzer specialist."""
    prompt = build_prompt(
        "prompts/github/performance_analyzer.md",
        context.dict()
    )

    response = await create_client().messages.create(
        model="claude-opus-4-6",
        max_tokens=context.specialist_config["performance"]["max_tokens"],
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(response.content[0].text)
```

### Step 4: Update Frontend (Optional)

If you want the specialist to appear in the UI:

Edit `apps/frontend/src/renderer/components/github-issues/InvestigationProgress.tsx`:

```typescript
const SPECIALIST_DISPLAY = {
  root_cause: { name: "Root Cause Analyzer", icon: "🔍" },
  impact: { name: "Impact Assessor", icon: "📊" },
  // ... existing specialists ...

  // New specialist
  performance: { name: "Performance Analyzer", icon: "⚡" },
};
```

---

## Extending the Integration

### Hooks

Auto Claude provides hooks for extending the investigation lifecycle:

**Location:** `apps/backend/runners/github/services/hooks.py`

```python
class InvestigationHooks:
    """Hooks for extending investigation workflow."""

    def before_investigation(self, issue: Issue) -> Issue:
        """Called before investigation starts."""
        # Modify issue, add metadata, etc.
        return issue

    def after_specialist(self, specialist: str, result: dict) -> dict:
        """Called after each specialist completes."""
        # Process, transform, or log results
        return result

    def after_investigation(self, report: InvestigationReport) -> InvestigationReport:
        """Called after all specialists complete."""
        # Aggregate, transform, or enhance report
        return report

    def on_task_create(self, report: InvestigationReport, task: Task) -> Task:
        """Called when creating a task from investigation."""
        # Add custom context to task
        return task
```

**Register Hooks:**

```python
# In your project's .auto-claude/hooks.py
from apps.backend.runners.github.services import hooks

@hooks.register
def custom_before_investigation(issue: Issue) -> Issue:
    """Add custom metadata to issues."""
    issue.metadata["team"] = detect_team(issue)
    issue.metadata["priority"] = calculate_priority(issue)
    return issue
```

### Custom Providers

Create custom data providers for investigations:

```python
# In .auto-claude/providers/custom_provider.py
from apps.backend.runners.github.providers import BaseProvider

class CustomDataProvider(BaseProvider):
    """Custom data provider for investigations."""

    def get_context(self, issue: Issue) -> dict:
        """Get custom context for this issue."""
        return {
            "team_context": self.get_team_context(issue),
            "service_dependencies": self.get_dependencies(issue),
            "metrics": self.get_metrics(issue),
        }

    def get_team_context(self, issue: Issue) -> dict:
        """Get team-specific context."""
        # Query your team management system
        pass

    def get_dependencies(self, issue: Issue) -> list:
        """Get service dependencies."""
        # Query your service mesh / dependency graph
        pass
```

**Register Provider:**

```python
# In .auto-claude/config.json
{
  "providers": {
    "custom": ".auto-claude/providers/custom_provider.py::CustomDataProvider"
  }
}
```

### Webhook Integration

Post investigation results to external systems:

```python
# In .auto-claude/webhooks.py
import requests

def post_to_slack(report: InvestigationReport):
    """Post investigation results to Slack."""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")

    message = {
        "text": f"Investigation complete for {report.issue.title}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Root Cause:* {report.root_cause.summary}\n"
                           f"*Impact:* {report.impact.summary}"
                }
            }
        ]
    }

    requests.post(webhook_url, json=message)

# Register as hook
hooks.register("after_investigation", post_to_slack)
```

---

## Examples & Recipes

### Recipe 1: Add Project-Specific Context

**Goal:** Include project documentation in investigations

```python
# In .auto-claude/context_builders.py
def build_project_context(issue: Issue, repo_path: str) -> dict:
    """Build project-specific context."""
    return {
        "docs": search_docs(issue, repo_path),
        "architecture": load_architecture_docs(repo_path),
        "contributing": load_contributing_guide(repo_path),
    }

# Register in hooks.py
@hooks.register("before_investigation")
def add_project_context(issue: Issue) -> Issue:
    issue.context.update(build_project_context(issue, repo_path))
    return issue
```

### Recipe 2: Custom Severity Calculation

**Goal:** Calculate severity based on team-specific rules

```python
# In .auto-claude/severity.py
def calculate_severity(report: InvestigationReport) -> str:
    """Calculate severity based on custom rules."""
    score = 0

    # Impact score
    if report.impact.user_count > 1000:
        score += 3
    elif report.impact.user_count > 100:
        score += 2

    # Component criticality
    if report.impact.component in ["auth", "payment", "api"]:
        score += 3

    # Error type
    if "security" in report.root_cause.tags:
        score += 5

    if score >= 8:
        return "critical"
    elif score >= 5:
        return "high"
    elif score >= 3:
        return "medium"
    else:
        return "low"

# Register in hooks.py
@hooks.register("after_investigation")
def add_severity(report: InvestigationReport) -> InvestigationReport:
    report.severity = calculate_severity(report)
    return report
```

### Recipe 3: Integrate with Issue Tracker

**Goal:** Link investigations to external issue tracker (Jira, Linear)

```python
# In .auto-claude/issue_tracker.py
import requests

def link_to_jira(report: InvestigationReport):
    """Link investigation to Jira ticket."""
    jira_url = os.getenv("JIRA_URL")
    issue_key = extract_jira_key(report.issue.title)

    # Post investigation summary as comment
    comment = f"""
    h2. Auto Claude Investigation

    *Root Cause:* {report.root_cause.summary}
    *Impact:* {report.impact.summary}

    [View Full Investigation|{report.url}]
    """

    requests.post(
        f"{jira_url}/rest/api/2/issue/{issue_key}/comment",
        json={"body": comment},
        auth=(os.getenv("JIRA_USER"), os.getenv("JIRA_TOKEN"))
    )

# Register in hooks.py
hooks.register("after_investigation", link_to_jira)
```

### Recipe 4: Custom Report Formatting

**Goal:** Generate custom report format for your team

```python
# In .auto-claude/reporting.py
def format_custom_report(report: InvestigationReport) -> str:
    """Format investigation report for team consumption."""
    return f"""
# Investigation Report: {report.issue.title}

## Summary
{report.root_cause.summary}

## Root Cause
**Location:** {report.root_cause.location}
**Confidence:** {report.root_cause.confidence:.0%}

{report.root_cause.explanation}

## Impact
**Affected Users:** {report.impact.user_count:,}
**Severity:** {report.severity.upper()}

## Recommended Fix
{report.fix_advisor.recommendation}

## Next Steps
1. Assign to: {suggest_assignee(report)}
2. Estimate: {suggest_estimate(report)}
3. Priority: {suggest_priority(report)}

---
Generated by Auto Claude | {report.generated_at}
"""

# Register in hooks.py
@hooks.register("after_investigation")
def generate_custom_report(report: InvestigationReport) -> InvestigationReport:
    report.custom_format = format_custom_report(report)
    return report
```

---

## Next Steps

You now have everything you need to customize and extend the GitHub Issues integration.

**For contributors:** See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines.

**For architecture:** See [CLAUDE.md](../CLAUDE.md) for system architecture details.

---

**Need help?** Join the [Auto Claude community](https://github.com/AndyMik90/Auto-Claude/discussions) or report issues [on GitHub](https://github.com/AndyMik90/Auto-Claude/issues).
