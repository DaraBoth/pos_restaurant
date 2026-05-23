param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("big", "small", "fix", "major", "minor", "patch")]
    [string]$type = "",

    [Parameter(Mandatory=$false)]
    [string]$msg = ""
)

# 1. Interactive input if not provided via flags
if (-not $type) {
    Write-Host "Select release type:" -ForegroundColor Cyan
    Write-Host "1) Big (Major)"
    Write-Host "2) Small (Minor)"
    Write-Host "3) Fix (Patch)"
    $choice = Read-Host "Choice (1-3)"
    switch ($choice) {
        "1" { $type = "major" }
        "2" { $type = "minor" }
        "3" { $type = "patch" }
        default { Write-Error "Invalid choice"; exit }
    }
}

# Map alias names to semver
if ($type -eq "big") { $type = "major" }
if ($type -eq "small") { $type = "minor" }
if ($type -eq "fix") { $type = "patch" }

if (-not $msg) {
    $msg = Read-Host "Enter commit/release message"
}

if (-not $msg) {
    Write-Error "Message is required"; exit
}

# 2. Get current version from package.json
$pkg = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $pkg.version
Write-Host "Current Version: $currentVersion" -ForegroundColor Yellow

# Split version
$parts = $currentVersion.Split(".")
[int]$major = $parts[0]
[int]$minor = $parts[1]
[int]$patch = $parts[2]

# Increment based on type
if ($type -eq "major") { $major++; $minor = 0; $patch = 0 }
if ($type -eq "minor") { $minor++; $patch = 0 }
if ($type -eq "patch") { $patch++ }

$newVersion = "$major.$minor.$patch"
Write-Host "New Version: $newVersion" -ForegroundColor Green

# 3. Update files
Write-Host "Updating version in package.json..."
$pkg.version = $newVersion
$pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json"

Write-Host "Updating version in tauri.conf.json..."
$tauriConfig = Get-Content "src-tauri/tauri.conf.json" | ConvertFrom-Json
$tauriConfig.version = $newVersion
$tauriConfig | ConvertTo-Json -Depth 10 | Set-Content "src-tauri/tauri.conf.json"

# 4. Git commands
Write-Host "Staging changes..."
git add .

Write-Host "Committing: $msg"
git commit -m "release: v$newVersion - $msg"

Write-Host "Tagging: v$newVersion"
git tag -a "v$newVersion" -m "$msg"

$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Pushing to GitHub (branch: $currentBranch)..."
git push origin $currentBranch
git push origin "v$newVersion"

Write-Host "Successfully released v$newVersion!" -ForegroundColor Cyan
