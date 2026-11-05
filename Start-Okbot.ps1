param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectDir = $PSScriptRoot
$entryPath = Join-Path $projectDir 'dist\src\main.js'
$dataPath = Join-Path $projectDir 'data'
$appUrl = 'http://127.0.0.1:3610/'
$urlPath = Join-Path $dataPath 'ui-url'
$tokenPath = Join-Path $dataPath 'ui-token'
if (-not (Test-Path -LiteralPath $entryPath)) { throw 'Run npm ci, npm run setup and npm run build first.' }
$running = $false
if (Test-Path -LiteralPath $urlPath) { $appUrl = (Get-Content -LiteralPath $urlPath -Raw).Trim() }
function Get-OkbotStatus {
    $headers = @{}
    if (Test-Path -LiteralPath $tokenPath) { $headers['x-amb-token'] = (Get-Content -LiteralPath $tokenPath -Raw).Trim() }
    Invoke-RestMethod -Uri ($appUrl + 'amb/api/status') -Headers $headers -TimeoutSec 2
}
try {
    $status = Get-OkbotStatus
    $running = $status.dataDir -eq $dataPath
} catch {}
if (-not $running) {
    New-Item -ItemType Directory -Path $dataPath -Force | Out-Null
    $env:AMB_DATA_DIR = $dataPath
    $env:AMB_UI_HOST = '127.0.0.1'
    $env:AMB_UI_PORT = '3610'
    if (Test-Path -LiteralPath $urlPath) { Remove-Item -LiteralPath $urlPath }
    $nodePath = (Get-Command node.exe).Source
    $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $entryPath + '"') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $dataPath 'launcher-out.log') -RedirectStandardError (Join-Path $dataPath 'launcher-error.log')
    Set-Content -LiteralPath (Join-Path $dataPath 'launcher.pid') -Value $process.Id
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 500
        if ($process.HasExited) { throw ('Startup failed. See ' + (Join-Path $dataPath 'launcher-error.log')) }
        try {
            if (Test-Path -LiteralPath $urlPath) { $appUrl = (Get-Content -LiteralPath $urlPath -Raw).Trim() }
            $status = Get-OkbotStatus
            if ($status.dataDir -eq $dataPath) { $running = $true; break }
        } catch {}
    }
}
if (-not $running) { throw 'Startup timed out. Check data\logs\app.log.' }
if (-not $NoBrowser) {
    $openUrl = $appUrl
    if (Test-Path -LiteralPath $tokenPath) { $openUrl += '?token=' + [uri]::EscapeDataString((Get-Content -LiteralPath $tokenPath -Raw).Trim()) }
    Start-Process $openUrl
}
Write-Output ('okbot is running at ' + $appUrl)
