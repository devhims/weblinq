# Web Durable Object Integration Guide

This document explains the new Web functionality that has been added to the backend API, implementing a simplified and efficient architecture for web operations.

## Overview

The Web module provides Cloudflare Browser Rendering API functionality and web search capabilities through a Durable Object architecture for scalability and user isolation. Each user gets their own Web Durable Object instance that handles all web operations.

## Architecture

### Files Created/Modified

1. **`src/routes/web/web.routes.ts`** - OpenAPI route definitions for all web operations
2. **`src/routes/web/web.search-handler.ts`** - Separate search functionality handler (as requested)
3. **`src/routes/web/web.index.ts`** - Simplified router with direct Durable Object method calls
4. **`src/durable-objects/web-durable-object.ts`** - The core Durable Object that wraps Cloudflare Browser Rendering API and search
5. **Updated `src/app.ts`** - Added web routes and exported WebDurableObject

### Simplified Architecture Pattern

The Web system uses a streamlined pattern that eliminates redundant layers:

**Request Flow:**

```
Client Request → Authentication Middleware → Route Handler → Direct Method Call → Durable Object → Cloudflare API
```

**Key Architectural Decisions:**

- **Direct Method Invocation**: Route handlers call Durable Object methods directly instead of HTTP forwarding
- **Single Authentication Layer**: `requireAuth` middleware handles authentication once at the route level
- **No Redundant Handlers**: Eliminated the need for intermediate durable-handlers layer
- **User Isolation**: Each user gets their own Durable Object instance via `web:${userId}` naming
- **Credit Tracking**: All operations consume credits and track usage for billing

### Why This Architecture is Better

The previous pattern used in other parts of the codebase had redundant layers:

- **Old Pattern**: `Route → Durable Handler → HTTP Request → Durable Object`
- **New Pattern**: `Route → Direct Call → Durable Object`

This eliminates:

- Duplicate authentication checks
- HTTP request overhead between layers
- Complex type casting and forwarding logic
- Maintenance overhead of multiple handler files

## API Endpoints

### 1. Screenshot Capture

- **Endpoint**: `POST /web/screenshot`
- **Purpose**: Capture screenshots of webpages
- **Credits**: 1 credit per request

### 2. Markdown Extraction

- **Endpoint**: `POST /web/markdown`
- **Purpose**: Extract markdown content from webpages
- **Credits**: 1 credit per request

### 3. JSON Data Extraction

- **Endpoint**: `POST /web/extract-json`
- **Purpose**: Extract structured JSON data using AI
- **Credits**: 1 credit per request

### 4. Content Retrieval

- **Endpoint**: `POST /web/content`
- **Purpose**: Get raw HTML content from webpages
- **Credits**: 1 credit per request

### 5. Element Scraping

- **Endpoint**: `POST /web/scrape`
- **Purpose**: Scrape specific elements from webpages
- **Credits**: 1 credit per request

### 6. Link Extraction

- **Endpoint**: `POST /web/links`
- **Purpose**: Extract all links from webpages
- **Credits**: 1 credit per request

### 7. Web Search

- **Endpoint**: `POST /web/search`
- **Purpose**: Search the web using multiple search engines
- **Credits**: 1 credit per request

## Integration Requirements

### 1. Environment Configuration

Update your `wrangler.jsonc` file with the new durable object binding:

```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "TASK_DURABLE_OBJECT",
        "class_name": "TaskDurableObject"
      },
      {
        "name": "WEBLINQ_DURABLE_OBJECT",
        "class_name": "WebDurableObject"
      }
    ]
  }
}
```

### 2. Environment Variables

Add these environment variables to your `.env` file and Cloudflare Workers environment:

```bash
# Cloudflare Browser Rendering API credentials
CLOUDFLARE_ACCESS_TOKEN="your_cloudflare_api_token"
CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
```

### 3. TypeScript Environment Interface

Update your environment type definitions:

```typescript
interface Env {
  // ... existing bindings
  WEBLINQ_DURABLE_OBJECT: DurableObjectNamespace;

  // Required for web operations
  CLOUDFLARE_ACCESS_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
}
```

