---
name: add-changedetection
description: Add changedetection.io website monitoring integration. Create, list, and manage page watches via MCP tools. Change notifications are handled by changedetection.io's built-in notification system.
---

> Contributed by [@henricook](https://github.com/henricook) — [PR #1369](https://github.com/qwibitai/nanoclaw/pull/1369)

# Add Changedetection.io Integration

Adds MCP tools for [changedetection.io](https://github.com/dgtlmoon/changedetection.io) website change monitoring. The bot can create, list, and manage page watches on demand. Notifications (email, Discord, Slack, etc.) are configured in the changedetection.io UI via its built-in Apprise integration.

## Phase 1: Pre-flight

1. Check if `container/agent-runner/src/ipc-mcp-stdio.ts` already contains `create_watch` - skip to Phase 3 if so
2. Collect from the user:
   - Changedetection.io instance URL (e.g. `http://localhost:5000`)
   - API key (from Settings > API in the changedetection.io UI)

## Phase 2: Apply Code Changes

### Add MCP tools to the nanoclaw MCP server

Add 5 tools to `container/agent-runner/src/ipc-mcp-stdio.ts` that call the changedetection.io REST API:

| Tool | Method | Endpoint | Purpose |
|------|--------|----------|---------|
| `create_watch` | POST | `/api/v1/watch` | Create a new page monitor. Accept `url`, optional `title`, optional `time_between_check` (seconds, default 3600), optional `browser` boolean (for SPAs - sets `fetch_backend` to `html_webdriver`) |
| `list_watches` | GET | `/api/v1/watch` | List all monitors with status |
| `get_watch` | GET | `/api/v1/watch/{uuid}` | Get details of a specific monitor |
| `delete_watch` | DELETE | `/api/v1/watch/{uuid}` | Remove a monitor |
| `get_watch_snapshot` | GET | `/api/v1/watch/{uuid}/history/{timestamp}` | Get latest or historical snapshot (plain text, not JSON) |

Authentication is via `x-api-key` header on all requests.

### Wire up the API credentials

The MCP tools need `CHANGEDETECTION_URL` and `CHANGEDETECTION_API_KEY` available at runtime. Trace how existing credentials (e.g. API keys for other integrations) flow from `.env` to the MCP server process inside the container, and add these two following the same pattern. If no such pattern exists yet, establish one.

The API key should not be accessible to bash commands the agent runs.

### Add to .env

```
CHANGEDETECTION_URL=<instance-url>
CHANGEDETECTION_API_KEY=<api-key>
```

### Rebuild and restart

```bash
npm run build
bash container/build.sh
# Linux: systemctl --user restart nanoclaw
# macOS: launchctl kickstart -k gui/$(id -u)/com.nanoclaw
```

## Phase 3: Verify

Ask the agent:

> Watch https://example.com for changes

Verify the watch appears in the changedetection.io UI, then:

> List my watches

And:

> Delete the example.com watch

## Gotchas

- **Non-JSON API responses**: The DELETE endpoint returns an empty body. Other endpoints may return plain text. The API helper must read the response as text first and only parse JSON if content is present. Do NOT use `res.json()` unconditionally.
- **Browser mode**: `create_watch` should accept a `browser` flag for JS-heavy/SPA pages. This maps to `fetch_backend: html_webdriver` vs `html_requests`.
- **Notifications**: Notification config (email recipients, webhooks) should be managed in the changedetection.io UI, not via the API. This keeps notification credentials out of NanoClaw.
- **Network**: The instance must be reachable from inside Docker containers. If using a local hostname, ensure it resolves (via `/etc/hosts`, DNS, or `host.docker.internal`).

## Configuration Reference

| Variable | Description |
|----------|-------------|
| `CHANGEDETECTION_URL` | Base URL of your changedetection.io instance |
| `CHANGEDETECTION_API_KEY` | API key from Settings > API in the UI |
