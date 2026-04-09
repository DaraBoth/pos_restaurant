# Load environment variables from .env
if (Test-Path .env) {
    Get-Content .env -ErrorAction SilentlyContinue | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $n, $v = $_ -split '=', 2
        $name = $n.Trim()
        $value = $v.Trim()
        
        # If it's the private key and looks like a path, load the second line (base64 part)
        if ($name -eq "TAURI_SIGNING_PRIVATE_KEY" -and (Test-Path $value)) {
            $value = (Get-Content $value)[1].Trim()
        }
        
        [System.Environment]::SetEnvironmentVariable($name, $value, [System.EnvironmentVariableTarget]::Process)
    }
}

# Run the build
pnpm tauri build