## Usage Examples

### Screenshot Example

```bash
curl -X POST https://your-worker.dev/web/screenshot \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fullPage": true,
    "width": 1280,
    "height": 800,
    "format": "png",
    "quality": 80
  }'
```

### Web Search Example

```bash
curl -X POST https://your-worker.dev/web/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "web scraping tools",
    "limit": 10
  }'
```

### Markdown Extraction Example

```bash
curl -X POST https://your-worker.dev/web/markdown \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/blog/post",
    "includeImages": true,
    "includeLinks": true
  }'
```

## Key Features

### User Isolation & Performance

- Each user gets their own Web Durable Object instance (`web:${userId}`)
- State is isolated between users for security and performance
- Prevents cross-user data leakage
- Direct method calls eliminate HTTP overhead

### Credit System Integration

- All operations consume credits from the user's account (1 credit per operation)
- Credit costs are configurable in the durable object
- Failed operations don't consume credits
- Real-time credit tracking

### Cloudflare Browser Rendering API Integration

- Full integration with Cloudflare's Browser Rendering API
- Supports screenshots, markdown extraction, JSON extraction, content retrieval, element scraping, and link extraction
- Proper error handling and response formatting
- Configurable wait times and rendering options

### Multi-Engine Web Search

- Separate search handler as requested (`web.search-handler.ts`)
- Searches multiple search engines in parallel
- Deduplicates and ranks results
- Rate limiting to prevent abuse
- Extensible design for adding more search engines

### Simplified Authentication

- Single authentication layer with `requireAuth` middleware
- No duplicate authentication checks
- User context automatically available in all handlers
- Proper JWT token validation

## Error Handling

The system provides comprehensive error handling:

- **Authentication Errors**: 401 responses for invalid/missing tokens
- **Validation Errors**: 422 responses for invalid request data
- **API Errors**: Proper error messages from Cloudflare API failures
- **Rate Limiting**: Built-in rate limiting for search operations
- **Credit Errors**: Clear messaging when users have insufficient credits

## Monitoring & Logging

- All operations are logged with appropriate detail levels
- Error logging includes stack traces for debugging
- Credit consumption is tracked for billing purposes
- Performance metrics are available through Cloudflare Analytics

## Security Considerations

- All API calls to Cloudflare use secure HTTPS with Bearer token authentication
- User authentication is required for all operations via `requireAuth` middleware
- Rate limiting prevents abuse of search functionality
- Input validation prevents injection attacks
- Proper error messages don't leak sensitive information
- User isolation through individual Durable Object instances

## Implementation Status

✅ **Completed Features:**

- All 7 web endpoints implemented with OpenAPI documentation
- WebDurableObject with full Cloudflare Browser Rendering API integration
- Separate search handler as requested (`web.search-handler.ts`)
- Direct method call architecture (no redundant HTTP forwarding)
- Proper TypeScript types using CloudflareBindings
- Credit system integration (1 credit per operation)
- User isolation and authentication
- Error handling with proper HTTP status codes (200, 422, 500)

✅ **Architecture Benefits:**

- **Eliminated Redundancy**: Removed intermediate durable-handlers layer
- **Single Authentication Point**: `requireAuth` middleware handles auth once
- **Performance**: Direct method calls instead of HTTP forwarding
- **Maintainability**: Simplified codebase with fewer files
- **Type Safety**: Full TypeScript integration with CloudflareBindings

🔧 **Required Configuration:**

1. **Wrangler**: Add `WEBLINQ_DURABLE_OBJECT` binding with `WebDurableObject` class
2. **Environment**: Set `CLOUDFLARE_ACCESS_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
3. **TypeScript**: Use CloudflareBindings interface (generated via `pnpm cf-typegen`)

📊 **Request Flow:**

```
Client Request → requireAuth Middleware → Route Handler → Direct Method Call → WebDurableObject → Cloudflare API
```

This implementation successfully replaces all instances of "studio" with "web", renames the durable object to `WEBLINQ_DURABLE_OBJECT`, and creates a separate search handler while maintaining a clean, efficient architecture.
