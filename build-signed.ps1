# Load environment variables from .env
if (Test-Path .env) {
    Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), [System.EnvironmentVariableTarget]::Process)
    }
}

# Run the build
pnpm tauri build
