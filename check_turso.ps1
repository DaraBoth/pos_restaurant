$token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzM5OTU1ODcsImlkIjoiMDE5ZDBhNjAtMjUwMS03ODM1LTlhNTItN2MwNjY2NmVhYjIwIiwicmlkIjoiZTcwOTA3ZTktOWQ0OC00MWY3LWIyNDctZTA0NDlhY2NkZGYwIn0.Vv6o6couFDlsxOchsQ6mMtK_YJaFANAZ778AGjC7V1sL13OlCI2L8758sq79HziGdWmn000VWQFb0looWzdYBg'
$url = 'https://dineos-cloud-ariesbries.aws-ap-northeast-1.turso.io/v2/pipeline'
$headers = @{ 
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json' 
}

# Check migrations table to see what has been applied on remote
$sql = "SELECT id, applied_at FROM _migrations ORDER BY applied_at DESC"
$body = @{ 
    requests = @(
        @{ type='execute'; stmt=@{ sql=$sql } }, 
        @{ type='close' }
    ) 
} | ConvertTo-Json -Depth 5 -Compress

Write-Host "=== Migrations on Remote Turso ==="
$r = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body
$rows = $r.results[0].response.result.rows
if ($rows.Count -eq 0) { Write-Host "(no migrations recorded)" }
foreach ($row in $rows) {
    Write-Host "$($row[0].value) | $($row[1].value)"
}

# Check ALL tables that exist
Write-Host ""
Write-Host "=== Tables in Remote Turso ==="
$sql2 = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
$body2 = @{ 
    requests = @(
        @{ type='execute'; stmt=@{ sql=$sql2 } }, 
        @{ type='close' }
    ) 
} | ConvertTo-Json -Depth 5 -Compress
$r2 = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body2
foreach ($row in $r2.results[0].response.result.rows) {
    Write-Host $row[0].value
}
