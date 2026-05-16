#!/usr/bin/env bash
# Run this before deploying to verify the repo is in a deployable state.
# Mirrors the build/test steps in .github/workflows/gcp-deploy.yml.
#
# Usage: ./preflight.sh
# Exit code: 0 = all checks passed, 1 = one or more checks failed.

set -euo pipefail

PASS=0
FAIL=1
results=()

# --- helpers -----------------------------------------------------------------

section() { echo ""; echo "=== $* ==="; }
ok()      { echo "  [PASS] $*"; results+=("PASS: $*"); }
fail()    { echo "  [FAIL] $*"; results+=("FAIL: $*"); }
run_check() {
  local label="$1"; shift
  if "$@" 2>&1; then
    ok "$label"
  else
    fail "$label"
    PASS=1   # mark overall failure
  fi
}

# --- Node version check ------------------------------------------------------

section "Node version"
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
MAJOR=$(echo "$NODE_VERSION" | sed 's/v\([0-9]*\).*/\1/')
if [ "$MAJOR" -ge 22 ] 2>/dev/null; then
  ok "Node $NODE_VERSION (>= 22 required)"
else
  fail "Node $NODE_VERSION is too old or not installed — need >= 22 LTS"
  PASS=1
fi

# --- API checks --------------------------------------------------------------

section "API — install dependencies"
run_check "api: npm ci" bash -c "cd src/api && npm ci --silent"

section "API — unit/integration tests  [NODE_ENV=test]"
run_check "api: npm test" bash -c "cd src/api && NODE_ENV=test npm test"

section "API — build  (lint + tsc)"
run_check "api: npm run build" bash -c "cd src/api && npm run build"

# --- Web checks --------------------------------------------------------------

section "Web — install dependencies"
run_check "web: npm ci" bash -c "cd src/web && npm ci --silent"

section "Web — lint  (ESLint, zero warnings)"
run_check "web: npm run lint" bash -c "cd src/web && npm run lint"

section "Web — build  (tsc + vite)"
run_check "web: npm run build" bash -c "cd src/web && npm run build"

# --- Summary -----------------------------------------------------------------

echo ""
echo "========================================"
echo "Preflight summary"
echo "========================================"
for r in "${results[@]}"; do
  echo "  $r"
done
echo "========================================"

if [ "$PASS" -ne 0 ]; then
  echo ""
  echo "One or more checks FAILED. Fix the issues above before deploying."
  exit 1
else
  echo ""
  echo "All checks passed. Safe to deploy."
fi
