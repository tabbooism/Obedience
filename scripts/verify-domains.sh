#!/usr/bin/env bash
set -Eeuo pipefail

for host in dashboard.cloutscape.org admin.cloutscape.org; do
  printf '[obediance] checking https://%s/ ... ' "$host"
  status=$(curl -k -sS -o /tmp/obediance-${host}.html -w '%{http_code}' --max-time 20 "https://${host}/")
  if [ "$status" != "200" ]; then
    printf 'failed (HTTP %s)\n' "$status" >&2
    exit 1
  fi
  grep -q "Obediance" "/tmp/obediance-${host}.html" || { printf 'failed (unexpected response)\n' >&2; exit 1; }
  printf 'ok\n'
done
