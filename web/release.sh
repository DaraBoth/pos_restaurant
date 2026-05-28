#!/bin/bash
# ─── web/release.sh ─────────────────────────────────────────────────────────
# Stages and commits ONLY changes inside `web/`, then pushes to the current
# branch. Vercel watches the branch and auto-deploys on push.
#
# Does NOT bump the app version. Does NOT create a git tag. Those are
# reserved for the Tauri desktop release via the root `release.sh` (which
# tags vX.Y.Z and triggers the GitHub Actions release workflow).
#
# Usage:
#   ./release.sh                    # interactive — asks for the commit message
#   ./release.sh -m "update copy"   # one-liner
# ───────────────────────────────────────────────────────────────────────────

set -e

MSG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--message)
      MSG="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

# Operate from the repo root so `git add web/` resolves correctly.
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "Not inside a git repository." >&2
  exit 1
}
cd "$REPO_ROOT"

# 1. Anything to commit?
WEB_CHANGES=$(git status --porcelain -- web/)
if [ -z "$WEB_CHANGES" ]; then
  echo "No changes in web/. Nothing to deploy."
  exit 0
fi

# 2. Warn about non-web/ files already staged
ALREADY_STAGED=$(git diff --cached --name-only | grep -v '^web/' || true)
if [ -n "$ALREADY_STAGED" ]; then
  echo "Heads up — these files are already staged but are NOT in web/:"
  echo "$ALREADY_STAGED" | sed 's/^/  /'
  read -p "Include them anyway? They'll be committed alongside web/ (y/N): " CONTINUE
  if [ "$CONTINUE" != "y" ]; then
    echo "Aborted. (Run \`git reset\` to unstage them, or commit them separately.)"
    exit 0
  fi
fi

# 3. Commit message
if [ -z "$MSG" ]; then
  read -p "Web commit message: " MSG
fi
if [ -z "$MSG" ]; then
  echo "Message is required." >&2
  exit 1
fi

# 4. Stage only web/
echo "Staging web/ changes..."
git add web/

# 5. Preview
echo "About to commit:"
git diff --cached --stat

# 6. Commit (no version bump, no tag)
echo "Committing..."
git commit -m "web: $MSG"

# 7. Push
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo "Done. Vercel will pick up the push and redeploy."
