# Studio Durable Object Integration Guide

This document explains the new Studio functionality that has been added to the backend API, following the same pattern as the existing Task system.

## Overview

The Studio module provides Cloudflare Browser Rendering API functionality through a Durable Object architecture for scalability and user isolation. Each user gets their own Studio Durable Object instance that handles all browser rendering operations.

## Architecture

### Files Created

1. **`src/routes/studio/studio.routes.ts`** - OpenAPI route definitions
2. **`src/routes/studio/studio.durable-handlers.ts`** - Route handlers that interact with the Durable Object
3. **`src/routes/studio/studio.index.ts`** - Router setup with authentication middleware
4. **`src/durable-objects/studio-durable-object.ts`** - The Durable Object implementation
5. **Updated `src/app.ts`** - Added studio routes and exported the Durable Object

### API Endpoints

All endpoints require authentication and consume credits:

- **POST `/studio/screenshot`** - Capture webpage screenshots
- **POST `/studio/markdown`** - Extract markdown content from webpages
- **POST `/studio/json`** - Extract structured JSON data using AI
- **POST `/studio/content`** - Get fully rendered HTML content
- **POST `/studio/scrape`** - Extract specific HTML elements using CSS selectors
- **POST `/studio/links`** - Extract all links from webpages

### Credit System

Each operation has an associated credit cost:

- Screenshot: 1 credit (2 credits for full-page)
- Markdown: 1 credit
- JSON extraction: 1 credit
- Content: 1 credit
- Scrape: 1 credit
- Links: 1 credit

## Configuration Required

### 1. Update `wrangler.jsonc`

Add the Studio Durable Object to the durable_objects bindings:

```json
{
  "durable_objects": {
    "bindings": [
      {
        "name": "TASK_DURABLE_OBJECT",
        "class_name": "TaskDurableObject"
      },
      {
        "name": "STUDIO_DURABLE_OBJECT",
        "class_name": "StudioDurableObject"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["TaskDurableObject"]
    },
    {
      "tag": "v2",
      "new_sqlite_classes": ["StudioDurableObject"]
    }
  ]
}
```

### 2. Environment Variables

The Studio Durable Object requires these environment variables:

```
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
```

### 3. Update Type Definitions

After adding the Durable Object binding, regenerate types:

```bash
wrangler types --env-interface CloudflareBindings
```

Then update `worker-configuration.d.ts` to include:

```typescript
interface Env {
  // ... existing bindings
  STUDIO_DURABLE_OBJECT: DurableObjectNamespace;
}
```

## Usage Examples

### Screenshot

```bash
curl -X POST http://localhost:8787/studio/screenshot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "url": "https://example.com",
    "fullPage": false,
    "width": 1280,
    "height": 800
  }'
```

### Markdown Extraction

```bash
curl -X POST http://localhost:8787/studio/markdown \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "url": "https://example.com"
  }'
```

### JSON Extraction with AI

```bash
curl -X POST http://localhost:8787/studio/json \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "url": "https://example.com",
    "prompt": "Extract the main headline and author from this article"
  }'
```

## Key Features

### User Isolation

Each user gets their own Durable Object instance, ensuring complete data isolation and preventing cross-user data leakage.

### Credit Management

All operations are protected by credit checking and deduction (currently mocked in the handlers but ready for integration with your payment system).

### Error Handling

Comprehensive error handling with appropriate HTTP status codes:

- 401 Unauthorized (missing/invalid auth)
- 402 Payment Required (insufficient credits)
- 422 Unprocessable Entity (validation errors)
- 500 Internal Server Error (API/processing errors)

### Modular Design

The implementation follows the same pattern as the existing Task system:

- Routes define the API contract
- Handlers manage auth, credits, and orchestration
- Durable Object handles the business logic
- Everything is properly typed with OpenAPI schemas

## Integration with Frontend

The existing frontend `studio/actions.ts` file can be migrated to call these new backend endpoints instead of directly calling the Cloudflare API, providing better security and credit management.

## Next Steps

1. Configure wrangler.jsonc with the new Durable Object
2. Set up environment variables for Cloudflare API access
3. Integrate with your credit/payment system
4. Test the endpoints with your frontend
5. Deploy the changes

## Benefits of This Architecture

- **Scalability**: Durable Objects automatically scale per user
- **Security**: API keys are server-side only
- **Credit Control**: Centralized credit management
- **Monitoring**: Better observability of API usage
- **Flexibility**: Easy to add new browser rendering features
- **Consistency**: Follows the same pattern as existing Task functionality
