#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() { printf '[obediance] %s\n' "$1"; }
fail() { printf '[obediance] ERROR: %s\n' "$1" >&2; exit 1; }
APP_PID=""
TUNNEL_PID=""
cleanup() {
  if [ -n "$TUNNEL_PID" ] && kill -0 "$TUNNEL_PID" 2>/dev/null; then kill "$TUNNEL_PID" 2>/dev/null || true; fi
  if [ -n "$APP_PID" ] && kill -0 "$APP_PID" 2>/dev/null; then kill "$APP_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'fail "Deployment stopped at line $LINENO."' ERR

command -v node >/dev/null 2>&1 || fail "Node.js is required. Install Node.js 20+ in WSL 2 or Debian."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required. Enable it with corepack or install it in the active Linux environment."
node -e 'const major=Number(process.versions.node.split(".")[0]); if (major < 20) process.exit(1)' || fail "Node.js 20+ is required."

if grep -qi microsoft /proc/version 2>/dev/null; then
  log "WSL detected: using Linux-native paths and signal handling."
else
  log "Linux host detected."
fi

if [ "${OBEDIANCE_SKIP_INSTALL:-0}" != "1" ]; then
  log "Installing locked dependencies."
  pnpm install --frozen-lockfile
fi

if [ "${OBEDIANCE_SKIP_MIGRATION:-0}" != "1" ]; then
  [ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is required for migrations. Set it in the environment, never in source control."
  log "Applying committed database migrations."
  pnpm drizzle-kit migrate
fi

log "Running type checks and tests."
pnpm check
pnpm test
log "Building application artifacts."
pnpm build

if [ "${START_TUNNEL:-0}" = "1" ]; then
  command -v cloudflared >/dev/null 2>&1 || fail "cloudflared is required when START_TUNNEL=1. Install it in WSL 2 or Debian."
  [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ] || fail "CLOUDFLARE_TUNNEL_TOKEN is required when START_TUNNEL=1. Do not commit it."
  : "${PORT:=3000}"
  log "Starting the production server for the tunnel."
  NODE_ENV=production pnpm start >"${OBEDIANCE_RUNTIME_LOG:-/tmp/obediance-app.log}" 2>&1 &
  APP_PID=$!
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/api/v1/health" >/dev/null 2>&1; then break; fi
    sleep 1
    if [ "$attempt" = "10" ]; then fail "Application did not become healthy on port ${PORT}."; fi
  done
  log "Starting Cloudflare Tunnel for dashboard.cloutscape.org and admin.cloutscape.org."
  cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN" &
  TUNNEL_PID=$!
  wait "$APP_PID" "$TUNNEL_PID"
elif [ "${START_APP:-0}" = "1" ]; then
  log "Starting application. Press Ctrl+C to stop."
  NODE_ENV=production pnpm start
else
  log "Build complete. Set START_APP=1 to run the production server or START_TUNNEL=1 to run the app behind Cloudflare Tunnel."
fi
