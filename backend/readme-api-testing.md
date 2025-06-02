# API Key Testing for Task Endpoints

This document explains how to test the task endpoints using API keys to ensure proper authentication and authorization.

## Test Script

The `test-api-key-tasks.js` script comprehensively tests the task endpoints with different authentication scenarios.

### Prerequisites

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Get a valid API key:**
   - Go to the dashboard at `http://localhost:3000/dashboard`
   - Log in with your account
   - Create an API key in the "API Key Management" section
   - Copy the generated API key

### Running the Tests

#### Option 1: Using npm script (recommended)

```bash
npm run test:api-keys [YOUR_API_KEY]
```

#### Option 2: Direct execution

```bash
node test-api-key-tasks.js [YOUR_API_KEY]
```

#### Option 3: Interactive mode

If you don't provide the API key as an argument, the script will prompt you:

```bash
npm run test:api-keys
# Will prompt: "Please enter a valid API key to test: "
```

### Test Scenarios

The script tests three authentication scenarios:

#### 1. 🚫 No API Key Provided

- **Expected Result:** `401 Unauthorized`
- **Tests:** Ensures endpoints are properly protected

#### 2. 🔑 Invalid API Key Provided

- **Expected Result:** `401 Unauthorized`
- **Tests:** Ensures invalid keys are rejected

#### 3. ✅ Valid API Key Provided

- **Expected Results:** All operations succeed
- **Tests:**
  - `GET /tasks` - List user's tasks
  - `POST /tasks` - Create a new task
  - `PATCH /tasks/:id` - Update task completion status
  - `GET /tasks/:id` - Retrieve specific task
  - `DELETE /tasks/:id` - Delete the task

### What the Script Validates

✅ **Authentication:** API keys work for task endpoint access
✅ **Authorization:** Users can only access their own tasks
✅ **Data Isolation:** Tasks are properly isolated per user
✅ **CRUD Operations:** All task operations work with API keys
✅ **Durable Objects:** Per-user task isolation via Durable Objects
✅ **Error Handling:** Proper error responses for invalid requests

### Sample Output

```
🔑 API Key Task Endpoint Test Suite
====================================
Testing against: http://localhost:8787
Using API key: sk_test_a...

🔍 Test 1: No API Key Provided
==================================================
GET /tasks
Status: 401 Unauthorized
✅ PASS: Correctly rejected request without API key

🔍 Test 2: Invalid API Key Provided
==================================================
GET /tasks
API Key: invalid-key-12345
Status: 401 Unauthorized
✅ PASS: Correctly rejected request with invalid API key

🔍 Test 3: Valid API Key Provided
==================================================

📋 Testing GET /tasks
Status: 200 OK
✅ PASS: Successfully listed tasks
Found 2 tasks

➕ Testing POST /tasks
Status: 200 OK
✅ PASS: Successfully created task

✏️  Testing PATCH /tasks/:id
Status: 200 OK
✅ PASS: Successfully updated task

🔍 Testing GET /tasks/:id
Status: 200 OK
✅ PASS: Successfully retrieved specific task

🗑️  Testing DELETE /tasks/:id
Status: 204 No Content
✅ PASS: Successfully deleted task

📊 Test Summary
===============
✅ All tests passed! (3/3)
```

### Troubleshooting

**401 Unauthorized for valid API key:**

- Ensure the API key belongs to the account you're testing with
- Check that the API key hasn't expired
- Verify the server is running on `http://localhost:8787`

**Connection errors:**

- Make sure the backend server is running: `npm run dev`
- Check that the server is accessible at `http://localhost:8787`

**CORS errors:**

- The script uses server-to-server requests, so CORS shouldn't be an issue
- If you see CORS errors, they likely indicate a different problem

### Architecture Notes

This test validates the complete authentication flow:

1. **Unified Auth Middleware:** Handles both session and API key authentication
2. **User Context:** API keys provide user identity for task operations
3. **Durable Objects:** Each user gets isolated task storage
4. **Data Security:** Users can only access their own tasks via API keys
