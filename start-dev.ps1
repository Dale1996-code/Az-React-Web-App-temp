#!/usr/bin/env pwsh
# Start both the API and web frontend for local development.
# PowerShell equivalent of start-dev.sh — runs on Windows without WSL or Git Bash.
# Requires: Node 22 LTS, npm
# Usage: .\start-dev.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "=== Installing API dependencies ==="
Push-Location "$root\src\api"; npm ci --silent; Pop-Location
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "=== Installing Web dependencies ==="
Push-Location "$root\src\web"; npm ci --silent; Pop-Location
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "=== Building API ==="
Push-Location "$root\src\api"; npm run build; Pop-Location
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host ""
Write-Host "=== Starting API (port 3100) and Web (port 5173) ==="
Write-Host "API:  http://localhost:3100"
Write-Host "Web:  http://localhost:5173"
Write-Host "Press Ctrl+C to stop both."
Write-Host ""

$env:NODE_ENV = "development"
$apiProc = Start-Process -FilePath "node" -ArgumentList "." `
    -WorkingDirectory (Resolve-Path "$root\src\api").Path `
    -NoNewWindow -PassThru

try {
    Push-Location "$root\src\web"
    npm run dev
} finally {
    Pop-Location
    if ($apiProc -and -not $apiProc.HasExited) {
        $apiProc | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "API process stopped."
    }
}
