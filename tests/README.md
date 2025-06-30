# WebLinq Monitoring System

This is a separate HonoJS project that provides comprehensive API monitoring capabilities for the WebLinq API. It was moved from the main backend to keep the core system focused and maintainable.

## Features

- **Automated API Testing**: Periodic testing of all WebLinq API endpoints
- **Historical Metrics**: SQLite storage for test results and performance analysis
- **Performance Analytics**: Response time trends, success rates, and error tracking
- **Configurable Intervals**: Test frequency from 1 minute to 24 hours
- **Start/Stop Control**: Full lifecycle management via API endpoints
- **Multi-Endpoint Support**: Tests screenshot, markdown, content, scrape, links, search, PDF endpoints

## Quick Start

### 1. Install Dependencies

```bash
cd tests
pnpm install
```

### 2. Deploy the Monitoring Worker

```bash
pnpm deploy
```

### 3. Start Monitoring

```bash
# Start monitoring with 5-minute intervals
curl -X POST https://your-monitoring-worker.workers.dev/monitoring/start \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "intervalMs": 300000,
      "apiKey": "YOUR_API_KEY",
      "enabledEndpoints": ["screenshot", "markdown", "content", "scrape"]
    }
  }'
```

## API Endpoints

### Control Operations

#### Start Monitoring

```bash
POST /monitoring/start
```

**Body:**

```json
{
  "config": {
    "intervalMs": 300000, // Test interval (60000-86400000ms)
    "apiKey": "string", // WebLinq API key
    "timeoutMs": 30000, // Request timeout (5000-120000ms)
    "enabledEndpoints": ["screenshot", "markdown", "content"]
  }
}
```

#### Stop Monitoring

```bash
POST /monitoring/stop
```

#### Get Status

```bash
POST /monitoring/status
```

### Data Retrieval

#### Get Test Results

```bash
POST /monitoring/results
```

**Body:**

```json
{
  "endpoint": "screenshot", // Optional: filter by endpoint
  "limit": 100, // Results per page (1-1000)
  "offset": 0, // Pagination offset
  "successOnly": false, // Optional: only successful tests
  "since": "2025-01-01T00:00:00Z" // Optional: results since timestamp
}
```

#### Get Endpoint Statistics

```bash
POST /monitoring/stats
```

#### Run Manual Test

```bash
POST /monitoring/test
```

## Configuration

### Environment Variables

The monitoring system requires your WebLinq API key. You can provide it either:

1. **In the request**: Include `apiKey` in the config object
2. **Authorization header**: `Authorization: Bearer YOUR_API_KEY`

### Test Configuration

```typescript
{
  intervalMs: number,        // Test frequency (60000-86400000ms)
  apiBaseUrl: string,        // WebLinq API base URL (default: https://api.weblinq.dev)
  apiKey: string,           // Your WebLinq API key
  timeoutMs: number,        // Request timeout (5000-120000ms)
  enabledEndpoints: string[] // Endpoints to test
}
```

### Supported Endpoints

- `screenshot` - Page screenshots
- `markdown` - Markdown extraction
- `content` - HTML content extraction
- `scrape` - Structured data extraction
- `links` - Link extraction
- `search` - Web search
- `pdf` - PDF generation

## Database Schema

The monitoring system stores comprehensive metrics in SQLite:

### test_results

- Individual test execution records
- Response times, success/failure status
- Error messages and status codes
- Response size and credit costs

### test_sessions

- Test cycle summaries
- Batch performance metrics
- Configuration snapshots

### endpoint_stats

- Aggregated endpoint performance
- Success rates and response time statistics
- Last success/failure timestamps

## Example Usage

### Basic Monitoring Setup

```bash
# 1. Start monitoring all endpoints every 5 minutes
curl -X POST https://your-worker.workers.dev/monitoring/start \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"config": {"intervalMs": 300000}}'

# 2. Check status
curl -X POST https://your-worker.workers.dev/monitoring/status \
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. Get recent results
curl -X POST https://your-worker.workers.dev/monitoring/results \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"limit": 50}'

# 4. Get performance statistics
curl -X POST https://your-worker.workers.dev/monitoring/stats \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Advanced Configuration

```bash
# Monitor specific endpoints with custom settings
curl -X POST https://your-worker.workers.dev/monitoring/start \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "config": {
      "intervalMs": 120000,
      "timeoutMs": 60000,
      "enabledEndpoints": ["screenshot", "markdown", "pdf"],
      "apiBaseUrl": "https://api.weblinq.dev"
    }
  }'
```

### Filtering Results

```bash
# Get only failed tests for screenshot endpoint
curl -X POST https://your-worker.workers.dev/monitoring/results \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "endpoint": "screenshot",
    "successOnly": false,
    "limit": 100
  }'

# Get results from last 24 hours
curl -X POST https://your-worker.workers.dev/monitoring/results \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "since": "'$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)'",
    "limit": 1000
  }'
```

## Development

### Local Development

```bash
# Run locally
pnpm dev

# Type checking
npx tsc --noEmit

# Generate types
pnpm run cf-typegen
```

### Deployment

```bash
# Deploy to production
pnpm deploy

# Deploy with custom name
npx wrangler deploy --name my-monitoring-worker
```

## Benefits

1. **Maintainability**: Separated from main API for focused development
2. **Independent Scaling**: Monitoring workload doesn't affect main API performance
3. **Optional Deployment**: Only deploy if monitoring is needed
4. **Resource Isolation**: Dedicated resources for monitoring operations
5. **Comprehensive Metrics**: Historical data for performance analysis

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Alarm API     │───▶│  MonitoringDO   │───▶│   API Testing   │
│  (Scheduler)    │    │   (Controller)  │    │   (Execution)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   SQLite DB     │
                       │ (Metrics Store) │
                       └─────────────────┘
```

The monitoring system uses:

- **Cloudflare Alarms** for scheduled test execution
- **Durable Objects** for state management and coordination
- **SQLite** for persistent metrics storage
- **HonoJS** for HTTP API and routing
- **Zod** for request validation

---

For more details about the WebLinq API that this monitors, see the [main project documentation](../README.md).
