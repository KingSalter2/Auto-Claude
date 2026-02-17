"""Integration test for image support in issue investigations.

Tests verify:
1. extract_image_urls function extracts URLs from markdown and HTML
2. _build_issue_context includes image URLs in the issue context
3. Image limit of 20 is enforced
4. Images from comments are included

These tests execute actual code, not static analysis.
"""
import re
from pathlib import Path
import pytest


# =============================================================================
# Direct code execution to avoid complex import issues
# =============================================================================

_SOURCE_FILE = Path(__file__).parent.parent.parent / "runners" / "github" / "services" / "issue_investigation_orchestrator.py"


def _load_extract_image_urls():
    """Load and execute the extract_image_urls function from source."""
    with open(_SOURCE_FILE, "r") as f:
        content = f.read()

    # Find and extract the extract_image_urls function
    # The function definition starts at "def extract_image_urls"
    start_idx = content.index("def extract_image_urls(")

    # Find the end of the function (next def or end of file)
    # We need to find the matching indentation
    lines = content[start_idx:].split('\n')
    func_lines = []
    for i, line in enumerate(lines):
        func_lines.append(line)
        # Stop at the next top-level definition
        if i > 0 and line and not line[0].isspace() and line.startswith('def ') or line.startswith('class ') or line.startswith('async def '):
            if i > 0:  # Don't stop at the first line (the function def itself)
                func_lines.pop()  # Remove the line we just added
                break

    # Also need the _IMAGE_URL_PATTERNS constant
    patterns_start = content.index("_IMAGE_URL_PATTERNS = [")
    patterns_lines = []
    for i, line in enumerate(content[patterns_start:].split('\n')):
        patterns_lines.append(line)
        if line.strip() == ']':
            break

    # Execute the patterns definition (need 're' module for regex patterns)
    namespace = {'re': re}
    exec('\n'.join(patterns_lines), namespace)
    exec('\n'.join(func_lines), namespace)

    return namespace['extract_image_urls']


def _load_build_issue_context_method():
    """Load and execute the _build_issue_context method from source."""
    with open(_SOURCE_FILE, "r") as f:
        content = f.read()

    # Find the _build_issue_context method
    start_idx = content.index("    def _build_issue_context(")

    # Find the end of the method (next method definition at same indentation)
    lines = content[start_idx:].split('\n')
    method_lines = []
    for i, line in enumerate(lines):
        method_lines.append(line)
        # Stop at the next method definition (same indent level)
        if i > 0 and line.startswith('    def ') and not line.startswith('    def _build_issue_context'):
            method_lines.pop()  # Remove the line we just added
            break

    # Strip the 4-space indentation from each line
    dedented_lines = [line[4:] if line.startswith('    ') else line for line in method_lines]

    # We also need extract_image_urls
    extract_image_urls = _load_extract_image_urls()

    # Create a mock class to test the method
    namespace = {
        'extract_image_urls': extract_image_urls,
        'Path': Path,
    }

    # Execute the method (dedented)
    exec('\n'.join(dedented_lines), namespace)

    return namespace['_build_issue_context']


# =============================================================================
# Tests for extract_image_urls
# =============================================================================

def test_extract_image_urls_markdown():
    """Test extracting image URLs from markdown syntax."""
    extract_image_urls = _load_extract_image_urls()

    text = """
    Bug in the login screen!

    ![Screenshot](https://github.com/example/repo/assets/123/screenshot.png)

    The button doesn't work.
    """

    urls = extract_image_urls(text)

    assert len(urls) == 1
    assert urls[0] == "https://github.com/example/repo/assets/123/screenshot.png"


def test_extract_image_urls_html():
    """Test extracting image URLs from HTML img tags."""
    extract_image_urls = _load_extract_image_urls()

    text = 'Check this: <img src="https://example.com/test.jpg" />'

    urls = extract_image_urls(text)

    assert len(urls) == 1
    assert urls[0] == "https://example.com/test.jpg"


