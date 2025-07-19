# WebLinq Playwright V2 - Browser Session Reuse with Durable Objects

This is the next-generation Playwright-based web automation service with efficient browser session reuse using Cloudflare Durable Objects.

## Architecture

The system separates concerns cleanly:

- **Durable Objects**: Handle browser session lifecycle and orchestration only
- **Operation Libraries**: Handle actual web operations (markdown, screenshots, etc.)
- **Browser Utils**: Bridge between DOs and operations via session connection

### Browser Session Management

The service uses a two-tier Durable Object architecture for efficient browser session reuse:

1. **PlaywrightBrowserDO** (`src/durable-objects/playwright-browser-do.ts`)

   - Manages exactly ONE Playwright browser session
   - Keeps sessions alive with proactive refresh (8.5 min intervals)
   - Provides session IDs for external connection via `connect()`
   - Exposes RPC interface for session management only

2. **PlaywrightManagerDO** (`src/durable-objects/playwright-manager-do.ts`)
   - Orchestrates multiple browser DOs (up to 10 concurrent)
   - Handles DO allocation, queueing, and cleanup
   - Tracks DO status (idle/busy/error) and assigns work efficiently
   - Performs background cleanup of long-idle instances

### Session Reuse Benefits

- **Faster Operations**: Reusing warm browser sessions reduces latency from ~2-3s to ~200-500ms
- **Resource Efficiency**: Maintains persistent sessions across Worker requests
- **Automatic Scaling**: Creates DOs on-demand up to configured limits
- **Fault Tolerance**: Automatic recovery from browser crashes and network issues
- **Cost Optimization**: Reduces browser startup overhead and slot usage

## Endpoints

### POST `/api/web/extract-markdown`

Extract markdown content from web pages.

```json
{
  "url": "https://example.com",
  "waitTime": 1000
}
```

### POST `/api/web/screenshot`

Take screenshots of web pages.

```json
{
  "url": "https://example.com",
  "viewport": { "width": 1920, "height": 1080 },
  "waitTime": 1000,
  "base64": false
}
```

## Implementation Details

### Durable Object Configuration

The service is configured in `wrangler.jsonc` with:

```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "PLAYWRIGHT_BROWSER_DO",
        "class_name": "PlaywrightBrowserDO"
      },
      {
        "name": "PLAYWRIGHT_MANAGER_DO",
        "class_name": "PlaywrightManagerDO"
      }
    ]
  }
}
```

### Session Lifecycle

1. **Request arrives** → Manager DO allocates idle browser DO
2. **Session connect** → External code connects to browser session via session ID
3. **Operation executes** → External libraries (markdown-v2.ts, screenshot-v2.ts) handle page operations
4. **Session disconnect** → External code disconnects, Browser DO returns to idle state
5. **Reuse** → Same browser session can handle next request
6. **Cleanup** → Manager periodically cleans up old sessions

### Fallback Strategy

If Durable Objects are not available or fail, the service automatically falls back to the simple browser approach using `runWithBrowserSimple()`.

## Development

### Prerequisites

- Node.js 18+
- Wrangler CLI
- Playwright browser binding enabled

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
wrangler dev

# Deploy to Cloudflare Workers
wrangler deploy
```

### Testing Browser Session Reuse

You can verify session reuse by:

1. Making multiple requests and observing logs
2. Checking browser launch times (reused sessions ~100ms, new sessions ~2000ms)
3. Monitoring DO status via Manager endpoints

```bash
# Check DO statistics
curl https://your-worker.example.workers.dev/manager/stats

# Trigger manual cleanup
curl https://your-worker.example.workers.dev/manager/cleanup
```

## Performance Characteristics

- **Cold Start**: ~2-3 seconds (new browser session)
- **Warm Reuse**: ~200-500ms (existing session)
- **Session Lifetime**: 8.5 minutes (proactive refresh)
- **Max Concurrent**: 10 browser DOs per Manager
- **Memory Usage**: ~50-100MB per browser session

## Monitoring and Debugging

- Browser DO health checks run every 3 minutes
- Manager cleanup runs every hour
- All operations include comprehensive logging
- Session IDs tracked for debugging and monitoring
- Automatic error recovery and DO recreation
