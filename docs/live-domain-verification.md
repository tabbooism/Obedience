# Live domain verification

Verified 2026-09-01 through the Cloudflare tunnel connected to tunnel ID `0418fda5-5515-42ca-9847-db89bdabaaa2`.

| Hostname | HTTPS | Rendered response | Notes |
| --- | --- | --- | --- |
| `dashboard.cloutscape.org` | 200 | Obediance Intelligence Platform sign-in view | Dark Leviathan background and public-source intelligence copy rendered. |
| `admin.cloutscape.org` | 200 | Obediance Intelligence Platform sign-in view | Same frontend route; admin behavior is host-aware after authentication and remains permission-gated. |

The apex `cloutscape.org` was not changed by this configuration. The tunnel connector is running in the temporary sandbox for this verification; production persistence still requires an always-on WSL/Debian or managed host process.

## Production branding verification

After rebuilding the frontend and restarting the production server on port `3100`, both hostnames were reloaded in the connected browser with a cache-busting query. The rendered pages showed the Obediance sign-in surface, the Leviathan background, and no visible “Preview mode” or “Publish Preview” banner.

- `https://dashboard.cloutscape.org/?obediance_build=branding-2` — verified in browser.
- `https://admin.cloutscape.org/?obediance_build=branding-2` — verified in browser.
