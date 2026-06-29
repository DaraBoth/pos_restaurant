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
  RUNNER_TEMP    — directory where next-build.log was written (defaults to /tmp)
"""

import json
import os
import re
import urllib.request
import sys

ORBIT_URL = "https://dailygoalmap.vercel.app/api/mcp"
LOG_FILENAME = "next-build.log"
MAX_EXCERPT_BYTES = 3000
ERROR_MARKERS = ["Failed to compile", "Type error", "error[E", "Error:"]
ANSI_RE = re.compile(r"\x1b\[[0-9;]*[mKG]")
SECRET_PATTERNS = [
    (re.compile(r"AUTH_TOKEN=\S+"), "AUTH_TOKEN=<redacted>"),
    (re.compile(r"DATABASE_URL=\S+"), "DATABASE_URL=<redacted>"),
    (re.compile(r"dgm_[A-Za-z0-9]+"), "<orbit-key>"),
]


def load_excerpt() -> str:
    runner_temp = os.environ.get("RUNNER_TEMP", "/tmp")
    log_file = os.path.join(runner_temp, LOG_FILENAME)
    if not os.path.exists(log_file):
        return ""

    with open(log_file, "r", errors="replace") as f:
        lines = f.readlines()

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


def main() -> None:
    api_key = os.environ.get("ORBIT_API_KEY", "")
    if not api_key:
        print("ORBIT_API_KEY not set — skipping error report.")
        sys.exit(0)

    platform = os.environ.get("CI_PLATFORM", "unknown")
    run_url = os.environ.get("CI_RUN_URL", "")
    ref = os.environ.get("CI_REF", "")
    sha = os.environ.get("CI_SHA", "")

    excerpt = load_excerpt()

    body = (
        f"**Platform:** {platform}\n"
        f"**Run:** {run_url}\n"
        f"**Ref:** {ref}\n"
        f"**SHA:** {sha}"
    )
    if excerpt:
        body += f"\n\n**Build error excerpt:**\n```\n{excerpt}\n```"

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
