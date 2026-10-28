#!/bin/bash
set -e
pnpm install --frozen-lockfile
# The existing application uses SQLite. Never push the unused PostgreSQL
# scaffold or provision a second, empty database during this port.
node scripts/restore-legacy-data.mjs
pnpm run check
