"""Tests for observer.security — redact_secrets() function.

Covers:
- API keys: OpenAI (sk-proj-), GitHub (ghp_, gho_, ghs_, ghu_), Slack (xoxb-, xoxp-), GitLab (glpat-)
- AWS keys (AKIA..., ASIA...)
- Passwords in various formats (password=, PASSWORD=', passwd:)
- OAuth/Bearer tokens (Bearer eyJ..., token=abc)
- Connection strings (postgres://, redis://, mongodb://)
- Generic key=value patterns (API_KEY=, SECRET_KEY=, PRIVATE_KEY=)
- Edge cases: empty string, no secrets, normal text, multi-line
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "apps" / "backend"))

import pytest

from observer.security import redact_secrets


class TestOpenAIKeys:
    """Test redaction of OpenAI API keys."""

    def test_sk_proj_key(self):
        """OpenAI project keys (sk-proj-...) are redacted."""
        assert "[REDACTED]" in redact_secrets("key is sk-proj-abc123def456")

    def test_sk_key(self):
        """Generic OpenAI keys (sk-...) are redacted."""
        assert "[REDACTED]" in redact_secrets("sk-abcdef123456")


class TestGitHubTokens:
    """Test redaction of GitHub tokens."""

    @pytest.mark.parametrize(
        "prefix",
        ["ghp_", "gho_", "ghs_", "ghu_"],
    )
    def test_github_token_prefixes(self, prefix):
        """GitHub tokens with various prefixes are redacted."""
        token = prefix + "A" * 36
        result = redact_secrets(f"token={token}")
        assert token not in result
        assert "[REDACTED]" in result


class TestSlackTokens:
    """Test redaction of Slack tokens."""

    @pytest.mark.parametrize("prefix", ["xoxb-", "xoxp-", "xoxa-"])
    def test_slack_tokens(self, prefix):
        """Slack tokens are redacted."""
        token = prefix + "123-456-789"
        result = redact_secrets(f"SLACK_TOKEN={token}")
        assert token not in result


class TestAWSKeys:
    """Test redaction of AWS access keys."""

    def test_akia_key(self):
        """AWS AKIA keys are redacted."""
        result = redact_secrets("aws_key=AKIAIOSFODNN7EXAMPLE")
        assert "AKIAIOSFODNN7EXAMPLE" not in result

    def test_asia_key(self):
        """AWS ASIA (temporary) keys are redacted."""
        result = redact_secrets("ASIAIOSFODNN7EXAMPLE")
        assert "ASIAIOSFODNN7EXAMPLE" not in result


class TestPasswords:
    """Test redaction of passwords in various formats."""

    def test_password_equals(self):
        """password=value format is redacted."""
        result = redact_secrets("password=mysecretpass")
        assert "mysecretpass" not in result

    def test_password_quoted(self):
        """PASSWORD='value' format is redacted."""
        result = redact_secrets("PASSWORD='mysecretpass'")
        assert "mysecretpass" not in result

    def test_passwd_colon(self):
        """passwd: value format is redacted."""
        result = redact_secrets("passwd: secretvalue")
        assert "secretvalue" not in result

    def test_pwd_equals(self):
        """pwd=value format is redacted."""
        result = redact_secrets("pwd=abc123")
        assert "abc123" not in result


class TestOAuthTokens:
    """Test redaction of OAuth and Bearer tokens."""

    def test_bearer_jwt(self):
        """Bearer JWT tokens are redacted."""
        result = redact_secrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig")
        assert "eyJ" not in result
        assert "Bearer" in result

    def test_token_equals(self):
        """token=value format is redacted."""
        result = redact_secrets("token=abc123secret")
        assert "abc123secret" not in result

    def test_access_token(self):
        """access_token=value is redacted."""
        result = redact_secrets("access_token=mytoken123")
        assert "mytoken123" not in result


class TestConnectionStrings:
    """Test redaction of database connection strings."""

    def test_postgres_url(self):
        """postgres://user:pass@host is redacted."""
        result = redact_secrets("DATABASE_URL=postgres://admin:s3cret@db.host:5432/mydb")
        assert "s3cret" not in result
        assert "postgres://" in result

    def test_redis_url(self):
        """redis://pass@host is redacted."""
        result = redact_secrets("REDIS_URL=redis://secret@redis.host:6379")
        assert "secret@" not in result

    def test_mongodb_url(self):
        """mongodb:// connection strings are redacted."""
        result = redact_secrets("mongodb://user:pass@mongo.host/db")
        assert "pass@" not in result


class TestGenericKeyValuePatterns:
    """Test redaction of generic secret key=value patterns."""

    def test_api_key(self):
        """API_KEY=value is redacted."""
        result = redact_secrets("api_key=sk_live_12345")
        assert "sk_live_12345" not in result

    def test_secret_key(self):
        """SECRET_KEY=value is redacted."""
        result = redact_secrets("secret_key=verysecretvalue")
        assert "verysecretvalue" not in result

    def test_private_key(self):
        """PRIVATE_KEY=value is redacted."""
        result = redact_secrets("private_key=keydata123")
        assert "keydata123" not in result

    def test_client_secret(self):
        """client_secret=value is redacted."""
        result = redact_secrets("client_secret=mysecret")
        assert "mysecret" not in result


class TestEdgeCases:
    """Test edge cases and normal text preservation."""

    def test_empty_string(self):
        """Empty string returns empty string."""
        assert redact_secrets("") == ""

    def test_no_secrets(self):
        """String with no secrets is unchanged."""
        text = "This is a normal log message with no secrets."
        assert redact_secrets(text) == text

    def test_normal_text_preserved(self):
        """Normal words and structure are preserved around redactions."""
        result = redact_secrets("Connecting to database... password=secret123 done.")
        assert "Connecting to database..." in result
        assert "done." in result
        assert "secret123" not in result

    def test_multiline_content(self):
        """Multi-line content has secrets redacted across all lines."""
        content = (
            "Line 1: normal text\n"
            "Line 2: password=secret\n"
            "Line 3: also normal\n"
            "Line 4: token=abc123\n"
        )
        result = redact_secrets(content)
        assert "Line 1: normal text" in result
        assert "also normal" in result
        assert "secret" not in result.split("\n")[1]
        assert "abc123" not in result

    def test_none_like_empty(self):
        """None-ish empty content returns as-is."""
        assert redact_secrets("") == ""
