#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Restore the locked dependencies without touching application data or secrets.
npm ci --no-audit --no-fund
npm run check
