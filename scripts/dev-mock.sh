#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || { echo "[obediance] ERROR: Node.js 20+ is required." >&2; exit 1; }
if command -v corepack >/dev/null 2>&1 && corepack pnpm --version >/dev/null 2>&1; then
  exec env NODE_ENV=development OBEDIANCE_MOCK_AUTH=1 OBEDIANCE_MOCK_AUTH_ROLE=admin corepack pnpm dev
fi
if command -v npx >/dev/null 2>&1; then
  exec env NODE_ENV=development OBEDIANCE_MOCK_AUTH=1 OBEDIANCE_MOCK_AUTH_ROLE=admin npx --yes pnpm@10.4.1 dev
fi
exec env NODE_ENV=development OBEDIANCE_MOCK_AUTH=1 OBEDIANCE_MOCK_AUTH_ROLE=admin pnpm dev
