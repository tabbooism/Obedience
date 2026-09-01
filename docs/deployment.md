# Obediance deployment runbook

## Application shape

The application is a Node.js 20+ full-stack service with a Vite frontend, Express transport, tRPC contracts, and a MySQL-compatible persistence layer. The production path contains no bundled intelligence records. Empty tables are rendered as explicit empty states, and public-source search reports upstream availability rather than manufacturing results.

## WSL 2 and Windows 11

From PowerShell, run `wsl` and then change into the Linux-mounted repository directory. Execute `bash scripts/aio-deploy.sh` for the native Linux workflow, or run `powershell -ExecutionPolicy Bypass -File scripts/aio-deploy.ps1` from the repository root. The script checks Node.js and pnpm, installs the lockfile, applies migrations when `DATABASE_URL` is present, runs type checks and tests, and builds the application. The script intentionally stops when a required database or tunnel credential is missing. The repository uses pnpm 10.4.1 because its lockfile is format 9; older pnpm versions must not be used.

If installation reports `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`, repair the local environment with:

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
cd /opt/obediance
rm -rf node_modules
pnpm install --frozen-lockfile
pnpm dev
```

If Corepack is unavailable, use `npx --yes pnpm@10.4.1 install --frozen-lockfile` instead. Do not use `--force` unless you intentionally want to regenerate and review the lockfile; the normal fix is to use pnpm 10.4.1. The AIO deployment script now checks this version before attempting installation.

The Windows device is appropriate for development and tunnel testing. It should not be treated as the sole production host because Windows sleep, restart, or WSL shutdown will interrupt the tunnel. For production, use an always-on Debian host and run the same Linux script from a service manager.

## Cloudflare Tunnel

The repository includes `deploy/cloudflared/ingress.yml` with the two Obediance hostname routes plus preserved legacy `ops` and `profiler` routes:

| Hostname | Origin |
| --- | --- |
| `dashboard.cloutscape.org` | `http://127.0.0.1:3100` |
| `admin.cloutscape.org` | `http://127.0.0.1:3100` |

Create or select a Cloudflare Tunnel in the Cloudflare dashboard, attach these public hostnames to the tunnel, and install the connector on the Debian host or WSL 2 test environment. The connector token must be supplied only as the runtime variable `CLOUDFLARE_TUNNEL_TOKEN`; it must never be committed. Start the application first, then start `cloudflared tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"`. The application identifies the admin plane from the `admin.cloutscape.org` hostname and still enforces administrator authorization for admin-only procedures.

The apex `cloutscape.org` is not referenced by the ingress rules and is not changed by this project configuration.

## API access

The versioned API is available under `/api/v1`. `GET /api/v1/health` is public. All other endpoints require `Authorization: Bearer $OBEDIANCE_API_KEY` and return a request identifier, a consistent `{ ok, data }` or `{ ok, error, requestId }` envelope, bounded input validation, rate limiting, and explicit upstream or persistence failures. The API key is stored in the environment through the project secret manager and is never written to source control.

## Operations checklist

Before making a live DNS change, verify that the application build and tests pass, the database is reachable, the Cloudflare tunnel connector can reach `127.0.0.1:3100`, and the hostname routes do not include the apex domain. After routing, check both HTTPS hostnames and then inspect application logs for authentication and upstream failures. Keep the Cloudflare dashboard as the source of truth for tunnel credentials and hostname status.

## Quick restart after pulling the updated branch

From the repository root, stop the current process with `Ctrl+C`, then run `git pull --ff-only origin manus/integrated-console-wip`. For a development preview, run `pnpm install --frozen-lockfile && pnpm dev`; the local server normally listens on `http://127.0.0.1:3000`. For a production-style restart, load the protected environment and run `OBEDIANCE_SKIP_INSTALL=1 OBEDIANCE_SKIP_MIGRATION=1 START_APP=1 bash scripts/aio-deploy.sh`. For a full validation and build, omit the two skip flags. The script validates Node.js and pnpm, runs checks, tests, builds, and then starts the application.

## Cloudflare tunnel restart

Load the protected environment containing `DATABASE_URL`, `OBEDIANCE_API_KEY`, and `CLOUDFLARE_TUNNEL_TOKEN`, then run `START_TUNNEL=1 bash scripts/aio-deploy.sh`. Start only one connector for the service. The script waits for `GET /api/v1/health` before starting the tunnel and exits if the application does not become healthy. Do not put credentials in the repository or command history.

## First-party API

Obediance already provides its own versioned REST API under `/api/v1`; it does not require a third-party API gateway. `GET /api/v1/health` is public for health checks. All other API routes require `Authorization: Bearer $OBEDIANCE_API_KEY`, use bounded request validation, owner scoping, rate limiting, request IDs, audit events, and safe error envelopes. External providers are optional only for enrichment sources, email/SMS delivery, signaling, or push delivery.

## Phone notifications

The dashboard is installable as a lightweight PWA and includes a first-party service worker. On a phone, open the dashboard over HTTPS, install it to the home screen if desired, open **Comms desk**, and choose **Enable phone alerts**. This enables browser/PWA notifications without exposing provider credentials. True background push from the server requires HTTPS, VAPID keys, and a persistent subscription store; until those are configured, the UI intentionally reports the capability as optional rather than pretending server push is active.
