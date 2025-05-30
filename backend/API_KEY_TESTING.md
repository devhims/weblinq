# API Key Authentication Testing Guide

This guide helps you test the unified authentication middleware that supports both OAuth sessions and API key authentication using the `Authorization: Bearer` format.

## 🔧 Prerequisites

1. **Development server running:**

   ```bash
   npm run dev
   ```

2. **API key created:** You need to create an API key first through OAuth authentication.

## 🔑 Creating an API Key

### Step 1: OAuth Login

1. Visit: http://localhost:3000/reference
2. Click on the GitHub OAuth login
3. Authorize the application

### Step 2: Create API Key

Use the OpenAPI documentation interface or cURL:

```bash
curl -X POST "http://localhost:3000/api-keys/create" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test API Key"}'
```

**Note:** You need to be logged in with a session cookie for this to work.

### Step 3: Copy the API Key

The response will include a `key` field with your API key (starts with `wq_`). **Save this immediately** - it's only shown once!

```json
{
  "id": "...",
  "name": "Test API Key",
  "key": "wq_1234567890abcdef...",
  "start": "wq_1234",
  "enabled": true,
  "requestCount": 0
}
```

## 🧪 Testing Methods

### Method 1: Bash Script (Quick Testing)

```bash
./test-api-key.sh wq_your_api_key_here
```

This script will:

- ✅ Test unauthorized access (should return 401)
- ✅ Test all CRUD operations on `/tasks` endpoints
- ✅ Show API key usage statistics
- ✅ Display clear success/failure indicators

### Method 2: Node.js Script (Detailed Testing)

```bash
node test-api-key-auth.js wq_your_api_key_here
```

This script provides:

- 📊 Detailed request/response logging
- 📈 Request count tracking before/after tests
- 🐚 Generated cURL commands for manual testing
- 🎨 Colorized output for better readability

### Method 3: Manual cURL Commands

You can also test manually with cURL:

#### List all tasks:

```bash
curl -X GET "http://localhost:3000/tasks" \
  -H "Authorization: Bearer wq_your_api_key_here" \
  -H "Content-Type: application/json"
```

#### Create a task:

```bash
curl -X POST "http://localhost:3000/tasks" \
  -H "Authorization: Bearer wq_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Task", "done": false}'
```

#### Update a task:

```bash
curl -X PATCH "http://localhost:3000/tasks/1" \
  -H "Authorization: Bearer wq_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{"done": true}'
```

#### Delete a task:

```bash
curl -X DELETE "http://localhost:3000/tasks/1" \
  -H "Authorization: Bearer wq_your_api_key_here"
```

#### Check API key usage:

```bash
curl -X GET "http://localhost:3000/api-keys/list" \
  -H "Authorization: Bearer wq_your_api_key_here" \
  -H "Content-Type: application/json"
```

## 🔍 What to Verify

### ✅ Authentication Working

- **200 status** for valid API key requests
- **401 status** for requests without API key
- **401 status** for requests with invalid API key

### ✅ Request Counting

- `requestCount` increases after each API call
- `lastRequest` timestamp updates
- Usage statistics are accurate

### ✅ Authorization Formats

The middleware should accept API keys in both formats:

- `x-api-key: wq_your_key`
- `Authorization: Bearer wq_your_key`

### ✅ Protected Routes

All `/tasks/*` routes require authentication:

- `GET /tasks` - List tasks
- `POST /tasks` - Create task
- `GET /tasks/{id}` - Get specific task
- `PATCH /tasks/{id}` - Update task
- `DELETE /tasks/{id}` - Delete task

## 🐛 Troubleshooting

### API Key Not Working

1. Ensure the API key starts with `wq_`
2. Check that it was copied correctly (no extra spaces)
3. Verify the key is enabled: `GET /api-keys/list`

### 401 Unauthorized Errors

1. Confirm the `Authorization: Bearer` format is correct
2. Check if the API key has expired (`expiresAt` field)
3. Verify rate limits aren't exceeded

### Request Count Not Updating

1. Check the API key's `requestCount` before and after tests
2. Ensure you're using the same API key for verification
3. Look for any errors in the server logs

## 📊 Expected Behavior

### Successful API Key Auth:

```json
{
  "user": {
    "id": "user123",
    "email": "user@example.com"
  },
  "session": {
    "id": "api-key:your_key_id"
  }
}
```

### Failed Auth:

```json
{
  "error": "Authentication required. Please provide a valid session cookie or API key."
}
```

## 🔧 API Key Configuration

From `src/lib/auth.ts`, the API key plugin is configured with:

- **Rate Limiting:** 1000 requests per 24 hours
- **Headers Supported:** `x-api-key` and `Authorization: Bearer`
- **Prefix:** `wq_`
- **Metadata:** Enabled for additional context

## 📝 Notes

- API keys create "synthetic" sessions with IDs like `api-key:123...`
- The `unified-auth.ts` middleware handles both cookie and API key auth seamlessly
- Request counting happens automatically through Better Auth's API key plugin
- All task routes in `/src/routes/tasks/tasks.index.ts` are protected by `requireAuth` middleware

Happy testing! 🚀
