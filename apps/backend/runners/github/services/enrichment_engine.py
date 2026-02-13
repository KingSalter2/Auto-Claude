"""
Enrichment Engine
=================

Deep analysis of a single GitHub issue to extract structured enrichment data:
problem statement, goal, scope, acceptance criteria, technical context, and risks.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

try:
    from ...phase_config import get_model_betas, resolve_model_id
    from ..models import GitHubRunnerConfig
    from .prompt_manager import PromptManager
except (ImportError, ValueError, SystemError):
    from models import GitHubRunnerConfig
    from phase_config import get_model_betas, resolve_model_id
    from services.prompt_manager import PromptManager


class EnrichmentEngine:
    """Handles single-issue deep enrichment via AI."""

    def __init__(
        self,
        project_dir: Path,
        github_dir: Path,
        config: GitHubRunnerConfig,
        progress_callback=None,
    ):
        self.project_dir = Path(project_dir)
        self.github_dir = Path(github_dir)
        self.config = config
        self.progress_callback = progress_callback
        self.prompt_manager = PromptManager()

    def _report_progress(self, phase: str, progress: int, message: str, **kwargs):
        """Report progress if callback is set."""
        if self.progress_callback:
            import sys

            if "orchestrator" in sys.modules:
                ProgressCallback = sys.modules["orchestrator"].ProgressCallback
            else:
                try:
                    from ..orchestrator import ProgressCallback
                except ImportError:
                    from orchestrator import ProgressCallback

            self.progress_callback(
                ProgressCallback(
                    phase=phase, progress=progress, message=message, **kwargs
                )
            )

    async def enrich_single_issue(self, issue: dict) -> dict:
        """
        Perform deep AI enrichment on a single issue.

        Returns dict matching the frontend AIEnrichmentResult interface:
        {
            issueNumber, problem, goal, scopeIn, scopeOut,
            acceptanceCriteria, technicalContext, risksEdgeCases, confidence
        }
        """
        from core.client import create_client

        issue_number = issue["number"]

        self._report_progress(
            "analyzing",
            20,
            f"Analyzing issue #{issue_number}...",
            issue_number=issue_number,
        )

        context = self._build_enrichment_context(issue)
        prompt = self._get_enrichment_prompt() + "\n\n---\n\n" + context

        model_shorthand = self.config.model or "sonnet"
        model = resolve_model_id(model_shorthand)
        betas = get_model_betas(model_shorthand)
        client = create_client(
            project_dir=self.project_dir,
            spec_dir=self.github_dir,
            model=model,
            agent_type="qa_reviewer",
            betas=betas,
            fast_mode=self.config.fast_mode,
        )

        try:
            async with client:
                await client.query(prompt)

                response_text = ""
                async for msg in client.receive_response():
                    msg_type = type(msg).__name__
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                response_text += block.text

                self._report_progress(
                    "generating",
                    80,
                    "Parsing enrichment result...",
                    issue_number=issue_number,
                )

                return self._parse_enrichment_result(issue_number, response_text)

        except Exception as e:
            print(f"Enrichment error for #{issue_number}: {e}")
            return {
                "issueNumber": issue_number,
                "problem": "",
                "goal": "",
                "scopeIn": [],
                "scopeOut": [],
                "acceptanceCriteria": [],
                "technicalContext": "",
                "risksEdgeCases": [],
                "confidence": 0.0,
            }

    def _build_enrichment_context(self, issue: dict) -> str:
        """Build context string for enrichment analysis."""
        labels = ", ".join(label["name"] for label in issue.get("labels", [])) or "None"

        comments_text = ""
        comments = issue.get("comments", {})
        nodes = comments.get("nodes", []) if isinstance(comments, dict) else []
        if nodes:
            comment_lines = []
            for c in nodes[:10]:
                author = c.get("author", {}).get("login", "unknown")
                body = c.get("body", "")[:500]
                comment_lines.append(f"**{author}:** {body}")
            comments_text = "\n".join(comment_lines)

        lines = [
            f"## Issue #{issue['number']}",
            f"**Title:** {issue['title']}",
            f"**Author:** {issue.get('author', {}).get('login', 'unknown')}",
            f"**State:** {issue.get('state', 'OPEN')}",
            f"**Created:** {issue.get('createdAt', 'unknown')}",
            f"**Labels:** {labels}",
            "",
            "### Body",
            issue.get("body", "No description provided.") or "No description provided.",
            "",
        ]

        if comments_text:
            lines.extend(["### Comments", comments_text, ""])

        return "\n".join(lines)

    def _get_enrichment_prompt(self) -> str:
        """Get the enrichment analysis prompt."""
        prompt_file = self.prompt_manager.prompts_dir / "issue_enrichment.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        return self._get_default_enrichment_prompt()

    @staticmethod
    def _get_default_enrichment_prompt() -> str:
        """Default enrichment prompt."""
        return """# Issue Enrichment Agent

You are an issue enrichment assistant. Perform a deep analysis of the GitHub issue
and extract structured information to help developers understand and implement it.

Analyze the issue and produce:

1. **Problem**: A clear, concise statement of the problem or need being described.
2. **Goal**: What the desired outcome is — what should be true when the issue is resolved.
3. **Scope In**: A list of things that ARE in scope for this issue.
4. **Scope Out**: A list of things that are explicitly NOT in scope.
5. **Acceptance Criteria**: Specific, testable criteria for considering the issue done.
6. **Technical Context**: Relevant technical details, architecture notes, or constraints.
7. **Risks & Edge Cases**: Potential risks, edge cases, or gotchas to watch out for.
8. **Confidence**: How confident you are in the analysis (0.0 to 1.0). Lower if the issue
   is vague, missing details, or contradictory.

Output ONLY a JSON block:

```json
{
  "problem": "Clear problem statement",
  "goal": "Desired outcome",
  "scopeIn": ["Item 1", "Item 2"],
  "scopeOut": ["Item 1"],
  "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
  "technicalContext": "Technical details and constraints",
  "risksEdgeCases": ["Risk 1", "Edge case 1"],
  "confidence": 0.85
}
```
"""

    @staticmethod
    def _parse_enrichment_result(issue_number: int, response_text: str) -> dict:
        """Parse enrichment result from AI response."""
        default = {
            "issueNumber": issue_number,
            "problem": "",
            "goal": "",
            "scopeIn": [],
            "scopeOut": [],
            "acceptanceCriteria": [],
            "technicalContext": "",
            "risksEdgeCases": [],
            "confidence": 0.0,
        }

        try:
            json_match = re.search(
                r"```json\s*(\{.*?\})\s*```", response_text, re.DOTALL
            )
            if json_match:
                data = json.loads(json_match.group(1))
                return {
                    "issueNumber": issue_number,
                    "problem": data.get("problem", ""),
                    "goal": data.get("goal", ""),
                    "scopeIn": data.get("scopeIn", []),
                    "scopeOut": data.get("scopeOut", []),
                    "acceptanceCriteria": data.get("acceptanceCriteria", []),
                    "technicalContext": data.get("technicalContext", ""),
                    "risksEdgeCases": data.get("risksEdgeCases", []),
                    "confidence": float(data.get("confidence", 0.5)),
                }
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Failed to parse enrichment result: {e}")

        return default
