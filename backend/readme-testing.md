# Testing Guide

## Overview

This project uses integration tests that make real HTTP requests to a running `wrangler dev --remote` server. This ensures tests run against the same infrastructure as production, including real authentication middleware and remote D1 database.

## Prerequisites

1. **Running Server**: You need `wrangler dev --remote` running on port 8787
2. **API Key**: You need a valid API key from your application
3. **Remote Access**: The `wrangler dev --remote` command should work in your environment

## Setup Process

### 1. Start the Development Server

```bash
# In one terminal, start the server with remote D1
npm run dev
# This runs: wrangler dev --remote
```

The server should be running on `http://localhost:8787`

### 2. Get an API Key

1. Visit your application at `http://localhost:8787`
2. Log in through the authentication flow
3. Go to the API Keys management page
4. Create a new API key and copy it

### 3. Run Tests

```bash
# In another terminal, run the tests with your API key
TEST_API_KEY=your-api-key-here npm run test:tasks
```

## Running Tests

### Complete Test Suite

```bash
# Run all tests (will skip tasks tests without API key and server)
npm test
```

### Tasks Integration Tests

```bash
# Run tasks tests with your API key (requires running server)
TEST_API_KEY=your-api-key-here npm run test:tasks
```

### Alternative API Testing

```bash
# Run the standalone API test script
TEST_API_KEY=your-api-key-here npm run test:api-keys
```

## Test Structure

### Authentication Tests

- ✅ Rejects requests without authentication
- ✅ Rejects requests with invalid API keys
- ✅ Accepts requests with valid API keys

### CRUD Operations Tests

- ✅ **POST /tasks**: Field validation, task creation
- ✅ **GET /tasks**: List tasks for authenticated user
- ✅ **GET /tasks/:id**: Get specific task, ID validation, 404 handling
- ✅ **PATCH /tasks/:id**: Update validation, task updates
- ✅ **DELETE /tasks/:id**: Task deletion, 404 handling

### Data Integrity Tests

- ✅ Task count maintenance across operations
- ✅ Data preservation during updates

## Test Data Management

- All test tasks use the `TEST_` prefix in their names
- Tests automatically clean up before and after execution
- No interference with existing production/development data
- Uses the same D1 preview database as local development

## Key Features

1. **Real Server Integration**: Tests against actual running wrangler dev server
2. **Authentication Integration**: Uses real API key authentication
3. **Clean Isolation**: Test data is isolated with prefixes and cleaned up
4. **Production Parity**: Same infrastructure as production environment
5. **User Isolation**: Tests verify that users can only access their own tasks

## Troubleshooting

### "TEST_API_KEY environment variable is required"

- Ensure you're providing a valid API key: `TEST_API_KEY=your-key npm run test:tasks`
- Make sure the server is running: `npm run dev` in another terminal

### "session or API key required"

- Your API key may be invalid or expired
- Generate a new API key from the application UI at `http://localhost:8787`

### Connection refused / fetch failed

- Ensure `wrangler dev --remote` is running on port 8787
- Check that you can access `http://localhost:8787` in your browser
- Make sure no firewall is blocking the connection

### Database Connection Issues

- Ensure `wrangler dev --remote` works in your environment
- Check that you have access to the preview database in wrangler.jsonc
- Verify your Cloudflare account permissions

### TypeScript Warnings

- The tests may show some TypeScript warnings but should still execute successfully
- These are related to unknown JSON response types and don't affect functionality

## Example Test Run

```bash
# Terminal 1: Start the server
$ npm run dev
> wrangler dev --remote
⛅️ wrangler 4.16.1
-------------------
Using preview database for D1 binding "DB"
Starting local server...
Ready on http://localhost:8787

# Terminal 2: Run tests
$ TEST_API_KEY=ak_1234567890abcdef npm run test:tasks

> hono-open-api-starter@1.0.0 test:tasks
> cross-env NODE_ENV=test TEST_API_KEY=ak_1234567890abcdef vitest src/routes/tasks/tasks.test.ts

✓ Tasks API - Integration Tests with Remote D1 > Authentication Tests > should reject requests without authentication
✓ Tasks API - Integration Tests with Remote D1 > Authentication Tests > should reject requests with invalid API key
✓ Tasks API - Integration Tests with Remote D1 > Authentication Tests > should accept requests with valid API key
✓ Tasks API - Integration Tests with Remote D1 > Task CRUD Operations > POST /tasks - Create Task > should validate required fields
✓ Tasks API - Integration Tests with Remote D1 > Task CRUD Operations > POST /tasks - Create Task > should create a task with valid data
... (all tests pass)

Tests completed successfully! ✅
```

This testing approach provides comprehensive coverage while using real infrastructure, making the tests more reliable and closer to production behavior. The tests run against the actual authentication middleware and remote D1 database, ensuring complete integration testing.
