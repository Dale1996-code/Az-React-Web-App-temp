#!/usr/bin/env pwsh
# Run this before `azd deploy` to verify the repo is in a deployable state.
# PowerShell equivalent of preflight.sh — runs on Windows without WSL or Git Bash.
#
# Usage:  .\preflight.ps1
# Exit:   0 = all checks passed, 1 = one or more checks failed.

$results    = @()
$anyFailed  = $false
$root       = $PSScriptRoot

function Section($msg) { Write-Host ""; Write-Host "=== $msg ===" }
function Pass($msg)    { Write-Host "  [PASS] $msg"; $script:results += "PASS: $msg" }
function Fail($msg)    { Write-Host "  [FAIL] $msg"; $script:results += "FAIL: $msg"; $script:anyFailed = $true }

function RunCheck {
    param([string]$label, [scriptblock]$cmd)
    & $cmd
    if ($LASTEXITCODE -eq 0) { Pass $label } else { Fail $label }
}

# --- Node version check -------------------------------------------------------

Section "Node version"
$nodeVer = node --version 2>$null
$major   = if ($nodeVer -match 'v(\d+)') { [int]$Matches[1] } else { 0 }
if ($major -ge 22) { Pass "Node $nodeVer (>= 22 required)" }
else               { Fail "Node $nodeVer is too old or not installed — need >= 22 LTS"; $anyFailed = $true }

# --- API checks ---------------------------------------------------------------

Section "API — install dependencies"
RunCheck "api: npm ci" {
    Push-Location "$root\src\api"; npm ci --silent; Pop-Location
}

Section "API — unit/integration tests  [NODE_ENV=test]"
RunCheck "api: npm test" {
    Push-Location "$root\src\api"
    $env:NODE_ENV = "test"
    npm test
    $env:NODE_ENV = $null
    Pop-Location
}

Section "API — build  (lint + tsc)"
RunCheck "api: npm run build" {
    Push-Location "$root\src\api"; npm run build; Pop-Location
}

# --- Web checks ---------------------------------------------------------------

Section "Web — install dependencies"
RunCheck "web: npm ci" {
    Push-Location "$root\src\web"; npm ci --silent; Pop-Location
}

Section "Web — lint  (ESLint, zero warnings)"
RunCheck "web: npm run lint" {
    Push-Location "$root\src\web"; npm run lint; Pop-Location
}

Section "Web — build  (tsc + vite)"
RunCheck "web: npm run build" {
    Push-Location "$root\src\web"; npm run build; Pop-Location
}

# --- Summary ------------------------------------------------------------------

Write-Host ""
Write-Host "========================================"
Write-Host "Preflight summary"
Write-Host "========================================"
foreach ($r in $results) { Write-Host "  $r" }
Write-Host "========================================"

if ($anyFailed) {
    Write-Host ""
    Write-Host "One or more checks FAILED. Fix the issues above before running azd deploy."
    exit 1
} else {
    Write-Host ""
    Write-Host "All checks passed. Safe to run: azd deploy"
}
