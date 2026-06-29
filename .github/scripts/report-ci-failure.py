"""
Posts a CI failure report (including the captured build log excerpt) to ORBIT.
Called from .github/workflows/release.yml on failure.

Required env vars:
  ORBIT_API_KEY  — ORBIT project API key (from GitHub secret)
  CI_PLATFORM    — e.g. "windows-latest"
  CI_RUN_URL     — full URL to the Actions run
  CI_REF         — e.g. "refs/tags/v3.0.2"
  CI_SHA         — commit SHA

Optional env var:
  RUNNER_TEMP    — directory where log files were written (defaults to /tmp)

Log files scanned (in priority order — first file containing an error marker wins):
  rust-build.log  — cargo clippy / cargo build output
  next-build.log  — pnpm build (Next.js) output
"""

import json
import os
import re
import urllib.request
import sys

ORBIT_URL = "https://dailygoalmap.vercel.app/api/mcp"
MAX_EXCERPT_BYTES = 3000

# Checked in priority order: rust log first (more likely to be the real failure),
# then frontend log as fallback.
LOG_FILENAMES = ["rust-build.log", "next-build.log"]

# Markers that indicate the failure block — extract context around these.
ERROR_MARKERS = [
    "error[E",           # Rust compile error (e.g. error[E0382])
    "error: ",           # generic Rust/cargo error
    "could not compile", # Rust final summary
    "##[error]",         # GitHub Actions annotated error
    "Failed to compile", # Next.js compile failure
    "Type error",        # TypeScript type error
]

ANSI_RE = re.compile(r"\x1b\[[0-9;]*[mKG]")
SECRET_PATTERNS = [
    (re.compile(r"AUTH_TOKEN=\S+"), "AUTH_TOKEN=<redacted>"),
    (re.compile(r"DATABASE_URL=\S+"), "DATABASE_URL=<redacted>"),
    (re.compile(r"dgm_[A-Za-z0-9]+"), "<orbit-key>"),
]


def extract_excerpt(lines: list[str]) -> str:
    """Return up to MAX_EXCERPT_BYTES of the most relevant error context."""
    lines = [ANSI_RE.sub("", l) for l in lines]

    result: list[str] = []
    for i, line in enumerate(lines):
        if any(k in line for k in ERROR_MARKERS):
            result.extend(lines[max(0, i - 2) : min(len(lines), i + 20)])
            if len(result) > 80:
                break

    excerpt = "".join(result[-80:]) if result else "".join(lines[-60:])

    for pattern, replacement in SECRET_PATTERNS:
        excerpt = pattern.sub(replacement, excerpt)

    return excerpt[:MAX_EXCERPT_BYTES]


def load_excerpt() -> tuple[str, str]:
    """
    Scan all captured log files in priority order.
    Returns (excerpt, log_name) where log_name is the file that provided the excerpt.
    Prefers the first log that contains a known error marker.
    """
    runner_temp = os.environ.get("RUNNER_TEMP", "/tmp")

    candidates: list[tuple[str, str]] = []  # (excerpt, log_name)
    for filename in LOG_FILENAMES:
        log_file = os.path.join(runner_temp, filename)
        if not os.path.exists(log_file):
            continue
        with open(log_file, "r", errors="replace") as f:
            lines = f.readlines()
        if not lines:
            continue
        # Check if this log contains any error marker
        has_error = any(
            any(marker in ANSI_RE.sub("", line) for marker in ERROR_MARKERS)
            for line in lines
        )
        excerpt = extract_excerpt(lines)
        candidates.append((excerpt, filename, has_error))

    # Prefer a log that contains a known error marker; otherwise fall back to any log.
    for excerpt, filename, has_error in candidates:
        if has_error:
            return excerpt, filename

    # No log has a recognised error marker — use the first available log as-is.
    if candidates:
        excerpt, filename, _ = candidates[0]
        return excerpt, filename

    return "", ""


def main() -> None:
    api_key = os.environ.get("ORBIT_API_KEY", "")
    if not api_key:
        print("ORBIT_API_KEY not set — skipping error report.")
        sys.exit(0)

    platform = os.environ.get("CI_PLATFORM", "unknown")
    run_url = os.environ.get("CI_RUN_URL", "")
    ref = os.environ.get("CI_REF", "")
    sha = os.environ.get("CI_SHA", "")

    excerpt, log_source = load_excerpt()

    body = (
        f"**Platform:** {platform}\n"
        f"**Run:** {run_url}\n"
        f"**Ref:** {ref}\n"
        f"**SHA:** {sha}"
    )
    if excerpt:
        body += f"\n\n**Build error excerpt** (from `{log_source}`):\n```\n{excerpt}\n```"

    payload = {
        "tool": "tasks.create",
        "input": {
            "title": f"[ci-error] Release build failed ({platform})",
            "description": body,
            "tags": ["wf:error", "assign:code-reviewer", "project:dineos"],
        },
    }

    req = urllib.request.Request(
        ORBIT_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "X-Project-Api-Key": api_key,
        },
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print("ORBIT error task filed.")
    except Exception as exc:
        print(f"Failed to file ORBIT task: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