def test_extract_image_urls_deduplication():
    """Test that duplicate URLs are deduplicated."""
    extract_image_urls = _load_extract_image_urls()

    text = """
    ![Img1](https://example.com/image.png)
    ![Img2](https://example.com/image.png)
    ![Img3](https://example.com/other.png)
    """

    urls = extract_image_urls(text)

    assert len(urls) == 2
    assert "https://example.com/image.png" in urls
    assert "https://example.com/other.png" in urls


def test_extract_image_urls_empty():
    """Test that empty text returns empty list."""
    extract_image_urls = _load_extract_image_urls()

    assert extract_image_urls("") == []
    assert extract_image_urls("No images here!") == []


def test_extract_image_urls_multiple():
    """Test extracting multiple image URLs."""
    extract_image_urls = _load_extract_image_urls()

    text = """
    ![First](https://example.com/first.png)
    ![Second](https://example.com/second.jpg)
    <img src='https://example.com/third.gif' />
    """

    urls = extract_image_urls(text)

    assert len(urls) == 3
    assert "https://example.com/first.png" in urls
    assert "https://example.com/second.jpg" in urls
    assert "https://example.com/third.gif" in urls


# =============================================================================
# Tests for _build_issue_context
# =============================================================================

def test_issue_context_includes_images(tmp_path: Path):
    """Test that _build_issue_context includes image URLs."""
    _build_issue_context = _load_build_issue_context_method()

    # Mock _get_recent_commits to avoid git operations
    class MockOrchestrator:
        def _get_recent_commits(self, project_root, max_count):
            return ""

    issue_body = """
    Bug in the login screen!

    ![Screenshot](https://github.com/example/repo/assets/123/screenshot.png)

    The button doesn't work.
    """

    context = _build_issue_context(
        MockOrchestrator(),
        issue_number=42,
        issue_title="Login bug",
        issue_body=issue_body,
        issue_labels=["bug", "ui"],
        issue_comments=[],
        project_root=Path("/tmp/test"),
    )

    # Verify image URL is in context
    assert "https://github.com/example/repo/assets/123/screenshot.png" in context
    assert "### Images (1 found)" in context
    # Verify the Images section contains a clean URL list (markdown bullet point)
    assert "- https://github.com/example/repo/assets/123/screenshot.png" in context


def test_issue_context_limits_images(tmp_path: Path):
    """Test that only first 20 images are included in the Images section."""
    _build_issue_context = _load_build_issue_context_method()

    class MockOrchestrator:
        def _get_recent_commits(self, project_root, max_count):
            return ""

    # Generate 25 image URLs
    many_images = "\n".join(
        f"![Img{i}](https://example.com/image{i}.png)"
        for i in range(25)
    )

    context = _build_issue_context(
        MockOrchestrator(),
        issue_number=1,
        issue_title="Many images",
        issue_body=many_images,
        issue_labels=[],
        issue_comments=[],
        project_root=Path("/tmp/test"),
    )

    # Should mention 25 found but only list first 20
    assert "### Images (25 found)" in context

    # Count bullet-point URLs in the Images section (should be exactly 20)
    # Each URL in the Images section is formatted as "- https://..."
    import re
    bullet_urls = re.findall(r'^- (https://example\.com/image\d+\.png)', context, re.MULTILINE)
    assert len(bullet_urls) == 20


def test_extract_image_urls_from_comments(tmp_path: Path):
    """Test that images from comments are included."""
    _build_issue_context = _load_build_issue_context_method()

    class MockOrchestrator:
        def _get_recent_commits(self, project_root, max_count):
            return ""

    issue_body = "No images in body"
    comments = [
        "Check this: ![Screenshot](https://example.com/comment1.png)",
        "And this: <img src='https://example.com/comment2.jpg' />",
    ]

    context = _build_issue_context(
        MockOrchestrator(),
        issue_number=2,
        issue_title="Comment images",
        issue_body=issue_body,
        issue_labels=[],
        issue_comments=comments,
        project_root=Path("/tmp/test"),
    )

    assert "https://example.com/comment1.png" in context
    assert "https://example.com/comment2.jpg" in context
