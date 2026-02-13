"""
Observer security module for redacting sensitive information.

Provides regex-based filtering to prevent secrets, API keys, passwords,
tokens, and connection strings from being stored in observations.
"""

import re

# Compiled patterns for secret detection, ordered by specificity
_SECRET_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # API keys with known prefixes
    (re.compile(r"\bsk-[A-Za-z0-9_-]{3,}\b"), "[REDACTED]"),
    (re.compile(r"\bsk-proj-[A-Za-z0-9_-]{3,}\b"), "[REDACTED]"),
    (re.compile(r"\bxoxb-[A-Za-z0-9-]+"), "[REDACTED]"),
    (re.compile(r"\bxoxp-[A-Za-z0-9-]+"), "[REDACTED]"),
    (re.compile(r"\bxoxa-[A-Za-z0-9-]+"), "[REDACTED]"),
    (re.compile(r"\bghp_[A-Za-z0-9]{36,}\b"), "[REDACTED]"),
    (re.compile(r"\bgho_[A-Za-z0-9]{36,}\b"), "[REDACTED]"),
    (re.compile(r"\bghs_[A-Za-z0-9]{36,}\b"), "[REDACTED]"),
    (re.compile(r"\bghu_[A-Za-z0-9]{36,}\b"), "[REDACTED]"),
    (re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b"), "[REDACTED]"),
    # AWS keys
    (re.compile(r"\bAKIA[A-Z0-9]{16}\b"), "[REDACTED]"),
    (re.compile(r"\bASIA[A-Z0-9]{16}\b"), "[REDACTED]"),
    # Bearer tokens
    (re.compile(r"(Bearer\s+)[A-Za-z0-9_.~+/=-]+", re.IGNORECASE), r"\1[REDACTED]"),
    # Connection strings
    (
        re.compile(
            r"(postgres(?:ql)?|mysql|redis|mongodb|amqp|mssql)://"
            r"[^\s\"'`<>]+",
            re.IGNORECASE,
        ),
        r"\1://[REDACTED]",
    ),
    # Key=value patterns for secrets
    (
        re.compile(
            r"((?:password|passwd|pwd|secret|token|access_token|refresh_token"
            r"|api_key|apikey|secret_key|private_key|auth_token|client_secret)"
            r"\s*[=:]\s*)[\"']?([^\s\"',;}{]+)[\"']?",
            re.IGNORECASE,
        ),
        r"\1[REDACTED]",
    ),
    # Generic long hex/base64 tokens (40+ chars, likely secrets)
    (re.compile(r"\b[A-Fa-f0-9]{40,}\b"), "[REDACTED]"),
]


def redact_secrets(content: str) -> str:
    """Redact sensitive information from content.

    Applies regex-based filtering to replace API keys, passwords, tokens,
    connection strings, and other secrets with [REDACTED].

    Args:
        content: The string content to redact.

    Returns:
        The content with sensitive values replaced by [REDACTED].
    """
    if not content:
        return content

    result = content
    for pattern, replacement in _SECRET_PATTERNS:
        result = pattern.sub(replacement, result)

    return result
