"""
Split Engine
============

AI-powered issue decomposition: analyzes a single GitHub issue and suggests
how to split it into smaller, well-scoped sub-issues.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

try:
    from ...phase_config import get_model_betas, resolve_model_id
    from ..models import GitHubRunnerConfig
    from .engine_base import EngineBase
    from .prompt_manager import PromptManager
except (ImportError, ValueError, SystemError):
    from models import GitHubRunnerConfig
    from phase_config import get_model_betas, resolve_model_id
    from services.engine_base import EngineBase
    from services.prompt_manager import PromptManager


class SplitEngine(EngineBase):
    """Handles issue split suggestion via AI."""

    def __init__(
        self,
        project_dir: Path,
        github_dir: Path,
        config: GitHubRunnerConfig,
        progress_callback=None,
    ):
        super().__init__(project_dir, github_dir, config, progress_callback)
        self.prompt_manager = PromptManager()

    async def suggest_split(self, issue: dict) -> dict:
        """
        Analyze an issue and suggest how to split it into sub-issues.

        Returns dict matching the frontend SplitSuggestion interface:
        {
            issueNumber, subIssues: [{title, body, labels}], rationale, confidence
        }
        """
        from core.client import create_client

        issue_number = issue["number"]

        self._report_progress(
            "analyzing",
            20,
            f"Analyzing issue #{issue_number} for splitting...",
            issue_number=issue_number,
        )

        context = self._build_split_context(issue)
        prompt = self._get_split_prompt() + "\n\n---\n\n" + context

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
                    "suggesting",
                    80,
                    "Parsing split suggestion...",
                    issue_number=issue_number,
                )

                return self._parse_split_result(issue_number, response_text)

        except Exception as e:
            print(f"Split error for #{issue_number}: {e}")
            return {
                "issueNumber": issue_number,
                "subIssues": [],
                "rationale": f"Analysis failed: {e}",
                "confidence": 0.0,
            }

    def _build_split_context(self, issue: dict) -> str:
        """Build context string for split analysis."""
        labels = ", ".join(label["name"] for label in issue.get("labels", [])) or "None"

        lines = [
            f"## Issue #{issue['number']}",
            f"**Title:** {issue['title']}",
            f"**Author:** {issue.get('author', {}).get('login', 'unknown')}",
            f"**Labels:** {labels}",
            "",
            "### Body",
            issue.get("body", "No description provided.") or "No description provided.",
            "",
        ]

        return "\n".join(lines)

    def _get_split_prompt(self) -> str:
        """Get the split suggestion prompt."""
        prompt_file = self.prompt_manager.prompts_dir / "issue_split.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        return self._get_default_split_prompt()

    @staticmethod
    def _get_default_split_prompt() -> str:
        """Default split suggestion prompt."""
        return """# Issue Split Agent

You are an issue decomposition assistant. Analyze the GitHub issue and suggest
how to break it down into smaller, well-scoped sub-issues.

Guidelines:
- Each sub-issue should be independently implementable
- Sub-issues should have clear scope boundaries
- Aim for 2-5 sub-issues (no more than 8)
- Each sub-issue should have a descriptive title, detailed body, and relevant labels
- The body should reference the parent issue number
- Preserve the original issue's labels where relevant

Output ONLY a JSON block:

```json
{
  "subIssues": [
    {
      "title": "Descriptive sub-issue title",
      "body": "Detailed description of what this sub-issue covers.\\n\\nPart of #PARENT_NUMBER.",
      "labels": ["type:feature", "component:frontend"]
    }
  ],
  "rationale": "Why this issue should be split and how the sub-issues relate",
  "confidence": 0.85
}
```
"""

    @staticmethod
    def _parse_split_result(issue_number: int, response_text: str) -> dict:
        """Parse split suggestion from AI response."""
        default = {
            "issueNumber": issue_number,
            "subIssues": [],
            "rationale": "",
            "confidence": 0.0,
        }

        try:
            json_match = re.search(
                r"```json\s*(\{.*?\})\s*```", response_text, re.DOTALL
            )
            if json_match:
                data = json.loads(json_match.group(1))

                sub_issues = []
                for sub in data.get("subIssues", []):
                    sub_issues.append(
                        {
                            "title": sub.get("title", ""),
                            "body": sub.get("body", ""),
                            "labels": sub.get("labels", []),
                        }
                    )

                return {
                    "issueNumber": issue_number,
                    "subIssues": sub_issues,
                    "rationale": data.get("rationale", ""),
                    "confidence": float(data.get("confidence", 0.5)),
                }
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Failed to parse split result: {e}")

        return default
