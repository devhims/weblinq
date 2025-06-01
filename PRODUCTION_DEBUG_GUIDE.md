# Production API Key Debug Guide

## 🚨 Current Status

✅ **Authentication Working**: Frontend token validation successful  
❌ **API Keys Failing**: `APIError` in production listApiKeys operation

## 🔍 Problem Analysis

From the logs, we can see:

1. **Frontend auth session → Backend validation** ✅ Works
2. **Backend auth middleware** ✅ Works: "Auth successful for user: thinktank.himanshu@gmail.com (source: frontend-token)"
3. **API Keys list operation** ❌ Fails: "List API keys error: APIError"

## 🎯 Root Cause: Schema Mismatch

**Issue**: Database table name mismatch between Better Auth expectations and your schema.

- **Your Schema**: Table named `apikey` (singular)
- **Better Auth Expected**: Likely expects `api_key` (plural with underscore)

## 🔧 Immediate Fixes

### 1. **Deploy Enhanced Debug Version**

The updated `api-keys.handlers.ts` now includes detailed logging. After deployment, check Cloudflare logs for:

```
ListApiKeys - User ID: [user-id]
ListApiKeys - Success, result length: [number]
```

OR error details:

```
List API keys error: [detailed error]
Error type: [error type]
Error constructor: [error constructor name]
```

### 2. **Check Database Connection**

Verify your Cloudflare D1 database is properly connected:

```bash
# Check if tables exist
npx wrangler d1 execute [DATABASE_NAME] --command "SELECT name FROM sqlite_master WHERE type='table';"

# Check apikey table structure
npx wrangler d1 execute [DATABASE_NAME] --command "PRAGMA table_info(apikey);"

# Check if user exists in database
npx wrangler d1 execute [DATABASE_NAME] --command "SELECT id, email FROM user WHERE email='thinktank.himanshu@gmail.com';"
```

### 3. **Environment Variables Check**

Ensure these are set in production:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `FRONTEND_URL`
- `API_KEY_PREFIX`

## 🛠 Solutions (In Order of Preference)

### Option 1: Schema Fix (Recommended)

If Better Auth expects different table naming:

```sql
-- Rename table to match Better Auth expectations
ALTER TABLE apikey RENAME TO api_key;
```

### Option 2: Better Auth Configuration

Update your auth config to match your schema:

```typescript
// In backend/src/lib/auth.ts
plugins: [
  apiKey({
    enableMetadata: true,
    tableName: 'apikey', // Use your table name
    // ... rest of config
  }),
],
```

### Option 3: Direct Database Fallback

If Better Auth continues to fail, implement direct database queries as shown in the handler update.

## 🧪 Testing Steps

### 1. **Check Current Logs**

After deploying the debug version, test API key listing and check Cloudflare logs for:

- User ID being logged
- Specific error details

### 2. **Database Verification**

```bash
# Check if user exists in production database
npx wrangler d1 execute [DATABASE_NAME] --command "SELECT * FROM user LIMIT 5;"

# Check apikey table
npx wrangler d1 execute [DATABASE_NAME] --command "SELECT * FROM apikey LIMIT 5;"
```

### 3. **Environment Check**

```bash
# Verify environment variables in Cloudflare
npx wrangler secret list
```

## 🚀 Next Actions

1. **Deploy the debug version** (already updated)
2. **Test API key creation/listing** in production
3. **Check Cloudflare logs** for detailed error information
4. **Run database queries** to verify data exists
5. **Apply appropriate fix** based on findings

## 📋 Expected Log Output

### Success Case:

```
Auth successful for user: thinktank.himanshu@gmail.com (source: frontend-token)
ListApiKeys - User ID: [user-id]
ListApiKeys - Success, result length: 0
```

### Error Case:

```
Auth successful for user: thinktank.himanshu@gmail.com (source: frontend-token)
ListApiKeys - User ID: [user-id]
List API keys error: [specific error message]
Error type: object
Error constructor: [Error/APIError/etc]
```

## 🎯 Key Insight

The authentication bridge is working perfectly! The issue is specifically with Better Auth's API key plugin operation, likely due to:

- Database schema mismatch
- Missing database connection
- Environment configuration issue

This is a **much easier fix** than the authentication issues we've already solved! 🎉
