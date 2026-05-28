# ─── web/release.ps1 ────────────────────────────────────────────────────────
# Stages and commits ONLY changes inside `web/`, then pushes to the current
# branch. Vercel watches the branch and auto-deploys on push.
#
# Does NOT bump the app version. Does NOT create a git tag. Those are
# reserved for the Tauri desktop release via the root `release.ps1` (which
# tags `vX.Y.Z` and triggers the GitHub Actions release workflow).
#
# Usage:
#   ./release.ps1                    # interactive — asks for the commit message
#   ./release.ps1 -msg "update copy" # one-liner
# ────────────────────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory = $false)]
    [string]$msg = ""
)

# Always operate from the repo root so `git add web/` resolves regardless of
# where the script was invoked from.
$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Error "Not inside a git repository."
    exit 1
}
Set-Location $repoRoot.Trim()

# 1. Anything to commit?
$webChanges = git status --porcelain -- web/
if (-not $webChanges) {
    Write-Host "No changes in web/. Nothing to deploy." -ForegroundColor Yellow
    exit 0
}

# 2. Anything ALREADY staged outside web/ that would sneak in? Warn the user
#    so we don't accidentally bundle unrelated Tauri-side edits into a web
#    deploy commit.
$alreadyStaged = @(git diff --cached --name-only | Where-Object { -not ($_ -like "web/*") })
if ($alreadyStaged.Count -gt 0) {
    Write-Host "Heads up — these files are already staged but are NOT in web/:" -ForegroundColor Yellow
    foreach ($f in $alreadyStaged) { Write-Host "  $f" }
    $continue = Read-Host "Include them anyway? They'll be committed alongside web/ (y/N)"
    if ($continue -ne "y") {
        Write-Host "Aborted. (Run `git reset` to unstage them, or commit them separately.)" -ForegroundColor Yellow
        exit 0
    }
}

# 3. Commit message
if (-not $msg) {
    $msg = Read-Host "Web commit message"
}
if (-not $msg) {
    Write-Error "Message is required."
    exit 1
}

# 4. Stage only web/
Write-Host "`nStaging web/ changes..." -ForegroundColor Cyan
git add web/

# 5. Preview
Write-Host "`nAbout to commit:" -ForegroundColor Cyan
git diff --cached --stat

# 6. Commit (no version bump, no tag — Vercel watches the branch and deploys)
Write-Host "`nCommitting..." -ForegroundColor Cyan
git commit -m "web: $msg"
if (-not $?) {
    Write-Error "Commit failed."
    exit 1
}

# 7. Push
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Pushing to origin/$currentBranch..." -ForegroundColor Cyan
git push origin $currentBranch
if (-not $?) {
    Write-Error "Push failed."
    exit 1
}

Write-Host "`nDone. Vercel will pick up the push and redeploy." -ForegroundColor Green
